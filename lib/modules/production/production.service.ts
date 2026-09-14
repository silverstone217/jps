import { Prisma } from "@/app/generated/prisma/client";

import {
  CreateProductionInput,
  ProductionQueryInput,
} from "./production.schema";

import { prisma } from "@/lib/prisma";

// ======================================================
// ERREURS MÉTIER
// ======================================================

export class ProductionServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProductionServiceError";
  }
}

// ======================================================
// HELPERS
// ======================================================

function decimalToNumber(value: Prisma.Decimal | number): number {
  return Number(value);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ======================================================
// SHOP PRINCIPALE
// ======================================================

async function getMainShop() {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
  });

  if (!shop) {
    throw new ProductionServiceError(
      "SHOP_NOT_FOUND",
      "La boutique principale est introuvable.",
    );
  }

  return shop;
}

// ======================================================
// VALIDATION DES MATIÈRES PREMIÈRES
// ======================================================

async function validateIngredients(
  shopId: string,
  ingredients: CreateProductionInput["ingredients"],
) {
  const ingredientIds = ingredients.map((item) => item.ingredientId);

  const records = await prisma.rawIngredient.findMany({
    where: {
      id: {
        in: ingredientIds,
      },
      shopId,
    },
  });

  const byId = new Map(records.map((item) => [item.id, item]));

  for (const item of ingredients) {
    const ingredient = byId.get(item.ingredientId);

    if (!ingredient) {
      throw new ProductionServiceError(
        "INGREDIENT_NOT_FOUND",
        "Une matière première sélectionnée est introuvable.",
      );
    }

    if (!ingredient.isActive) {
      throw new ProductionServiceError(
        "INGREDIENT_INACTIVE",
        `La matière première "${ingredient.name}" est désactivée.`,
      );
    }

    const currentStock = decimalToNumber(ingredient.stockQty);

    if (currentStock < item.quantityUsed) {
      throw new ProductionServiceError(
        "INSUFFICIENT_INGREDIENT_STOCK",
        `Stock insuffisant pour "${ingredient.name}". Stock disponible : ${currentStock}. Quantité demandée : ${item.quantityUsed}.`,
      );
    }
  }

  return byId;
}

// ======================================================
// VALIDATION DES EMBALLAGES
// ======================================================

async function validatePackagings(
  shopId: string,
  packagings: CreateProductionInput["packagings"],
) {
  const packagingIds = packagings.map((item) => item.packagingId);

  const records = await prisma.packaging.findMany({
    where: {
      id: {
        in: packagingIds,
      },
      shopId,
    },
  });

  const byId = new Map(records.map((item) => [item.id, item]));

  for (const item of packagings) {
    const packaging = byId.get(item.packagingId);

    if (!packaging) {
      throw new ProductionServiceError(
        "PACKAGING_NOT_FOUND",
        "Un emballage sélectionné est introuvable.",
      );
    }

    if (!packaging.isActive) {
      throw new ProductionServiceError(
        "PACKAGING_INACTIVE",
        `L'emballage "${packaging.name}" est désactivé.`,
      );
    }

    if (Number(packaging.stockQty) < item.quantityUsed) {
      throw new ProductionServiceError(
        "INSUFFICIENT_PACKAGING_STOCK",
        `Stock insuffisant pour "${packaging.name}". Stock disponible : ${packaging.stockQty}. Quantité demandée : ${item.quantityUsed}.`,
      );
    }
  }

  return byId;
}

// ======================================================
// VALIDATION DES VARIANTES
// ======================================================

async function validateProductionItems(
  shopId: string,
  items: CreateProductionInput["items"],
) {
  const variantIds = items.map((item) => item.variantId);

  const variants = await prisma.productVariant.findMany({
    where: {
      id: {
        in: variantIds,
      },
      product: {
        shopId,
      },
    },
    include: {
      product: {
        include: {
          recipe: {
            include: {
              items: true,
            },
          },
        },
      },
      packaging: true,
    },
  });

  const byId = new Map(variants.map((variant) => [variant.id, variant]));

  for (const item of items) {
    const variant = byId.get(item.variantId);

    if (!variant) {
      throw new ProductionServiceError(
        "VARIANT_NOT_FOUND",
        "Une variante de produit sélectionnée est introuvable.",
      );
    }

    if (!variant.isActive) {
      throw new ProductionServiceError(
        "VARIANT_INACTIVE",
        `La variante "${variant.sku}" est désactivée.`,
      );
    }

    if (!variant.product.isActive) {
      throw new ProductionServiceError(
        "PRODUCT_INACTIVE",
        `Le produit "${variant.product.name}" est désactivé.`,
      );
    }

    if (!variant.product.recipe) {
      throw new ProductionServiceError(
        "RECIPE_NOT_FOUND",
        `Le produit "${variant.product.name}" ne possède pas encore de recette.`,
      );
    }
  }

  const productIds = new Set(variants.map((variant) => variant.productId));

  if (productIds.size !== 1) {
    throw new ProductionServiceError(
      "MULTIPLE_PRODUCTS",
      "Une production ne peut concerner qu'un seul produit.",
    );
  }

  return {
    byId,
    variants,
    product: variants[0].product,
  };
}

