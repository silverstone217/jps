import { prisma } from "@/lib/prisma";

import type {
  CreatePointOfSaleInput,
  UpdatePointOfSaleInput,
} from "./point-of-sale.schema";

// ============================================================
// POINT OF SALE SELECT
// ============================================================

export const pointOfSaleSelect = {
  id: true,
  shopId: true,
  name: true,
  code: true,
  telephone: true,
  address: true,
  isMainStore: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,

  // ==========================================================
  // STOCKS DE PRODUITS FINIS
  // ==========================================================

  finishedStocks: {
    select: {
      id: true,
      quantity: true,
      updatedAt: true,

      variant: {
        select: {
          id: true,
          sku: true,
          price: true,

          // ==================================================
          // PRODUIT
          // ==================================================

          product: {
            select: {
              id: true,
              name: true,
            },
          },

          // ==================================================
          // EMBALLAGE
          // ==================================================

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

    orderBy: {
      updatedAt: "desc" as const,
    },
  },

  // ==========================================================
  // EMPLOYÉS AFFECTÉS
  // ==========================================================

  staffAssignments: {
    where: {
      isActive: true,
    },

    select: {
      id: true,
      isActive: true,
      createdAt: true,

      user: {
        select: {
          id: true,
          name: true,
          email: true,
          telephone: true,
          image: true,
          role: true,
          isActive: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc" as const,
    },
  },
} as const;

// ============================================================
// VÉRIFIER LA BOUTIQUE
// ============================================================

const getShopByOwnerId = async (userId: string) => {
  const shop = await prisma.shop.findUnique({
    where: {
      ownerId: userId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  return shop;
};

// ============================================================
// VÉRIFIER LE POINT DE VENTE
// ============================================================

const getPointOfSaleForShop = async (pointOfSaleId: string, shopId: string) => {
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
    throw new Error("POINT_OF_SALE_NOT_FOUND");
  }

  return pointOfSale;
};

// ============================================================
// RÉCUPÉRER LES STATISTIQUES D'UN POINT DE VENTE
// ============================================================

const getPointOfSaleStats = async (pointOfSaleId: string) => {
  const [finishedStockCount, salesCount, lossCount, productionCount] =
    await Promise.all([
      // Nombre de lignes de stock de produits finis
      prisma.finishedStock.count({
        where: {
          pointOfSaleId,
        },
      }),

      // Nombre total de ventes
      prisma.sale.count({
        where: {
          pointOfSaleId,
        },
      }),

      // Nombre total de pertes
      prisma.loss.count({
        where: {
          pointOfSaleId,
        },
      }),

      // Nombre total de productions
      prisma.production.count({
        where: {
          pointOfSaleId,
        },
      }),
    ]);

  return {
    finishedStockCount,
    salesCount,
    lossCount,
    productionCount,
  };
};

// ============================================================
// CRÉER UN POINT DE VENTE
// ============================================================

export const createPointOfSale = async (
  userId: string,
  data: CreatePointOfSaleInput,
) => {
  const shop = await getShopByOwnerId(userId);

  const name = data.name.trim();
  const code = data.code.trim().toUpperCase();
  const telephone = data.telephone?.trim() || null;
  const address = data.address?.trim() || null;

  const isMainStore = data.isMainStore ?? false;
  const isActive = data.isActive ?? true;

  // ----------------------------------------------------------
  // Vérifier que le code n'existe pas déjà
  // ----------------------------------------------------------

  const existingCode = await prisma.pointOfSale.findUnique({
    where: {
      shopId_code: {
        shopId: shop.id,
        code,
      },
    },

    select: {
      id: true,
    },
  });

  if (existingCode) {
    throw new Error("POINT_OF_SALE_CODE_ALREADY_EXISTS");
  }

  // ----------------------------------------------------------
  // Création
  // ----------------------------------------------------------

  const pointOfSale = await prisma.$transaction(async (tx) => {
    // Si ce POS devient le magasin principal,
    // retirer le statut principal aux autres POS.

    if (isMainStore) {
      await tx.pointOfSale.updateMany({
        where: {
          shopId: shop.id,
          isMainStore: true,
        },

        data: {
          isMainStore: false,
        },
      });
    }

    return tx.pointOfSale.create({
      data: {
        shopId: shop.id,
        name,
        code,
        telephone,
        address,
        isMainStore,
        isActive,
      },

      select: pointOfSaleSelect,
    });
  });

  // ----------------------------------------------------------
  // Ajouter les statistiques
  // ----------------------------------------------------------

  const stats = await getPointOfSaleStats(pointOfSale.id);

  return {
    ...pointOfSale,
    ...stats,
  };
};

// ============================================================
// MODIFIER UN POINT DE VENTE
// ============================================================

export const updatePointOfSale = async (
  userId: string,
  pointOfSaleId: string,
  data: UpdatePointOfSaleInput,
) => {
  const shop = await getShopByOwnerId(userId);

  const existingPointOfSale = await getPointOfSaleForShop(
    pointOfSaleId,
    shop.id,
  );

  const name = data.name.trim();
  const code = data.code.trim().toUpperCase();
  const telephone = data.telephone?.trim() || null;
  const address = data.address?.trim() || null;

  // ----------------------------------------------------------
  // Vérifier le nouveau code
  // ----------------------------------------------------------

  if (code !== existingPointOfSale.code) {
    const existingCode = await prisma.pointOfSale.findUnique({
      where: {
        shopId_code: {
          shopId: shop.id,
          code,
        },
      },

      select: {
        id: true,
      },
    });

    if (existingCode && existingCode.id !== pointOfSaleId) {
      throw new Error("POINT_OF_SALE_CODE_ALREADY_EXISTS");
    }
  }

  const isMainStore = data.isMainStore ?? existingPointOfSale.isMainStore;

  const isActive = data.isActive ?? existingPointOfSale.isActive;

  // ----------------------------------------------------------
  // Le magasin principal ne peut pas être désactivé
  // ----------------------------------------------------------

  if (existingPointOfSale.isMainStore && !isActive) {
    throw new Error("MAIN_STORE_CANNOT_BE_DEACTIVATED");
  }

  // ----------------------------------------------------------
  // Mise à jour
  // ----------------------------------------------------------

  const pointOfSale = await prisma.$transaction(async (tx) => {
    // Si ce POS devient le magasin principal,
    // retirer le statut principal aux autres POS.

    if (isMainStore && !existingPointOfSale.isMainStore) {
      await tx.pointOfSale.updateMany({
        where: {
          shopId: shop.id,
          isMainStore: true,
          id: {
            not: pointOfSaleId,
          },
        },

        data: {
          isMainStore: false,
        },
      });
    }

    return tx.pointOfSale.update({
      where: {
        id: pointOfSaleId,
      },

      data: {
        name,
        code,
        telephone,
        address,
        isMainStore,
        isActive,
      },

      select: pointOfSaleSelect,
    });
  });

  // ----------------------------------------------------------
  // Ajouter les statistiques
  // ----------------------------------------------------------

  const stats = await getPointOfSaleStats(pointOfSale.id);

  return {
    ...pointOfSale,
    ...stats,
  };
};

// ============================================================
// SUPPRIMER UN POINT DE VENTE
// ============================================================

export const deletePointOfSale = async (
  userId: string,
  pointOfSaleId: string,
) => {
  const shop = await getShopByOwnerId(userId);

  const pointOfSale = await getPointOfSaleForShop(pointOfSaleId, shop.id);

  // ----------------------------------------------------------
  // Le magasin principal ne peut pas être supprimé
  // ----------------------------------------------------------

  if (pointOfSale.isMainStore) {
    throw new Error("MAIN_STORE_CANNOT_BE_DELETED");
  }

  // ----------------------------------------------------------
  // Vérifier les données liées
  // ----------------------------------------------------------

  const [
    staffAssignmentCount,
    finishedStockCount,
    transferFromCount,
    transferToCount,
    saleCount,
    lossCount,
    productionCount,
  ] = await Promise.all([
    prisma.staffAssignment.count({
      where: {
        pointOfSaleId,
      },
    }),

    prisma.finishedStock.count({
      where: {
        pointOfSaleId,
      },
    }),

    prisma.stockTransfer.count({
      where: {
        fromPosId: pointOfSaleId,
      },
    }),

    prisma.stockTransfer.count({
      where: {
        toPosId: pointOfSaleId,
      },
    }),

    prisma.sale.count({
      where: {
        pointOfSaleId,
      },
    }),

    prisma.loss.count({
      where: {
        pointOfSaleId,
      },
    }),

    prisma.production.count({
      where: {
        pointOfSaleId,
      },
    }),
  ]);

  const hasRelatedData =
    staffAssignmentCount > 0 ||
    finishedStockCount > 0 ||
    transferFromCount > 0 ||
    transferToCount > 0 ||
    saleCount > 0 ||
    lossCount > 0 ||
    productionCount > 0;

  if (hasRelatedData) {
    throw new Error("POINT_OF_SALE_HAS_RELATED_DATA");
  }

  // ----------------------------------------------------------
  // Suppression
  // ----------------------------------------------------------

  await prisma.pointOfSale.delete({
    where: {
      id: pointOfSaleId,
    },
  });

  return {
    id: pointOfSaleId,
  };
};

// ============================================================
// RÉCUPÉRER TOUS LES POINTS DE VENTE
// ============================================================

export const getPointOfSales = async (userId: string) => {
  const shop = await getShopByOwnerId(userId);

  const pointOfSales = await prisma.pointOfSale.findMany({
    where: {
      shopId: shop.id,
    },

    select: pointOfSaleSelect,

    orderBy: [
      {
        isMainStore: "desc",
      },
      {
        isActive: "desc",
      },
      {
        name: "asc",
      },
    ],
  });

  // ----------------------------------------------------------
  // Récupérer les statistiques de tous les POS
  // ----------------------------------------------------------

  const pointOfSalesWithStats = await Promise.all(
    pointOfSales.map(async (pointOfSale) => {
      const stats = await getPointOfSaleStats(pointOfSale.id);

      return {
        ...pointOfSale,
        ...stats,
      };
    }),
  );

  return pointOfSalesWithStats;
};

// ============================================================
// RÉCUPÉRER UN POINT DE VENTE
// ============================================================

export const getPointOfSale = async (userId: string, pointOfSaleId: string) => {
  const shop = await getShopByOwnerId(userId);

  const pointOfSale = await prisma.pointOfSale.findFirst({
    where: {
      id: pointOfSaleId,
      shopId: shop.id,
    },

    select: pointOfSaleSelect,
  });

  if (!pointOfSale) {
    throw new Error("POINT_OF_SALE_NOT_FOUND");
  }

  // ----------------------------------------------------------
  // Ajouter les statistiques
  // ----------------------------------------------------------

  const stats = await getPointOfSaleStats(pointOfSale.id);

  return {
    ...pointOfSale,
    ...stats,
  };
};
