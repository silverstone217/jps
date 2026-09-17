import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { StockLocationInput, StockQueryInput } from "./stock.schema";

// ======================================================
// ERREURS DU SERVICE
// ======================================================

export class StockServiceError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "StockServiceError";
  }
}

// ======================================================
// TYPES
// ======================================================

// type StockLocation = {
//   type: "MAIN" | "POS";
//   pointOfSaleId: string | null;
//   pointOfSaleName: string | null;
// };

type Pagination = {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

// ======================================================
// UTILITAIRES
// ======================================================

const decimalToNumber = (value: Prisma.Decimal) => {
  return value.toNumber();
};

const normalizeSearch = (search?: string) => {
  const value = search?.trim();

  return value || undefined;
};

const buildPagination = (
  page: number,
  limit: number,
  total: number,
): Pagination => {
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
};

// ======================================================
// UTILISATEUR
// ======================================================

const getUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      role: true,
      isActive: true,
      isBanned: true,

      shopOwner: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          currency: true,
        },
      },

      assignments: {
        where: {
          isActive: true,
        },

        orderBy: {
          createdAt: "asc",
        },

        select: {
          id: true,
          shopId: true,
          pointOfSaleId: true,

          pointOfSale: {
            select: {
              id: true,
              name: true,
              code: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new StockServiceError("USER_NOT_FOUND", "Utilisateur introuvable.");
  }

  if (!user.isActive) {
    throw new StockServiceError("USER_INACTIVE", "Votre compte est désactivé.");
  }

  if (user.isBanned) {
    throw new StockServiceError(
      "USER_BANNED",
      "Votre compte est actuellement bloqué.",
    );
  }

  return user;
};

// ======================================================
// BOUTIQUE PRINCIPALE
// ======================================================

const getMainShop = async () => {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },

    select: {
      id: true,
      name: true,
      ownerId: true,
      currency: true,
    },
  });

  if (!shop) {
    throw new StockServiceError(
      "SHOP_NOT_FOUND",
      "La boutique principale est introuvable.",
    );
  }

  return shop;
};

// ======================================================
// AUTORISATION MANAGER
// ======================================================

const validateManagerAccess = (userId: string, shopOwnerId: string | null) => {
  if (shopOwnerId !== userId) {
    throw new StockServiceError(
      "FORBIDDEN",
      "Vous n'êtes pas autorisé à consulter le stock de cette boutique.",
    );
  }
};

// ======================================================
// POINT DE VENTE
// ======================================================

const getPointOfSale = async (pointOfSaleId: string, shopId: string) => {
  const pointOfSale = await prisma.pointOfSale.findFirst({
    where: {
      id: pointOfSaleId,
      shopId,
    },

    select: {
      id: true,
      shopId: true,
      name: true,
      code: true,
      telephone: true,
      address: true,
      isMainStore: true,
      isActive: true,
    },
  });

  if (!pointOfSale) {
    throw new StockServiceError(
      "POS_NOT_FOUND",
      "Le point de vente demandé est introuvable.",
    );
  }

  if (!pointOfSale.isActive) {
    throw new StockServiceError(
      "POS_INACTIVE",
      "Ce point de vente est actuellement désactivé.",
    );
  }

  return pointOfSale;
};

// ======================================================
// RÉSOUDRE L'EMPLACEMENT
// ======================================================

