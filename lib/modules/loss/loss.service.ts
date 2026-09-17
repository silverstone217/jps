import { Prisma } from "@/app/generated/prisma/client";

import type { CreateLossInput } from "@/lib/modules/loss/loss.schema";

import { prisma } from "@/lib/prisma";

// ============================================================
// TYPES
// ============================================================

export type LossQueryInput = {
  page?: number;
  limit?: number;
  category?: "RAW_INGREDIENT" | "PACKAGING" | "FINISHED_PRODUCT";
  reason?: "EXPIRED" | "DAMAGED" | "STOLEN" | "QUAL_REJECT" | "OTHER";
  pointOfSaleId?: string;
};

export class LossServiceError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "LossServiceError";
  }
}

// ============================================================
// HELPERS
// ============================================================

async function getMainShop() {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!shop) {
    throw new LossServiceError(
      "SHOP_NOT_FOUND",
      "La boutique principale est introuvable.",
    );
  }

  return shop;
}

async function validateManager(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
      isActive: true,
      isBanned: true,
      banExpiresAt: true,
    },
  });

  if (!user) {
    throw new LossServiceError("USER_NOT_FOUND", "Utilisateur introuvable.");
  }

  if (user.role !== "MANAGER") {
    throw new LossServiceError(
      "FORBIDDEN",
      "Seul un manager peut gérer les pertes.",
    );
  }

  if (!user.isActive) {
    throw new LossServiceError(
      "USER_INACTIVE",
      "Ce compte utilisateur est inactif.",
    );
  }

  if (user.isBanned && (!user.banExpiresAt || user.banExpiresAt > new Date())) {
    throw new LossServiceError(
      "USER_BANNED",
      "Ce compte utilisateur est temporairement bloqué.",
    );
  }

  return user;
}

async function validatePointOfSale(shopId: string, pointOfSaleId: string) {
  const pointOfSale = await prisma.pointOfSale.findFirst({
    where: {
      id: pointOfSaleId,
      shopId,
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      isMainStore: true,
    },
  });

  if (!pointOfSale) {
    throw new LossServiceError(
      "POINT_OF_SALE_NOT_FOUND",
      "Point de vente introuvable.",
    );
  }

  if (!pointOfSale.isActive) {
    throw new LossServiceError(
      "POINT_OF_SALE_INACTIVE",
      "Ce point de vente est inactif.",
    );
  }

  return pointOfSale;
}

// ============================================================
// GET LOSSES
// ============================================================

