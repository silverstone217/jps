import { Prisma } from "@/app/generated/prisma/client";
import {
  StockAdjustmentInput,
  StockQueryInput,
  StockVariantQueryInput,
} from "./stock.schema";

import { prisma } from "@/lib/prisma";

// ======================================================
// ERREURS MÉTIER
// ======================================================

export class StockServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StockServiceError";
  }
}

// ======================================================
// HELPERS
// ======================================================

function decimalToNumber(value: Prisma.Decimal | number): number {
  return Number(value);
}

function normalizePointOfSaleId(pointOfSaleId?: string | null): string | null {
  return pointOfSaleId?.trim() || null;
}

// ======================================================
// BOUTIQUE PRINCIPALE
// ======================================================

async function getMainShop() {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
  });

  if (!shop) {
    throw new StockServiceError(
      "SHOP_NOT_FOUND",
      "La boutique principale est introuvable.",
    );
  }

  return shop;
}

// ======================================================
// UTILISATEUR
// ======================================================

async function getStockUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      name: true,
      telephone: true,
      role: true,

      isActive: true,
      isBanned: true,
      banExpiresAt: true,

      assignments: {
        where: {
          isActive: true,
        },

        select: {
          id: true,
          shopId: true,
          pointOfSaleId: true,
        },
      },
    },
  });

  if (!user) {
    throw new StockServiceError(
      "USER_NOT_FOUND",
      "L'utilisateur est introuvable.",
    );
  }

  if (!user.isActive) {
    throw new StockServiceError("USER_INACTIVE", "Votre compte est désactivé.");
  }

  if (user.isBanned) {
    const banStillActive = !user.banExpiresAt || user.banExpiresAt > new Date();

    if (banStillActive) {
      throw new StockServiceError(
        "USER_BANNED",
        "Votre compte est actuellement suspendu.",
      );
    }
  }

  return user;
}

// ======================================================
// PDV DE L'EMPLOYÉ
// ======================================================
//
// IMPORTANT :
//
// L'employé ne choisit JAMAIS son PDV depuis le client.
//
// Le serveur récupère son StaffAssignment actif.
//
// Si aucun assignment n'existe :
//
// → l'employé ne peut pas consulter le stock.
//
// ======================================================

async function getEmployeePointOfSale(
  user: Awaited<ReturnType<typeof getStockUser>>,
  shopId: string,
) {
  const assignment = user.assignments.find((item) => item.shopId === shopId);

  if (!assignment) {
    throw new StockServiceError(
      "POS_ASSIGNMENT_REQUIRED",
      "Vous n'êtes affecté à aucun point de vente. Veuillez demander à un manager de vous affecter à un point de vente avant de consulter le stock.",
    );
  }

  const pointOfSale = await prisma.pointOfSale.findFirst({
    where: {
      id: assignment.pointOfSaleId,
      shopId,
    },

    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
    },
  });

  if (!pointOfSale) {
    throw new StockServiceError(
      "POS_NOT_FOUND",
      "Votre point de vente assigné est introuvable.",
    );
  }

  if (!pointOfSale.isActive) {
    throw new StockServiceError(
      "POS_INACTIVE",
      "Votre point de vente est actuellement désactivé.",
    );
  }

  return pointOfSale;
}

// ======================================================
// VÉRIFIER L'ACCÈS AU STOCK
// ======================================================
//
// MANAGER
// → peut consulter le stock central
// → peut consulter n'importe quel PDV
//
// EMPLOYEE
// → le serveur récupère automatiquement son PDV assigné
// → ne peut consulter QUE ce PDV
// → ne peut jamais consulter le central
//
// Le pointOfSaleId envoyé par le client est donc ignoré
// pour les employés.
//
// ======================================================