const resolveStockLocation = async (
  userId: string,
  location?: StockLocationInput,
) => {
  const user = await getUser(userId);
  const shop = await getMainShop();

  // ====================================================
  // MANAGER
  // ====================================================

  if (user.role === "MANAGER") {
    validateManagerAccess(user.id, shop.ownerId);

    if (!location) {
      return {
        user,
        shop,

        stockLocation: {
          type: "MAIN" as const,
          pointOfSaleId: null,
          pointOfSaleName: null,
        },
      };
    }

    if (location.locationType === "MAIN") {
      return {
        user,
        shop,

        stockLocation: {
          type: "MAIN" as const,
          pointOfSaleId: null,
          pointOfSaleName: null,
        },
      };
    }

    if (!location.pointOfSaleId) {
      throw new StockServiceError(
        "POS_REQUIRED",
        "Le point de vente est requis.",
      );
    }

    const pointOfSale = await getPointOfSale(location.pointOfSaleId, shop.id);

    return {
      user,
      shop,

      stockLocation: {
        type: "POS" as const,
        pointOfSaleId: pointOfSale.id,
        pointOfSaleName: pointOfSale.name,
      },
    };
  }

  // ====================================================
  // EMPLOYEE
  // ====================================================

  const assignment = user.assignments.find(
    (item) => item.shopId === shop.id && item.pointOfSale.isActive,
  );

  if (!assignment) {
    throw new StockServiceError(
      "POS_NOT_ASSIGNED",
      "Vous n'êtes actuellement affecté à aucun point de vente.",
    );
  }

  if (location?.locationType === "MAIN") {
    throw new StockServiceError(
      "FORBIDDEN",
      "Vous n'êtes pas autorisé à consulter le stock de la boutique principale.",
    );
  }

  if (
    location?.pointOfSaleId &&
    location.pointOfSaleId !== assignment.pointOfSaleId
  ) {
    throw new StockServiceError(
      "FORBIDDEN",
      "Vous n'êtes pas autorisé à consulter ce point de vente.",
    );
  }

  return {
    user,
    shop,

    stockLocation: {
      type: "POS" as const,
      pointOfSaleId: assignment.pointOfSaleId,
      pointOfSaleName: assignment.pointOfSale.name,
    },
  };
};

// ======================================================
// MATIÈRES PREMIÈRES
// ======================================================