// ======================================================
// COHÉRENCE EMBALLAGES / PRODUITS
// ======================================================

function validatePackagingUsage(
  items: CreateProductionInput["items"],
  variants: Awaited<ReturnType<typeof validateProductionItems>>["byId"],
  packagings: CreateProductionInput["packagings"],
) {
  const requiredByPackaging = new Map<string, number>();

  for (const item of items) {
    const variant = variants.get(item.variantId);

    if (!variant) {
      throw new ProductionServiceError(
        "VARIANT_NOT_FOUND",
        "Une variante de produit est introuvable.",
      );
    }

    const packagingId = variant.packagingId;

    const current = requiredByPackaging.get(packagingId) ?? 0;

    requiredByPackaging.set(packagingId, current + item.quantityProduced);
  }

  const declaredByPackaging = new Map<string, number>();

  for (const item of packagings) {
    declaredByPackaging.set(item.packagingId, item.quantityUsed);
  }

  for (const [packagingId, requiredQuantity] of requiredByPackaging) {
    const declaredQuantity = declaredByPackaging.get(packagingId) ?? 0;

    if (declaredQuantity < requiredQuantity) {
      throw new ProductionServiceError(
        "INSUFFICIENT_DECLARED_PACKAGING",
        "La quantité d'emballages déclarée ne couvre pas la quantité de produits à fabriquer.",
      );
    }
  }

  return true;
}

// ======================================================
// CRÉER UNE PRODUCTION
// ======================================================