export async function getLosses(userId: string, query: LossQueryInput = {}) {
  await validateManager(userId);

  const shop = await getMainShop();

  const page = Math.max(1, query.page ?? 1);

  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  const where: Prisma.LossWhereInput = {
    shopId: shop.id,
  };

  if (query.category) {
    where.category = query.category;
  }

  if (query.reason) {
    where.reason = query.reason;
  }

  if (query.pointOfSaleId) {
    await validatePointOfSale(shop.id, query.pointOfSaleId);

    where.pointOfSaleId = query.pointOfSaleId;
  }

  const skip = (page - 1) * limit;

  const [items, total] = await prisma.$transaction([
    prisma.loss.findMany({
      where,
      orderBy: {
        reportedAt: "desc",
      },
      skip,
      take: limit,
      include: {
        pointOfSale: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },

        ingredient: {
          select: {
            id: true,
            name: true,
            unit: true,
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

        variant: {
          select: {
            id: true,
            sku: true,
            price: true,
            product: {
              select: {
                id: true,
                name: true,
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

        finishedStockLot: {
          select: {
            id: true,
            quantity: true,
            remainingQuantity: true,
            expiresAt: true,
            createdAt: true,

            entry: {
              select: {
                id: true,
                origin: true,
                productionItemId: true,
                createdAt: true,
              },
            },
          },
        },

        reportedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),

    prisma.loss.count({
      where,
    }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    },
  };
}

// ============================================================
// GET PENDING EXPIRED FINISHED PRODUCTS
// ============================================================

export async function getPendingLosses(userId: string) {
  await validateManager(userId);

  const shop = await getMainShop();

  const now = new Date();

  const lots = await prisma.finishedStockLot.findMany({
    where: {
      remainingQuantity: {
        gt: 0,
      },

      expiresAt: {
        lte: now,
      },

      finishedStock: {
        shopId: shop.id,
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
      finishedStock: {
        select: {
          id: true,
          shopId: true,
          pointOfSaleId: true,
          quantity: true,

          pointOfSale: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },

          variant: {
            select: {
              id: true,
              sku: true,
              shelfLifeDays: true,

              product: {
                select: {
                  id: true,
                  name: true,
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
        },
      },

      entry: {
        select: {
          id: true,
          origin: true,
          productionItemId: true,
          createdAt: true,

          productionItem: {
            select: {
              id: true,
              productionId: true,
              quantityProduced: true,
              remainingQuantity: true,
              expiresAt: true,

              production: {
                select: {
                  id: true,
                  producedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return lots.map((lot) => ({
    id: lot.id,
    finishedStockId: lot.finishedStockId,
    entryId: lot.entryId,

    quantity: lot.quantity,
    remainingQuantity: lot.remainingQuantity,

    expiresAt: lot.expiresAt,
    createdAt: lot.createdAt,

    pointOfSale: lot.finishedStock.pointOfSale,

    variant: lot.finishedStock.variant,

    productionItem: lot.entry.productionItem,
  }));
}

// ============================================================
// CREATE MANUAL LOSS
// ============================================================

export async function createLoss(userId: string, input: CreateLossInput) {
  await validateManager(userId);

  const shop = await getMainShop();

  return prisma.$transaction(async (tx) => {
    // ======================================================
    // MATIÈRE PREMIÈRE
    // ======================================================

    if (input.category === "RAW_INGREDIENT") {
      const ingredient = await tx.rawIngredient.findFirst({
        where: {
          id: input.ingredientId,
          shopId: shop.id,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          unit: true,
          stockQty: true,
        },
      });

      if (!ingredient) {
        throw new LossServiceError(
          "INGREDIENT_NOT_FOUND",
          "Matière première introuvable.",
        );
      }

      const quantity = new Prisma.Decimal(input.quantity);

      if (ingredient.stockQty.lt(quantity)) {
        throw new LossServiceError(
          "INSUFFICIENT_INGREDIENT_STOCK",
          `Stock insuffisant pour ${ingredient.name}.`,
        );
      }

      const loss = await tx.loss.create({
        data: {
          shopId: shop.id,
          category: "RAW_INGREDIENT",
          reason: input.reason,
          note: input.note,
          ingredientId: ingredient.id,
          quantity,
          reportedById: userId,
        },
      });

      await tx.rawIngredient.update({
        where: {
          id: ingredient.id,
        },
        data: {
          stockQty: {
            decrement: quantity,
          },
        },
      });

      await tx.rawMaterialHistory.create({
        data: {
          shopId: shop.id,
          ingredientId: ingredient.id,
          quantity: quantity.neg(),
          type: "LOSS",
          note: input.note ?? `Perte : ${input.reason}`,
          createdById: userId,
        },
      });

      return loss;
    }

    // ======================================================
    // PACKAGING
    // ======================================================

    if (input.category === "PACKAGING") {
      const packaging = await tx.packaging.findFirst({
        where: {
          id: input.packagingId,
          shopId: shop.id,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          size: true,
          capacityMl: true,
          stockQty: true,
        },
      });

      if (!packaging) {
        throw new LossServiceError(
          "PACKAGING_NOT_FOUND",
          "Packaging introuvable.",
        );
      }

      const quantity = input.quantity;

      if (!Number.isInteger(quantity)) {
        throw new LossServiceError(
          "INVALID_PACKAGING_QUANTITY",
          "La quantité de packaging doit être un nombre entier.",
        );
      }

      if (packaging.stockQty < quantity) {
        throw new LossServiceError(
          "INSUFFICIENT_PACKAGING_STOCK",
          `Stock insuffisant pour ${packaging.name}.`,
        );
      }

      const loss = await tx.loss.create({
        data: {
          shopId: shop.id,
          category: "PACKAGING",
          reason: input.reason,
          note: input.note,
          packagingId: packaging.id,
          quantity,
          reportedById: userId,
        },
      });

      await tx.packaging.update({
        where: {
          id: packaging.id,
        },
        data: {
          stockQty: {
            decrement: quantity,
          },
        },
      });

      await tx.rawMaterialHistory.create({
        data: {
          shopId: shop.id,
          packagingId: packaging.id,
          quantity: new Prisma.Decimal(quantity).neg(),
          type: "LOSS",
          note: input.note ?? `Perte : ${input.reason}`,
          createdById: userId,
        },
      });

      return loss;
    }

    // ======================================================
    // PRODUIT FINI
    // ======================================================

    const lot = await tx.finishedStockLot.findFirst({
      where: {
        id: input.finishedStockLotId,

        finishedStock: {
          shopId: shop.id,
          variantId: input.variantId,

          ...(input.pointOfSaleId !== undefined
            ? {
                pointOfSaleId: input.pointOfSaleId,
              }
            : {}),
        },
      },

      select: {
        id: true,
        finishedStockId: true,
        quantity: true,
        remainingQuantity: true,
        expiresAt: true,

        finishedStock: {
          select: {
            id: true,
            shopId: true,
            pointOfSaleId: true,
            variantId: true,
            quantity: true,
          },
        },
      },
    });

    if (!lot) {
      throw new LossServiceError(
        "FINISHED_STOCK_LOT_NOT_FOUND",
        "Le lot de produits finis est introuvable.",
      );
    }

    const quantity = input.quantity;

    if (!Number.isInteger(quantity)) {
      throw new LossServiceError(
        "INVALID_FINISHED_PRODUCT_QUANTITY",
        "La quantité de produits finis doit être un nombre entier.",
      );
    }

    if (lot.remainingQuantity < quantity) {
      throw new LossServiceError(
        "INSUFFICIENT_FINISHED_STOCK_LOT",
        "La quantité demandée dépasse la quantité disponible dans ce lot.",
      );
    }

    if (lot.finishedStock.quantity < quantity) {
      throw new LossServiceError(
        "INCONSISTENT_FINISHED_STOCK",
        "Le stock fini est incohérent avec la quantité disponible dans le lot.",
      );
    }

    const loss = await tx.loss.create({
      data: {
        shopId: shop.id,
        category: "FINISHED_PRODUCT",
        reason: input.reason,
        note: input.note,
        pointOfSaleId: lot.finishedStock.pointOfSaleId,
        variantId: input.variantId,
        finishedStockLotId: lot.id,
        quantity,
        reportedById: userId,
      },
    });

    await tx.finishedStockLot.update({
      where: {
        id: lot.id,
      },
      data: {
        remainingQuantity: {
          decrement: quantity,
        },
      },
    });

    await tx.finishedStock.update({
      where: {
        id: lot.finishedStockId,
      },
      data: {
        quantity: {
          decrement: quantity,
        },
      },
    });

    return loss;
  });
}

// ============================================================
// CREATE LOSSES FOR EXPIRED LOTS
// ============================================================

export async function createExpiredLosses(userId: string) {
  await validateManager(userId);

  const shop = await getMainShop();

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const lots = await tx.finishedStockLot.findMany({
      where: {
        remainingQuantity: {
          gt: 0,
        },

        expiresAt: {
          lte: now,
        },

        finishedStock: {
          shopId: shop.id,
        },
      },

      select: {
        id: true,
        finishedStockId: true,
        remainingQuantity: true,

        finishedStock: {
          select: {
            shopId: true,
            pointOfSaleId: true,
            variantId: true,
            quantity: true,
          },
        },
      },
    });

    if (lots.length === 0) {
      return {
        count: 0,
        quantity: 0,
        losses: [],
      };
    }

    const losses = [];

    let totalQuantity = 0;

    for (const lot of lots) {
      const quantity = lot.remainingQuantity;

      if (lot.finishedStock.quantity < quantity) {
        throw new LossServiceError(
          "INCONSISTENT_FINISHED_STOCK",
          "Le stock fini est incohérent avec les lots expirés.",
        );
      }

      const loss = await tx.loss.create({
        data: {
          shopId: shop.id,
          category: "FINISHED_PRODUCT",
          reason: "EXPIRED",
          pointOfSaleId: lot.finishedStock.pointOfSaleId,
          variantId: lot.finishedStock.variantId,
          finishedStockLotId: lot.id,
          quantity,
          reportedById: userId,
          note: "Produit arrivé à expiration.",
        },
      });

      await tx.finishedStockLot.update({
        where: {
          id: lot.id,
        },
        data: {
          remainingQuantity: 0,
        },
      });

      await tx.finishedStock.update({
        where: {
          id: lot.finishedStockId,
        },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });

      losses.push(loss);

      totalQuantity += quantity;
    }

    return {
      count: losses.length,
      quantity: totalQuantity,
      losses,
    };
  });
}