async function validateStockAccess(
  userId: string,
  shopId: string,
  requestedPointOfSaleId: string | null,
) {
  const user = await getStockUser(userId);

  // ====================================================
  // MANAGER
  // ====================================================

  if (user.role === "MANAGER") {
    // Stock central
    if (!requestedPointOfSaleId) {
      return {
        user,
        pointOfSaleId: null,
        pointOfSale: null,
      };
    }

    // Stock d'un PDV choisi par le manager
    const pointOfSale = await prisma.pointOfSale.findFirst({
      where: {
        id: requestedPointOfSaleId,
        shopId,
      },

      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
      },
    });

    if (!pointOfSale) {
      throw new StockServiceError(
        "POS_NOT_FOUND",
        "Le point de vente sélectionné est introuvable.",
      );
    }

    if (!pointOfSale.isActive) {
      throw new StockServiceError(
        "POS_INACTIVE",
        "Le point de vente sélectionné est désactivé.",
      );
    }

    return {
      user,
      pointOfSaleId: pointOfSale.id,
      pointOfSale,
    };
  }

  // ====================================================
  // EMPLOYEE
  // ====================================================

  if (user.role !== "EMPLOYEE") {
    throw new StockServiceError(
      "FORBIDDEN",
      "Vous n'êtes pas autorisé à consulter le stock.",
    );
  }

  // ====================================================
  // RÉCUPÉRER LE PDV DEPUIS LE SERVEUR
  // ====================================================

  const employeePointOfSale = await getEmployeePointOfSale(user, shopId);

  // ====================================================
  // IMPORTANT
  // ====================================================
  //
  // On ignore volontairement requestedPointOfSaleId.
  //
  // Exemple :
  //
  // GET /stock?pointOfSaleId=PDV_GOMBE
  //
  // Si l'employé est affecté à PDV_LIMETE,
  // il verra quand même uniquement PDV_LIMETE.
  //
  // Le client ne peut donc pas choisir son stock.
  //
  // ====================================================

  return {
    user,
    pointOfSaleId: employeePointOfSale.id,
    pointOfSale: employeePointOfSale,
  };
}

// ======================================================
// VÉRIFIER L'ACCÈS MANAGER
// ======================================================
//
// Les ajustements physiques sont réservés au manager.
//
// ======================================================

async function validateManager(userId: string) {
  const user = await getStockUser(userId);

  if (user.role !== "MANAGER") {
    throw new StockServiceError(
      "FORBIDDEN",
      "Seul un manager peut effectuer un ajustement d'inventaire.",
    );
  }

  return user;
}

// ======================================================
// VALIDER UN PDV
// ======================================================

async function validatePointOfSale(shopId: string, pointOfSaleId: string) {
  const pointOfSale = await prisma.pointOfSale.findFirst({
    where: {
      id: pointOfSaleId,
      shopId,
    },

    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
    },
  });

  if (!pointOfSale) {
    throw new StockServiceError(
      "POS_NOT_FOUND",
      "Le point de vente sélectionné est introuvable.",
    );
  }

  if (!pointOfSale.isActive) {
    throw new StockServiceError(
      "POS_INACTIVE",
      "Le point de vente sélectionné est désactivé.",
    );
  }

  return pointOfSale;
}

// ======================================================
// WHERE STOCK FINI
// ======================================================

function getFinishedStockWhere(
  shopId: string,
  variantId?: string,
  pointOfSaleId?: string | null,
): Prisma.FinishedStockWhereInput {
  return {
    shopId,

    ...(variantId
      ? {
          variantId,
        }
      : {}),

    pointOfSaleId: normalizePointOfSaleId(pointOfSaleId),
  };
}

// ======================================================
// VALIDER LA VARIANTE
// ======================================================

async function getVariantForShop(shopId: string, variantId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: {
      id: variantId,

      product: {
        shopId,
      },
    },

    include: {
      product: {
        select: {
          id: true,
          name: true,
          image: true,
          isActive: true,
          shopId: true,
        },
      },

      packaging: {
        select: {
          id: true,
          name: true,
          size: true,
          capacityMl: true,
          isActive: true,
        },
      },
    },
  });

  if (!variant) {
    throw new StockServiceError(
      "VARIANT_NOT_FOUND",
      "La variante du produit est introuvable.",
    );
  }

  return variant;
}

// ======================================================
// VÉRIFIER LA COHÉRENCE DES LOTS
// ======================================================
//
// FinishedStock.quantity
// doit correspondre à la somme des
// FinishedStockLot.remainingQuantity.
//
// On ne répare jamais automatiquement une incohérence.
//
// ======================================================