export async function createProduction(
  managerId: string,
  input: CreateProductionInput,
) {
  // ====================================================
  // SHOP
  // ====================================================

  const shop = await getMainShop();

  // ====================================================
  // UTILISATEUR
  // ====================================================

  const manager = await prisma.user.findUnique({
    where: {
      id: managerId,
    },
    select: {
      id: true,
      role: true,
      isActive: true,
      isBanned: true,
      banExpiresAt: true,
    },
  });

  if (!manager) {
    throw new ProductionServiceError(
      "USER_NOT_FOUND",
      "L'utilisateur est introuvable.",
    );
  }

  if (manager.role !== "MANAGER") {
    throw new ProductionServiceError(
      "FORBIDDEN",
      "Seul un manager peut enregistrer une production.",
    );
  }

  if (!manager.isActive) {
    throw new ProductionServiceError(
      "USER_INACTIVE",
      "Votre compte est désactivé.",
    );
  }

  if (manager.isBanned) {
    const banStillActive =
      !manager.banExpiresAt || manager.banExpiresAt > new Date();

    if (banStillActive) {
      throw new ProductionServiceError(
        "USER_BANNED",
        "Votre compte est actuellement suspendu.",
      );
    }
  }

  // ====================================================
  // MATIÈRES PREMIÈRES
  // ====================================================

  const ingredients = await validateIngredients(shop.id, input.ingredients);

  // ====================================================
  // EMBALLAGES
  // ====================================================

  const packagings = await validatePackagings(shop.id, input.packagings);

  // ====================================================
  // PRODUITS FINIS
  // ====================================================

  const productionItems = await validateProductionItems(shop.id, input.items);

  // ====================================================
  // COHÉRENCE EMBALLAGES / PRODUITS
  // ====================================================

  validatePackagingUsage(input.items, productionItems.byId, input.packagings);

  // ====================================================
  // DATE DE PRODUCTION
  // ====================================================

  const producedAt = new Date();

  // ====================================================
  // TRANSACTION ATOMIQUE
  // ====================================================

  const production = await prisma.$transaction(async (tx) => {
    // ==============================================
    // 1. CRÉER LA PRODUCTION
    // ==============================================

    const createdProduction = await tx.production.create({
      data: {
        managerId,
        totalVolumeMl: input.totalVolumeMl,
        notes: input.notes?.trim() || null,
        producedAt,
      },
    });

    // ==============================================
    // 2. CONSOMMER LES MATIÈRES PREMIÈRES
    // ==============================================

    for (const item of input.ingredients) {
      const ingredient = ingredients.get(item.ingredientId);

      if (!ingredient) {
        throw new ProductionServiceError(
          "INGREDIENT_NOT_FOUND",
          "Une matière première est introuvable.",
        );
      }

      const updated = await tx.rawIngredient.updateMany({
        where: {
          id: item.ingredientId,
          shopId: shop.id,
          isActive: true,
          stockQty: {
            gte: item.quantityUsed,
          },
        },
        data: {
          stockQty: {
            decrement: item.quantityUsed,
          },
        },
      });

      if (updated.count !== 1) {
        throw new ProductionServiceError(
          "INSUFFICIENT_INGREDIENT_STOCK",
          `Stock insuffisant pour "${ingredient.name}".`,
        );
      }

      await tx.productionIngredient.create({
        data: {
          productionId: createdProduction.id,
          ingredientId: item.ingredientId,
          quantityUsed: item.quantityUsed,
        },
      });
    }

    // ==============================================
    // 3. CONSOMMER LES EMBALLAGES
    // ==============================================

    for (const item of input.packagings) {
      const packaging = packagings.get(item.packagingId);

      if (!packaging) {
        throw new ProductionServiceError(
          "PACKAGING_NOT_FOUND",
          "Un emballage est introuvable.",
        );
      }

      const updated = await tx.packaging.updateMany({
        where: {
          id: item.packagingId,
          shopId: shop.id,
          isActive: true,
          stockQty: {
            gte: item.quantityUsed,
          },
        },
        data: {
          stockQty: {
            decrement: item.quantityUsed,
          },
        },
      });

      if (updated.count !== 1) {
        throw new ProductionServiceError(
          "INSUFFICIENT_PACKAGING_STOCK",
          `Stock insuffisant pour "${packaging.name}".`,
        );
      }

      await tx.productionPackaging.create({
        data: {
          productionId: createdProduction.id,
          packagingId: item.packagingId,
          quantityUsed: item.quantityUsed,
        },
      });
    }

    // ==============================================
    // 4. CRÉER LES PRODUITS FINIS
    // ==============================================

    for (const item of input.items) {
      const variant = productionItems.byId.get(item.variantId);

      if (!variant) {
        throw new ProductionServiceError(
          "VARIANT_NOT_FOUND",
          "Une variante de produit est introuvable.",
        );
      }

      // ============================================
      // EXPIRATION
      // ============================================

      const expiresAt = addDays(producedAt, variant.shelfLifeDays);

      // ============================================
      // PRODUCTION ITEM
      // ============================================

      const createdItem = await tx.productionItem.create({
        data: {
          productionId: createdProduction.id,
          variantId: item.variantId,
          quantityProduced: item.quantityProduced,
          remainingQuantity: item.quantityProduced,
          expiresAt,
        },
      });

      // ============================================
      // STOCK FINI CENTRAL
      //
      // shopId = boutique principale
      // pointOfSaleId = null
      //
      // La production alimente le stock central.
      // ============================================

      let finishedStock = await tx.finishedStock.findFirst({
        where: {
          shopId: shop.id,
          pointOfSaleId: null,
          variantId: item.variantId,
        },
      });

      if (finishedStock) {
        finishedStock = await tx.finishedStock.update({
          where: {
            id: finishedStock.id,
          },
          data: {
            quantity: {
              increment: item.quantityProduced,
            },
          },
        });
      } else {
        finishedStock = await tx.finishedStock.create({
          data: {
            shopId: shop.id,
            pointOfSaleId: null,
            variantId: item.variantId,
            quantity: item.quantityProduced,
          },
        });
      }

      // ============================================
      // ENTRÉE DE STOCK
      // ============================================

      const entry = await tx.finishedStockEntry.create({
        data: {
          finishedStockId: finishedStock.id,
          quantity: item.quantityProduced,
          origin: "PRODUCTION",
          note: input.notes?.trim() || null,
          createdById: managerId,
          productionItemId: createdItem.id,
        },
      });

      // ============================================
      // LOT
      // ============================================

      await tx.finishedStockLot.create({
        data: {
          finishedStockId: finishedStock.id,
          entryId: entry.id,
          quantity: item.quantityProduced,
          remainingQuantity: item.quantityProduced,
          expiresAt,
        },
      });
    }

    // ==============================================
    // 5. RETOURNER LA PRODUCTION COMPLÈTE
    // ==============================================

    return tx.production.findUnique({
      where: {
        id: createdProduction.id,
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            telephone: true,
          },
        },

        ingredients: {
          include: {
            ingredient: true,
          },
        },

        packagings: {
          include: {
            packaging: true,
          },
        },

        items: {
          include: {
            variant: {
              include: {
                product: true,
                packaging: true,
              },
            },
          },
        },
      },
    });
  });

  if (!production) {
    throw new ProductionServiceError(
      "PRODUCTION_NOT_FOUND",
      "La production créée est introuvable.",
    );
  }

  return production;
}

