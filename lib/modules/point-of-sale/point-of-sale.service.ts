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
      updatedAt: true,

      user: {
        select: {
          id: true,
          name: true,
          email: true,
          telephone: true,
          image: true,
          role: true,
          isActive: true,
          isBanned: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc" as const,
    },
  },
} as const;

// ============================================================
// VÉRIFIER LA BOUTIQUE DU MANAGER
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
// STATISTIQUES DU POINT DE VENTE
// ============================================================

const getPointOfSaleStats = async (pointOfSaleId: string) => {
  const [finishedStockCount, salesCount, lossCount, productionCount] =
    await Promise.all([
      prisma.finishedStock.count({
        where: {
          pointOfSaleId,
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

  return {
    finishedStockCount,
    salesCount,
    lossCount,
    productionCount,
  };
};

// ============================================================
// RÉCUPÉRER UN POS COMPLET AVEC STATISTIQUES
// ============================================================

const getCompletePointOfSale = async (pointOfSaleId: string) => {
  const pointOfSale = await prisma.pointOfSale.findUnique({
    where: {
      id: pointOfSaleId,
    },

    select: pointOfSaleSelect,
  });

  if (!pointOfSale) {
    throw new Error("POINT_OF_SALE_NOT_FOUND");
  }

  const stats = await getPointOfSaleStats(pointOfSale.id);

  return {
    ...pointOfSale,
    ...stats,
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

  // ==========================================================
  // LE PRINCIPAL DOIT ÊTRE ACTIF
  // ==========================================================

  if (isMainStore && !isActive) {
    throw new Error("MAIN_STORE_MUST_BE_ACTIVE");
  }

  // ==========================================================
  // VÉRIFIER LE CODE
  // ==========================================================

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

  // ==========================================================
  // CRÉATION
  // ==========================================================

  const pointOfSale = await prisma.$transaction(async (tx) => {
    // --------------------------------------------------------
    // SI LE NOUVEAU POS EST PRINCIPAL
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // CRÉER LE POS
    // --------------------------------------------------------

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

  // ==========================================================
  // STATISTIQUES
  // ==========================================================

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

  // ==========================================================
  // VÉRIFIER LE NOUVEAU CODE
  // ==========================================================

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

  // ==========================================================
  // VALEURS FINALES
  // ==========================================================

  const isMainStore = data.isMainStore ?? existingPointOfSale.isMainStore;

  const isActive = data.isActive ?? existingPointOfSale.isActive;

  // ==========================================================
  // LE PRINCIPAL DOIT ÊTRE ACTIF
  // ==========================================================

  if (isMainStore && !isActive) {
    throw new Error("MAIN_STORE_MUST_BE_ACTIVE");
  }

  // ==========================================================
  // LE PRINCIPAL ACTUEL NE PEUT PAS ÊTRE DÉSACTIVÉ
  // ==========================================================

  if (existingPointOfSale.isMainStore && !isActive) {
    throw new Error("MAIN_STORE_CANNOT_BE_DEACTIVATED");
  }

  // ==========================================================
  // MISE À JOUR
  // ==========================================================

  const pointOfSale = await prisma.$transaction(async (tx) => {
    // --------------------------------------------------------
    // SI CE POS DEVIENT PRINCIPAL
    // --------------------------------------------------------

    if (isMainStore) {
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

    // --------------------------------------------------------
    // MISE À JOUR DU POS
    // --------------------------------------------------------

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

  // ==========================================================
  // STATISTIQUES
  // ==========================================================

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

  // ==========================================================
  // LE PRINCIPAL NE PEUT PAS ÊTRE SUPPRIMÉ
  // ==========================================================

  if (pointOfSale.isMainStore) {
    throw new Error("MAIN_STORE_CANNOT_BE_DELETED");
  }

  // ==========================================================
  // VÉRIFIER LES DONNÉES LIÉES
  // ==========================================================

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

  // ==========================================================
  // SUPPRESSION
  // ==========================================================

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

  const stats = await getPointOfSaleStats(pointOfSale.id);

  return {
    ...pointOfSale,
    ...stats,
  };
};

// ============================================================
// AFFECTER UN EMPLOYÉ À UN POINT DE VENTE
// ============================================================

export const assignEmployeeToPointOfSale = async (
  userId: string,
  pointOfSaleId: string,
  employeeId: string,
) => {
  // ==========================================================
  // VÉRIFIER LA BOUTIQUE
  // ==========================================================

  const shop = await getShopByOwnerId(userId);

  // ==========================================================
  // VÉRIFIER LE POS
  // ==========================================================

  const pointOfSale = await getPointOfSaleForShop(pointOfSaleId, shop.id);

  // ==========================================================
  // LE POS DOIT ÊTRE ACTIF
  // ==========================================================

  if (!pointOfSale.isActive) {
    throw new Error("POINT_OF_SALE_INACTIVE");
  }

  // ==========================================================
  // VÉRIFIER L'EMPLOYÉ
  // ==========================================================

  const employee = await prisma.user.findFirst({
    where: {
      id: employeeId,
      role: "EMPLOYEE",
      isActive: true,
      isBanned: false,
    },

    select: {
      id: true,
      name: true,
      email: true,
      telephone: true,
      image: true,
      role: true,
      isActive: true,
      isBanned: true,
    },
  });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  // ==========================================================
  // VÉRIFIER SI L'EMPLOYÉ EST DÉJÀ AFFECTÉ
  // ==========================================================

  const existingAssignment = await prisma.staffAssignment.findFirst({
    where: {
      userId: employee.id,
      isActive: true,
    },

    select: {
      id: true,
      pointOfSaleId: true,
    },
  });

  // ==========================================================
  // UN EMPLOYÉ NE PEUT AVOIR QU'UNE AFFECTATION ACTIVE
  // ==========================================================

  if (existingAssignment) {
    if (existingAssignment.pointOfSaleId === pointOfSaleId) {
      throw new Error("EMPLOYEE_ALREADY_ASSIGNED_TO_THIS_POINT_OF_SALE");
    }

    throw new Error("EMPLOYEE_ALREADY_ASSIGNED");
  }

  // ==========================================================
  // CRÉER L'AFFECTATION
  // ==========================================================

  await prisma.staffAssignment.create({
    data: {
      userId: employee.id,
      shopId: shop.id,
      pointOfSaleId,
      isActive: true,
    },
  });

  // ==========================================================
  // RÉCUPÉRER LE POS MIS À JOUR
  // ==========================================================

  return getCompletePointOfSale(pointOfSaleId);
};

// ============================================================
// RETIRER UN EMPLOYÉ D'UN POINT DE VENTE
// ============================================================

export const removeEmployeeFromPointOfSale = async (
  userId: string,
  pointOfSaleId: string,
  employeeId: string,
) => {
  // ==========================================================
  // VÉRIFIER LA BOUTIQUE
  // ==========================================================

  const shop = await getShopByOwnerId(userId);

  // ==========================================================
  // VÉRIFIER LE POS
  // ==========================================================

  await getPointOfSaleForShop(pointOfSaleId, shop.id);

  // ==========================================================
  // VÉRIFIER L'AFFECTATION ACTIVE
  // ==========================================================

  const assignment = await prisma.staffAssignment.findFirst({
    where: {
      userId: employeeId,
      shopId: shop.id,
      pointOfSaleId,
      isActive: true,
    },

    select: {
      id: true,
    },
  });

  if (!assignment) {
    throw new Error("EMPLOYEE_ASSIGNMENT_NOT_FOUND");
  }

  // ==========================================================
  // DÉSACTIVER L'AFFECTATION
  // ==========================================================
  //
  // IMPORTANT :
  // On ne supprime pas l'enregistrement.
  // On conserve l'historique.
  //

  await prisma.staffAssignment.update({
    where: {
      id: assignment.id,
    },

    data: {
      isActive: false,
    },
  });

  // ==========================================================
  // RÉCUPÉRER LE POS MIS À JOUR
  // ==========================================================

  return getCompletePointOfSale(pointOfSaleId);
};