const getRawIngredients = async (
  shopId: string,
  query: StockQueryInput,
): Promise<{
  items: Array<{
    id: string;
    category: "RAW_INGREDIENT";
    name: string;
    unit: string;
    quantity: number;
    minAlert: number;
    isLowStock: boolean;
    isActive: boolean;
    updatedAt: string;
  }>;
  pagination: Pagination;
}> => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const search = normalizeSearch(query.search);

  const where = {
    shopId,

    stockQty: {
      gt: 0,
    },

    ...(search && {
      name: {
        contains: search,
        mode: "insensitive" as const,
      },
    }),
  };

  // ====================================================
  // LOW STOCK
  // ====================================================
  //
  // Prisma ne permet pas ici de comparer directement
  // stockQty <= minAlert dans un where standard.
  //
  // On récupère donc les lignes correspondant aux
  // autres filtres, puis on applique le seuil avant
  // la pagination.
  //
  // Ce filtre est optionnel et reste réservé au
  // cas où l'utilisateur le demande.
  // ====================================================

  if (query.lowStock) {
    const ingredients = await prisma.rawIngredient.findMany({
      where,

      orderBy: [
        {
          stockQty: "asc",
        },
        {
          name: "asc",
        },
      ],

      select: {
        id: true,
        name: true,
        unit: true,
        stockQty: true,
        minAlert: true,
        isActive: true,
        updatedAt: true,
      },
    });

    const lowStockIngredients = ingredients.filter((ingredient) =>
      ingredient.stockQty.lte(ingredient.minAlert),
    );

    const total = lowStockIngredients.length;

    const start = (page - 1) * limit;

    const paginated = lowStockIngredients.slice(start, start + limit);

    return {
      items: paginated.map((ingredient) => ({
        id: ingredient.id,
        category: "RAW_INGREDIENT" as const,
        name: ingredient.name,
        unit: ingredient.unit,
        quantity: decimalToNumber(ingredient.stockQty),
        minAlert: decimalToNumber(ingredient.minAlert),
        isLowStock: true,
        isActive: ingredient.isActive,
        updatedAt: ingredient.updatedAt.toISOString(),
      })),

      pagination: buildPagination(page, limit, total),
    };
  }

  // ====================================================
  // PAGINATION NORMALE
  // ====================================================

  const [total, ingredients] = await Promise.all([
    prisma.rawIngredient.count({
      where,
    }),

    prisma.rawIngredient.findMany({
      where,

      orderBy: [
        {
          stockQty: "asc",
        },
        {
          name: "asc",
        },
      ],

      skip: (page - 1) * limit,

      take: limit,

      select: {
        id: true,
        name: true,
        unit: true,
        stockQty: true,
        minAlert: true,
        isActive: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    items: ingredients.map((ingredient) => {
      const quantity = decimalToNumber(ingredient.stockQty);

      const minAlert = decimalToNumber(ingredient.minAlert);

      return {
        id: ingredient.id,
        category: "RAW_INGREDIENT" as const,
        name: ingredient.name,
        unit: ingredient.unit,
        quantity,
        minAlert,
        isLowStock: quantity <= minAlert,
        isActive: ingredient.isActive,
        updatedAt: ingredient.updatedAt.toISOString(),
      };
    }),

    pagination: buildPagination(page, limit, total),
  };
};

// ======================================================
// EMBALLAGES
// ======================================================

const getPackagings = async (
  shopId: string,
  query: StockQueryInput,
): Promise<{
  items: Array<{
    id: string;
    category: "PACKAGING";
    name: string;
    size: string;
    capacityMl: number;
    quantity: number;
    minAlert: number;
    isLowStock: boolean;
    isActive: boolean;
    updatedAt: string;
  }>;
  pagination: Pagination;
}> => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const search = normalizeSearch(query.search);

  const where = {
    shopId,

    stockQty: {
      gt: 0,
    },

    ...(search && {
      name: {
        contains: search,
        mode: "insensitive" as const,
      },
    }),
  };

  // ====================================================
  // LOW STOCK
  // ====================================================

  if (query.lowStock) {
    const packagings = await prisma.packaging.findMany({
      where,

      orderBy: [
        {
          stockQty: "asc",
        },
        {
          name: "asc",
        },
      ],

      select: {
        id: true,
        name: true,
        size: true,
        capacityMl: true,
        stockQty: true,
        minAlert: true,
        isActive: true,
        updatedAt: true,
      },
    });

    const lowStockPackagings = packagings.filter(
      (packaging) => packaging.stockQty <= packaging.minAlert,
    );

    const total = lowStockPackagings.length;

    const start = (page - 1) * limit;

    const paginated = lowStockPackagings.slice(start, start + limit);

    return {
      items: paginated.map((packaging) => ({
        id: packaging.id,
        category: "PACKAGING" as const,
        name: packaging.name,
        size: packaging.size,
        capacityMl: packaging.capacityMl,
        quantity: packaging.stockQty,
        minAlert: packaging.minAlert,
        isLowStock: true,
        isActive: packaging.isActive,
        updatedAt: packaging.updatedAt.toISOString(),
      })),

      pagination: buildPagination(page, limit, total),
    };
  }

  // ====================================================
  // PAGINATION NORMALE
  // ====================================================

  const [total, packagings] = await Promise.all([
    prisma.packaging.count({
      where,
    }),

    prisma.packaging.findMany({
      where,

      orderBy: [
        {
          stockQty: "asc",
        },
        {
          name: "asc",
        },
      ],

      skip: (page - 1) * limit,

      take: limit,

      select: {
        id: true,
        name: true,
        size: true,
        capacityMl: true,
        stockQty: true,
        minAlert: true,
        isActive: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    items: packagings.map((packaging) => ({
      id: packaging.id,
      category: "PACKAGING" as const,
      name: packaging.name,
      size: packaging.size,
      capacityMl: packaging.capacityMl,
      quantity: packaging.stockQty,
      minAlert: packaging.minAlert,
      isLowStock: packaging.stockQty <= packaging.minAlert,
      isActive: packaging.isActive,
      updatedAt: packaging.updatedAt.toISOString(),
    })),

    pagination: buildPagination(page, limit, total),
  };
};

// ======================================================
// PRODUITS FINIS
// ======================================================

const getFinishedProducts = async (
  shopId: string,
  pointOfSaleId: string | null,
  query: StockQueryInput,
): Promise<{
  items: Array<{
    id: string;
    category: "FINISHED_PRODUCT";
    variantId: string;
    productId: string;
    sku: string;
    name: string;
    image: string | null;
    quantity: number;
    price: number;
    shelfLifeDays: number;
    packaging: {
      id: string;
      name: string;
      size: string;
      capacityMl: number;
    };
    isActive: boolean;
    updatedAt: string;
  }>;
  pagination: Pagination;
}> => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const search = normalizeSearch(query.search);

  const where = {
    shopId,
    pointOfSaleId,

    quantity: {
      gt: 0,
    },

    variant: {
      isActive: true,

      product: {
        isActive: true,

        ...(search && {
          name: {
            contains: search,
            mode: "insensitive" as const,
          },
        }),
      },
    },
  };

  const [total, stocks] = await Promise.all([
    prisma.finishedStock.count({
      where,
    }),

    prisma.finishedStock.findMany({
      where,

      orderBy: {
        updatedAt: "desc",
      },

      skip: (page - 1) * limit,

      take: limit,

      select: {
        id: true,
        quantity: true,
        updatedAt: true,

        variant: {
          select: {
            id: true,
            sku: true,
            price: true,
            shelfLifeDays: true,

            product: {
              select: {
                id: true,
                name: true,
                image: true,
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
    }),
  ]);

  return {
    items: stocks.map((stock) => ({
      id: stock.id,
      category: "FINISHED_PRODUCT" as const,

      variantId: stock.variant.id,

      productId: stock.variant.product.id,

      sku: stock.variant.sku,

      name: stock.variant.product.name,

      image: stock.variant.product.image,

      quantity: stock.quantity,

      price: decimalToNumber(stock.variant.price),

      shelfLifeDays: stock.variant.shelfLifeDays,

      packaging: {
        id: stock.variant.packaging.id,

        name: stock.variant.packaging.name,

        size: stock.variant.packaging.size,

        capacityMl: stock.variant.packaging.capacityMl,
      },

      isActive: true,

      updatedAt: stock.updatedAt.toISOString(),
    })),

    pagination: buildPagination(page, limit, total),
  };
};

// ======================================================
// RÉSUMÉ GLOBAL DU STOCK
// ======================================================

const getStockSummary = async (
  shopId: string,
  pointOfSaleId: string | null,
) => {
  const [rawIngredients, packagings, finishedProducts] = await Promise.all([
    prisma.rawIngredient.findMany({
      where: {
        shopId,
        stockQty: {
          gt: 0,
        },
      },

      select: {
        stockQty: true,
        minAlert: true,
      },
    }),

    prisma.packaging.findMany({
      where: {
        shopId,
        stockQty: {
          gt: 0,
        },
      },

      select: {
        stockQty: true,
        minAlert: true,
      },
    }),

    prisma.finishedStock.findMany({
      where: {
        shopId,
        pointOfSaleId,
        quantity: {
          gt: 0,
        },
      },

      select: {
        quantity: true,
      },
    }),
  ]);

  return {
    rawIngredients: rawIngredients.length,

    packagings: packagings.length,

    finishedProducts: finishedProducts.length,

    lowStockRawIngredients: rawIngredients.filter((item) =>
      item.stockQty.lte(item.minAlert),
    ).length,

    lowStockPackagings: packagings.filter(
      (item) => item.stockQty <= item.minAlert,
    ).length,

    finishedProductQuantity: finishedProducts.reduce(
      (total, item) => total + item.quantity,
      0,
    ),
  };
};

// ======================================================
// STOCK GLOBAL
// ======================================================

export const getStock = async (userId: string, query: StockQueryInput) => {
  const requestedLocation = query.locationType
    ? {
        locationType: query.locationType,
        pointOfSaleId: query.pointOfSaleId,
      }
    : undefined;

  const { shop, stockLocation } = await resolveStockLocation(
    userId,
    requestedLocation,
  );

  const category = query.category;

  const summary = await getStockSummary(shop.id, stockLocation.pointOfSaleId);

  // ====================================================
  // MATIÈRES PREMIÈRES
  // ====================================================

  if (category === "RAW_INGREDIENT") {
    if (stockLocation.type !== "MAIN") {
      throw new StockServiceError(
        "INVALID_CATEGORY",
        "Les matières premières sont uniquement disponibles dans le stock principal.",
      );
    }

    const result = await getRawIngredients(shop.id, query);

    return {
      location: {
        type: stockLocation.type,
        pointOfSaleId: stockLocation.pointOfSaleId,
        pointOfSaleName: stockLocation.pointOfSaleName,
      },

      category,

      items: result.items,

      pagination: result.pagination,

      summary,
    };
  }

  // ====================================================
  // EMBALLAGES
  // ====================================================

  if (category === "PACKAGING") {
    if (stockLocation.type !== "MAIN") {
      throw new StockServiceError(
        "INVALID_CATEGORY",
        "Les emballages sont uniquement disponibles dans le stock principal.",
      );
    }

    const result = await getPackagings(shop.id, query);

    return {
      location: {
        type: stockLocation.type,
        pointOfSaleId: stockLocation.pointOfSaleId,
        pointOfSaleName: stockLocation.pointOfSaleName,
      },

      category,

      items: result.items,

      pagination: result.pagination,

      summary,
    };
  }

  // ====================================================
  // PRODUITS FINIS
  // ====================================================

  if (category === "FINISHED_PRODUCT") {
    const result = await getFinishedProducts(
      shop.id,
      stockLocation.pointOfSaleId,
      query,
    );

    return {
      location: {
        type: stockLocation.type,
        pointOfSaleId: stockLocation.pointOfSaleId,
        pointOfSaleName: stockLocation.pointOfSaleName,
      },

      category,

      items: result.items,

      pagination: result.pagination,

      summary,
    };
  }

  // ====================================================
  // AUCUNE CATÉGORIE
  // ====================================================
  //
  // On retourne la première page de chaque
  // catégorie.
  //
  // Le frontend peut ensuite demander :
  //
  // category=RAW_INGREDIENT
  // category=PACKAGING
  // category=FINISHED_PRODUCT
  //
  // pour continuer le scroll de chaque liste.
  // ====================================================

  const rawIngredients =
    stockLocation.type === "MAIN"
      ? await getRawIngredients(shop.id, query)
      : {
          items: [],
          pagination: buildPagination(query.page ?? 1, query.limit ?? 20, 0),
        };

  const packagings =
    stockLocation.type === "MAIN"
      ? await getPackagings(shop.id, query)
      : {
          items: [],
          pagination: buildPagination(query.page ?? 1, query.limit ?? 20, 0),
        };

  const finishedProducts = await getFinishedProducts(
    shop.id,
    stockLocation.pointOfSaleId,
    query,
  );

  return {
    location: {
      type: stockLocation.type,
      pointOfSaleId: stockLocation.pointOfSaleId,
      pointOfSaleName: stockLocation.pointOfSaleName,
    },

    categories: {
      rawIngredients: {
        items: rawIngredients.items,
        pagination: rawIngredients.pagination,
      },

      packagings: {
        items: packagings.items,
        pagination: packagings.pagination,
      },

      finishedProducts: {
        items: finishedProducts.items,
        pagination: finishedProducts.pagination,
      },
    },

    summary,
  };
};

// ======================================================
// DÉTAIL D'UNE VARIANTE
// ======================================================

export const getStockProduct = async (
  userId: string,
  variantId: string,
  location?: StockLocationInput,
) => {
  const { shop, stockLocation } = await resolveStockLocation(userId, location);

  const finishedStock = await prisma.finishedStock.findFirst({
    where: {
      shopId: shop.id,

      pointOfSaleId: stockLocation.pointOfSaleId,

      variantId,
    },

    select: {
      id: true,
      quantity: true,
      updatedAt: true,

      variant: {
        select: {
          id: true,
          sku: true,
          price: true,
          shelfLifeDays: true,
          isActive: true,

          product: {
            select: {
              id: true,
              name: true,
              description: true,
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
          updatedAt: true,

          entry: {
            select: {
              id: true,
              quantity: true,
              origin: true,
              note: true,
              createdAt: true,

              productionItem: {
                select: {
                  id: true,
                  productionId: true,
                  quantityProduced: true,
                  remainingQuantity: true,
                  expiresAt: true,
                },
              },

              createdBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },

      entries: {
        orderBy: {
          createdAt: "desc",
        },

        take: 20,

        select: {
          id: true,
          quantity: true,
          origin: true,
          note: true,
          createdAt: true,

          productionItem: {
            select: {
              id: true,
              productionId: true,
              quantityProduced: true,
              remainingQuantity: true,
              expiresAt: true,
            },
          },

          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!finishedStock) {
    throw new StockServiceError(
      "STOCK_PRODUCT_NOT_FOUND",
      "Ce produit n'existe pas dans cet emplacement de stock.",
    );
  }

  return {
    location: {
      type: stockLocation.type,
      pointOfSaleId: stockLocation.pointOfSaleId,
      pointOfSaleName: stockLocation.pointOfSaleName,
    },

    stock: {
      id: finishedStock.id,
      quantity: finishedStock.quantity,
      updatedAt: finishedStock.updatedAt.toISOString(),
    },

    product: {
      variantId: finishedStock.variant.id,

      productId: finishedStock.variant.product.id,

      sku: finishedStock.variant.sku,

      name: finishedStock.variant.product.name,

      description: finishedStock.variant.product.description,

      image: finishedStock.variant.product.image,

      price: decimalToNumber(finishedStock.variant.price),

      shelfLifeDays: finishedStock.variant.shelfLifeDays,

      isActive:
        finishedStock.variant.isActive &&
        finishedStock.variant.product.isActive,

      packaging: {
        id: finishedStock.variant.packaging.id,

        name: finishedStock.variant.packaging.name,

        size: finishedStock.variant.packaging.size,

        capacityMl: finishedStock.variant.packaging.capacityMl,
      },
    },

    lots: finishedStock.lots.map((lot) => ({
      id: lot.id,
      quantity: lot.quantity,
      remainingQuantity: lot.remainingQuantity,

      expiresAt: lot.expiresAt?.toISOString() ?? null,

      createdAt: lot.createdAt.toISOString(),

      updatedAt: lot.updatedAt.toISOString(),

      entry: {
        id: lot.entry.id,
        quantity: lot.entry.quantity,

        origin: lot.entry.origin,

        note: lot.entry.note,

        createdAt: lot.entry.createdAt.toISOString(),

        productionItem: lot.entry.productionItem
          ? {
              id: lot.entry.productionItem.id,

              productionId: lot.entry.productionItem.productionId,

              quantityProduced: lot.entry.productionItem.quantityProduced,

              remainingQuantity: lot.entry.productionItem.remainingQuantity,

              expiresAt: lot.entry.productionItem.expiresAt.toISOString(),
            }
          : null,

        createdBy: {
          id: lot.entry.createdBy.id,

          name: lot.entry.createdBy.name,
        },
      },
    })),

    entries: finishedStock.entries.map((entry) => ({
      id: entry.id,
      quantity: entry.quantity,

      origin: entry.origin,

      note: entry.note,

      createdAt: entry.createdAt.toISOString(),

      productionItem: entry.productionItem
        ? {
            id: entry.productionItem.id,

            productionId: entry.productionItem.productionId,

            quantityProduced: entry.productionItem.quantityProduced,

            remainingQuantity: entry.productionItem.remainingQuantity,

            expiresAt: entry.productionItem.expiresAt.toISOString(),
          }
        : null,

      createdBy: {
        id: entry.createdBy.id,

        name: entry.createdBy.name,
      },
    })),
  };
};