// ======================================================
// RÉCUPÉRER UNE PRODUCTION
// ======================================================

export async function getProductionById(productionId: string) {
  const production = await prisma.production.findUnique({
    where: {
      id: productionId,
    },
    include: {
      manager: {
        select: {
          id: true,
          name: true,
          telephone: true,
        },
      },

      ingredients: {
        include: {
          ingredient: true,
        },
      },

      packagings: {
        include: {
          packaging: true,
        },
      },

      items: {
        include: {
          variant: {
            include: {
              product: true,
              packaging: true,
            },
          },
        },
      },
    },
  });

  if (!production) {
    throw new ProductionServiceError(
      "PRODUCTION_NOT_FOUND",
      "La production est introuvable.",
    );
  }

  return production;
}

// ======================================================
// LISTE DES PRODUCTIONS
// ======================================================

export async function getProductions(
  query: Partial<ProductionQueryInput> = {},
) {
  const { productId, from, to, limit = 20, page = 1 } = query;

  const shop = await getMainShop();

  // ====================================================
  // FILTRES
  // ====================================================

  const where: Prisma.ProductionWhereInput = {};

  // ====================================================
  // FILTRE PRODUIT
  // ====================================================

  if (productId) {
    where.items = {
      some: {
        variant: {
          productId,
        },
      },
    };
  }

  // ====================================================
  // FILTRE DATE
  // ====================================================

  if (from || to) {
    where.producedAt = {};

    if (from) {
      const fromDate = new Date(from);

      if (Number.isNaN(fromDate.getTime())) {
        throw new ProductionServiceError(
          "INVALID_FROM_DATE",
          "La date de début est invalide.",
        );
      }

      where.producedAt.gte = fromDate;
    }

    if (to) {
      const toDate = new Date(to);

      if (Number.isNaN(toDate.getTime())) {
        throw new ProductionServiceError(
          "INVALID_TO_DATE",
          "La date de fin est invalide.",
        );
      }

      where.producedAt.lte = toDate;
    }
  }

  // ====================================================
  // PAGINATION
  // ====================================================

  const skip = (page - 1) * limit;

  const [productions, total] = await prisma.$transaction([
    prisma.production.findMany({
      where,

      orderBy: {
        producedAt: "desc",
      },

      skip,
      take: limit,

      include: {
        manager: {
          select: {
            id: true,
            name: true,
            telephone: true,
          },
        },

        ingredients: {
          include: {
            ingredient: true,
          },
        },

        packagings: {
          include: {
            packaging: true,
          },
        },

        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    shopId: true,
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
      },
    }),

    prisma.production.count({
      where,
    }),
  ]);

  // ====================================================
  // SÉCURITÉ : LES PRODUCTIONS APPARTIENNENT À LA SHOP
  // ====================================================
  //
  // Le modèle Production ne possède plus shopId.
  // La boutique est donc déterminée via les produits
  // associés à la production.
  //
  // Comme une production ne peut concerner qu'un seul
  // produit, product.shopId permet de conserver cette
  // information dans la réponse.
  //
  // Le filtre shopId est donc effectué côté résultat.

  const shopProductions = productions.filter((production) => {
    const firstItem = production.items[0];

    return firstItem?.variant.product?.shopId === shop.id;
  });

  return {
    productions: shopProductions,

    pagination: {
      page,
      limit,
      total:
        shopProductions.length < productions.length
          ? shopProductions.length
          : total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