async function validateFinishedStockConsistency(
  tx: Prisma.TransactionClient,
  finishedStock: {
    id: string;
    quantity: number;
  },
) {
  const lots = await tx.finishedStockLot.findMany({
    where: {
      finishedStockId: finishedStock.id,
    },

    select: {
      id: true,
      quantity: true,
      remainingQuantity: true,
      expiresAt: true,
    },
  });

  let totalRemaining = 0;

  for (const lot of lots) {
    if (lot.remainingQuantity < 0 || lot.remainingQuantity > lot.quantity) {
      throw new StockServiceError(
        "INVALID_STOCK_LOT",
        "Un lot de stock contient une quantité incohérente.",
      );
    }

    totalRemaining += lot.remainingQuantity;
  }

  if (totalRemaining !== finishedStock.quantity) {
    throw new StockServiceError(
      "STOCK_INCONSISTENCY",
      "Le stock agrégé ne correspond pas à la quantité restante des lots.",
    );
  }

  return lots;
}

// ======================================================
// RÉCUPÉRER LES STOCKS DE JUS FINIS
// ======================================================

async function getFinishedStocks(
  shopId: string,
  pointOfSaleId: string,
  limit: number,
  page: number,
) {
  const where = getFinishedStockWhere(shopId, undefined, pointOfSaleId);

  const skip = (page - 1) * limit;

  const [finishedStocks, total] = await prisma.$transaction([
    prisma.finishedStock.findMany({
      where,

      orderBy: [
        {
          variant: {
            product: {
              name: "asc",
            },
          },
        },

        {
          variant: {
            sku: "asc",
          },
        },
      ],

      skip,
      take: limit,

      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                isActive: true,
              },
            },

            packaging: {
              select: {
                id: true,
                name: true,
                size: true,
                capacityMl: true,
              },
            },
          },
        },

        lots: {
          where: {
            remainingQuantity: {
              gt: 0,
            },
          },

          orderBy: [
            {
              expiresAt: "asc",
            },

            {
              createdAt: "asc",
            },
          ],

          select: {
            id: true,
            quantity: true,
            remainingQuantity: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
    }),

    prisma.finishedStock.count({
      where,
    }),
  ]);

  const now = new Date();

  const stocks = finishedStocks.map((stock) => {
    const activeLots = stock.lots.filter((lot) => lot.remainingQuantity > 0);

    const expiredQuantity = activeLots.reduce((total, lot) => {
      if (lot.expiresAt && lot.expiresAt < now) {
        return total + lot.remainingQuantity;
      }

      return total;
    }, 0);

    const nextExpiration =
      activeLots.find((lot) => lot.expiresAt !== null)?.expiresAt ?? null;

    return {
      ...stock,

      expiredQuantity,

      nextExpiration,

      hasExpiredStock: expiredQuantity > 0,

      isOutOfStock: stock.quantity === 0,
    };
  });

  return {
    stocks,

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ======================================================
// MATIÈRES PREMIÈRES
// ======================================================
//
// UNIQUEMENT POUR LE MANAGER.
//
// ======================================================

async function getRawIngredients(shopId: string) {
  const ingredients = await prisma.rawIngredient.findMany({
    where: {
      shopId,
    },

    orderBy: {
      name: "asc",
    },
  });

  return ingredients.map((ingredient) => {
    const stockQty = decimalToNumber(ingredient.stockQty);

    const minAlert = decimalToNumber(ingredient.minAlert);

    return {
      ...ingredient,
      stockQty,
      minAlert,
      isOutOfStock: stockQty <= 0,
      isLowStock: stockQty > 0 && stockQty <= minAlert,
    };
  });
}

// ======================================================
// EMBALLAGES
// ======================================================
//
// UNIQUEMENT POUR LE MANAGER.
//
// ======================================================

async function getPackagings(shopId: string) {
  const packagings = await prisma.packaging.findMany({
    where: {
      shopId,
    },

    orderBy: [
      {
        name: "asc",
      },

      {
        capacityMl: "asc",
      },
    ],
  });

  return packagings.map((packaging) => ({
    ...packaging,
    isOutOfStock: packaging.stockQty <= 0,
    isLowStock:
      packaging.stockQty > 0 && packaging.stockQty <= packaging.minAlert,
  }));
}

// ======================================================
// STOCK GLOBAL
// ======================================================
//
// MANAGER
// → matières premières
// → packaging
// → stock central OU PDV choisi
//
// EMPLOYEE
// → uniquement les jus finis
// → uniquement son PDV
//
// ======================================================

export async function getStock(
  userId: string,
  query: Partial<StockQueryInput> = {},
) {
  const shop = await getMainShop();

  const requestedPointOfSaleId = normalizePointOfSaleId(query.pointOfSaleId);

  // ====================================================
  // ACCÈS
  // ====================================================

  const access = await validateStockAccess(
    userId,
    shop.id,
    requestedPointOfSaleId,
  );

  const limit = query.limit ?? 20;

  const page = query.page ?? 1;

  // ====================================================
  // EMPLOYEE
  // ====================================================
  //
  // Un employee ne consulte que :
  //
  // FinishedStock de son PDV.
  //
  // On ne récupère volontairement PAS :
  //
  // - RawIngredient
  // - Packaging
  // - stock central
  // - autre PDV
  //
  // ====================================================

  if (access.user.role === "EMPLOYEE") {
    const finishedStocks = await getFinishedStocks(
      shop.id,
      access.pointOfSaleId!,
      limit,
      page,
    );

    return {
      shop: {
        id: shop.id,
        name: shop.name,
        currency: shop.currency,
      },

      location: {
        type: "POS" as const,
        pointOfSaleId: access.pointOfSaleId,
        pointOfSale: access.pointOfSale,
      },

      rawIngredients: [],

      packagings: [],

      finishedStocks: finishedStocks.stocks,

      pagination: finishedStocks.pagination,
    };
  }

  // ====================================================
  // MANAGER
  // ====================================================

  const pointOfSale = access.pointOfSale;

  const [rawIngredients, packagings, finishedStocks] = await Promise.all([
    getRawIngredients(shop.id),

    getPackagings(shop.id),

    getFinishedStocks(shop.id, access.pointOfSaleId!, limit, page),
  ]);

  // ====================================================
  // RÉPONSE MANAGER
  // ====================================================

  return {
    shop: {
      id: shop.id,
      name: shop.name,
      currency: shop.currency,
    },

    location: {
      type: "POS" as const,
      pointOfSaleId: access.pointOfSaleId,
      pointOfSale,
    },

    rawIngredients,

    packagings,

    finishedStocks: finishedStocks.stocks,

    pagination: finishedStocks.pagination,
  };
}

// ======================================================
// DÉTAIL STOCK D'UNE VARIANTE
// ======================================================
//
// MANAGER
// → peut demander central ou un PDV.
//
// EMPLOYEE
// → le serveur impose son PDV.
//
// ======================================================

export async function getStockByVariant(
  userId: string,
  variantId: string,
  query: Partial<StockVariantQueryInput> = {},
) {
  const shop = await getMainShop();

  const requestedPointOfSaleId = normalizePointOfSaleId(query.pointOfSaleId);

  // ====================================================
  // ACCÈS
  // ====================================================

  const access = await validateStockAccess(
    userId,
    shop.id,
    requestedPointOfSaleId,
  );

  // ====================================================
  // VARIANTE
  // ====================================================

  const variant = await getVariantForShop(shop.id, variantId);

  // ====================================================
  // STOCK
  // ====================================================

  const finishedStock = await prisma.finishedStock.findFirst({
    where: getFinishedStockWhere(shop.id, variantId, access.pointOfSaleId),

    include: {
      lots: {
        where: {
          remainingQuantity: {
            gt: 0,
          },
        },

        orderBy: [
          {
            expiresAt: "asc",
          },

          {
            createdAt: "asc",
          },
        ],

        include: {
          entry: {
            select: {
              id: true,
              quantity: true,
              origin: true,
              note: true,
              createdById: true,
              createdAt: true,
              productionItemId: true,
            },
          },
        },
      },

      entries: {
        orderBy: {
          createdAt: "desc",
        },

        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              telephone: true,
            },
          },

          productionItem: {
            include: {
              production: {
                select: {
                  id: true,
                  producedAt: true,
                  totalVolumeMl: true,
                  notes: true,
                  managerId: true,
                },
              },
            },
          },

          lots: {
            select: {
              id: true,
              quantity: true,
              remainingQuantity: true,
              expiresAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  const now = new Date();

  // ====================================================
  // STOCK ABSENT
  // ====================================================

  if (!finishedStock) {
    return {
      shop: {
        id: shop.id,
        name: shop.name,
        currency: shop.currency,
      },

      location: {
        type: "POS" as const,
        pointOfSaleId: access.pointOfSaleId,
        pointOfSale: access.pointOfSale,
      },

      variant,

      stock: {
        id: null,
        quantity: 0,
        isOutOfStock: true,
        expiredQuantity: 0,
        hasExpiredStock: false,
        nextExpiration: null,
        lots: [],
        entries: [],
      },
    };
  }

  // ====================================================
  // COHÉRENCE
  // ====================================================

  const lotsRemaining = finishedStock.lots.reduce(
    (total, lot) => total + lot.remainingQuantity,
    0,
  );

  if (lotsRemaining !== finishedStock.quantity) {
    throw new StockServiceError(
      "STOCK_INCONSISTENCY",
      "Le stock agrégé ne correspond pas à la quantité restante des lots.",
    );
  }

  // ====================================================
  // EXPIRATION
  // ====================================================

  const activeLots = finishedStock.lots;

  const expiredQuantity = activeLots.reduce((total, lot) => {
    if (lot.expiresAt && lot.expiresAt < now) {
      return total + lot.remainingQuantity;
    }

    return total;
  }, 0);

  const nextExpiration =
    activeLots.find((lot) => lot.expiresAt !== null)?.expiresAt ?? null;

  // ====================================================
  // RÉPONSE
  // ====================================================

  return {
    shop: {
      id: shop.id,
      name: shop.name,
      currency: shop.currency,
    },

    location: {
      type: "POS" as const,
      pointOfSaleId: access.pointOfSaleId,
      pointOfSale: access.pointOfSale,
    },

    variant,

    stock: {
      id: finishedStock.id,
      quantity: finishedStock.quantity,
      isOutOfStock: finishedStock.quantity === 0,
      expiredQuantity,
      hasExpiredStock: expiredQuantity > 0,
      nextExpiration,
      lots: finishedStock.lots,
      entries: finishedStock.entries,
    },
  };
}

// ======================================================
// AJUSTEMENT — RÉDUIRE LES LOTS
// ======================================================

async function consumeLotsForAdjustment(
  tx: Prisma.TransactionClient,
  finishedStockId: string,
  quantityToRemove: number,
) {
  let remaining = quantityToRemove;

  const lots = await tx.finishedStockLot.findMany({
    where: {
      finishedStockId,
      remainingQuantity: {
        gt: 0,
      },
    },

    orderBy: [
      {
        expiresAt: "asc",
      },

      {
        createdAt: "asc",
      },
    ],
  });

  for (const lot of lots) {
    if (remaining <= 0) {
      break;
    }

    const quantityFromLot = Math.min(lot.remainingQuantity, remaining);

    await tx.finishedStockLot.update({
      where: {
        id: lot.id,
      },

      data: {
        remainingQuantity: {
          decrement: quantityFromLot,
        },
      },
    });

    remaining -= quantityFromLot;
  }

  if (remaining > 0) {
    throw new StockServiceError(
      "INSUFFICIENT_LOT_STOCK",
      "La quantité à retirer dépasse la quantité disponible dans les lots.",
    );
  }
}

// ======================================================
// AJUSTEMENT D'INVENTAIRE
// ======================================================
//
// MANAGER UNIQUEMENT.
//
// L'employee ne peut jamais atteindre cette opération.
//
// ======================================================

export async function adjustStock(userId: string, input: StockAdjustmentInput) {
  // ====================================================
  // MANAGER
  // ====================================================

  const manager = await validateManager(userId);

  // ====================================================
  // SHOP
  // ====================================================

  const shop = await getMainShop();

  // ====================================================
  // LOCALISATION
  // ====================================================

  const pointOfSaleId = normalizePointOfSaleId(input.pointOfSaleId);

  if (pointOfSaleId) {
    await validatePointOfSale(shop.id, pointOfSaleId);
  }

  // ====================================================
  // VARIANTE
  // ====================================================

  const variant = await getVariantForShop(shop.id, input.variantId);

  if (!variant.isActive) {
    throw new StockServiceError(
      "VARIANT_INACTIVE",
      `La variante "${variant.sku}" est désactivée.`,
    );
  }

  if (!variant.product.isActive) {
    throw new StockServiceError(
      "PRODUCT_INACTIVE",
      `Le produit "${variant.product.name}" est désactivé.`,
    );
  }

  // ====================================================
  // TRANSACTION ATOMIQUE
  // ====================================================

  const result = await prisma.$transaction(
    async (tx) => {
      // ==============================================
      // 1. RÉCUPÉRER LE STOCK
      // ==============================================

      let finishedStock = await tx.finishedStock.findFirst({
        where: getFinishedStockWhere(shop.id, input.variantId, pointOfSaleId),
      });

      // ==============================================
      // 2. STOCK INEXISTANT
      // ==============================================

      if (!finishedStock) {
        if (input.actualQuantity === 0) {
          throw new StockServiceError(
            "NO_ADJUSTMENT_NEEDED",
            "Le stock est déjà à zéro.",
          );
        }

        finishedStock = await tx.finishedStock.create({
          data: {
            shopId: shop.id,
            pointOfSaleId,
            variantId: input.variantId,
            quantity: input.actualQuantity,
          },
        });

        const entry = await tx.finishedStockEntry.create({
          data: {
            finishedStockId: finishedStock.id,
            quantity: input.actualQuantity,
            origin: "AJUSTEMENT",
            note: input.note?.trim() || null,
            createdById: manager.id,
          },
        });

        await tx.finishedStockLot.create({
          data: {
            finishedStockId: finishedStock.id,
            entryId: entry.id,
            quantity: input.actualQuantity,
            remainingQuantity: input.actualQuantity,
            expiresAt: null,
          },
        });

        return {
          finishedStockId: finishedStock.id,
          previousQuantity: 0,
          actualQuantity: input.actualQuantity,
          difference: input.actualQuantity,
          entryId: entry.id,
        };
      }

      // ==============================================
      // 3. COHÉRENCE
      // ==============================================

      await validateFinishedStockConsistency(tx, finishedStock);

      // ==============================================
      // 4. DIFFÉRENCE
      // ==============================================

      const previousQuantity = finishedStock.quantity;
      const difference = input.actualQuantity - previousQuantity;

      // ==============================================
      // 5. AUCUN CHANGEMENT
      // ==============================================

      if (difference === 0) {
        throw new StockServiceError(
          "NO_ADJUSTMENT_NEEDED",
          "La quantité réelle correspond déjà au stock enregistré.",
        );
      }

      // ==============================================
      // 6. DIMINUTION
      // ==============================================

      if (difference < 0) {
        await consumeLotsForAdjustment(
          tx,
          finishedStock.id,
          Math.abs(difference),
        );
      }

      // ==============================================
      // 7. MISE À JOUR STOCK
      // ==============================================

      const updated = await tx.finishedStock.updateMany({
        where: {
          id: finishedStock.id,
          quantity: previousQuantity,
        },

        data: {
          quantity: input.actualQuantity,
        },
      });

      if (updated.count !== 1) {
        throw new StockServiceError(
          "STOCK_CONCURRENT_UPDATE",
          "Le stock a été modifié par une autre opération. Veuillez actualiser puis réessayer.",
        );
      }

      // ==============================================
      // 8. ENTRÉE AJUSTEMENT
      // ==============================================

      const entry = await tx.finishedStockEntry.create({
        data: {
          finishedStockId: finishedStock.id,
          quantity: difference,
          origin: "AJUSTEMENT",
          note: input.note?.trim() || null,
          createdById: manager.id,
        },
      });

      // ==============================================
      // 9. LOT POUR AUGMENTATION
      // ==============================================

      if (difference > 0) {
        await tx.finishedStockLot.create({
          data: {
            finishedStockId: finishedStock.id,
            entryId: entry.id,
            quantity: difference,
            remainingQuantity: difference,
            expiresAt: null,
          },
        });
      }

      // ==============================================
      // 10. VÉRIFICATION FINALE
      // ==============================================

      const finalStock = await tx.finishedStock.findUnique({
        where: {
          id: finishedStock.id,
        },
      });

      if (!finalStock) {
        throw new StockServiceError(
          "STOCK_NOT_FOUND",
          "Le stock après ajustement est introuvable.",
        );
      }

      await validateFinishedStockConsistency(tx, finalStock);

      // ==============================================
      // 11. RÉSULTAT DE L'AJUSTEMENT
      // ==============================================

      return {
        finishedStockId: finishedStock.id,
        previousQuantity,
        actualQuantity: input.actualQuantity,
        difference,
        entryId: entry.id,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  // ====================================================
  // STOCK MIS À JOUR
  // ====================================================

  const updatedStock = await getStockByVariant(manager.id, input.variantId, {
    pointOfSaleId: pointOfSaleId ?? undefined,
  });

  // ====================================================
  // RÉSULTAT FINAL
  // ====================================================

  return {
    ...updatedStock,
    adjustment: {
      finishedStockId: result.finishedStockId,
      previousQuantity: result.previousQuantity,
      actualQuantity: result.actualQuantity,
      difference: result.difference,
      entryId: result.entryId,
    },
  };
}
