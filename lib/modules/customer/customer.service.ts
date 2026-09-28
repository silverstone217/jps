// lib/modules/customer/customer.service.ts

import { prisma } from "@/lib/prisma";
import type { GetCustomerInput, GetCustomersInput } from "./customer.schema";

// ======================================================
// TYPES
// ======================================================

type UserRole = "MANAGER" | "EMPLOYEE";

interface CustomerContext {
  shopId: string;
  pointOfSaleId: string;
}

// ======================================================
// SELECTS
// ======================================================

const customerListSelect = {
  id: true,
  name: true,
  phone: true,
  loyaltyPoints: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ======================================================
// CONTEXTE POS
// ======================================================

/**
 * Résout le POS dans lequel l'utilisateur doit travailler.
 *
 * EMPLOYEE :
 *   → utilise obligatoirement son affectation active.
 *
 * MANAGER :
 *   → si pointOfSaleId est fourni, l'utilise après validation.
 *   → sinon utilise le POS principal (isMainStore = true).
 *   → s'il n'existe pas, utilise le premier POS actif.
 */
const resolvePointOfSale = async (
  userId: string,
  role: UserRole,
  pointOfSaleId?: string,
): Promise<CustomerContext> => {
  // ====================================================
  // EMPLOYEE
  // ====================================================

  if (role === "EMPLOYEE") {
    const assignment = await prisma.staffAssignment.findFirst({
      where: {
        userId,
        isActive: true,
        pointOfSale: {
          isActive: true,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        shopId: true,
        pointOfSaleId: true,
        pointOfSale: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new Error("POINT_OF_SALE_NOT_ASSIGNED");
    }

    if (!assignment.pointOfSale.isActive) {
      throw new Error("POINT_OF_SALE_INACTIVE");
    }

    return {
      shopId: assignment.shopId,
      pointOfSaleId: assignment.pointOfSaleId,
    };
  }

  // ====================================================
  // MANAGER
  // ====================================================

  const shop = await prisma.shop.findUnique({
    where: {
      ownerId: userId,
    },
    select: {
      id: true,
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  // ----------------------------------------------------
  // Manager demande explicitement un POS
  // ----------------------------------------------------

  if (pointOfSaleId) {
    const pointOfSale = await prisma.pointOfSale.findFirst({
      where: {
        id: pointOfSaleId,
        shopId: shop.id,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!pointOfSale) {
      throw new Error("POINT_OF_SALE_NOT_FOUND");
    }

    if (!pointOfSale.isActive) {
      throw new Error("POINT_OF_SALE_INACTIVE");
    }

    return {
      shopId: shop.id,
      pointOfSaleId: pointOfSale.id,
    };
  }

  // ----------------------------------------------------
  // Aucun POS fourni :
  // priorité au POS principal
  // ----------------------------------------------------

  const defaultPointOfSale = await prisma.pointOfSale.findFirst({
    where: {
      shopId: shop.id,
      isActive: true,
    },
    orderBy: [
      {
        isMainStore: "desc",
      },
      {
        createdAt: "asc",
      },
    ],
    select: {
      id: true,
    },
  });

  if (!defaultPointOfSale) {
    throw new Error("POINT_OF_SALE_NOT_FOUND");
  }

  return {
    shopId: shop.id,
    pointOfSaleId: defaultPointOfSale.id,
  };
};

// ======================================================
// VALIDATION CLIENT DANS LE POS
// ======================================================

/**
 * Vérifie qu'un client possède au moins une vente
 * dans le POS courant.
 *
 * C'est volontaire :
 * un client global Customer n'est visible dans un POS
 * que s'il y possède une activité commerciale.
 */
const getCustomerForPointOfSale = async (
  customerId: string,
  shopId: string,
  pointOfSaleId: string,
) => {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,

      sales: {
        some: {
          pointOfSaleId,
          pointOfSale: {
            shopId,
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      loyaltyPoints: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  return customer;
};

// ======================================================
// LISTE DES CLIENTS
// ======================================================

export const getCustomers = async (
  userId: string,
  role: UserRole,
  input: GetCustomersInput,
) => {
  const context = await resolvePointOfSale(userId, role, input.pointOfSaleId);

  const { search, page, limit, updatedSince } = input;

  const skip = (page - 1) * limit;

  // ====================================================
  // FILTRE DE RECHERCHE
  // ====================================================

  const searchFilter = search
    ? {
        OR: [
          {
            name: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
          {
            phone: {
              contains: search,
            },
          },
        ],
      }
    : {};

  // ====================================================
  // ACTIVITÉ DU CLIENT DANS LE POS
  // ====================================================

  const pointOfSaleActivityFilter = {
    sales: {
      some: {
        pointOfSaleId: context.pointOfSaleId,
        pointOfSale: {
          shopId: context.shopId,
        },
      },
    },
  };

  // ====================================================
  // SYNCHRONISATION
  // ====================================================

  /**
   * Customer.updatedAt est conservé ici parce qu'une
   * modification du nom ou du téléphone doit pouvoir
   * être synchronisée même si aucune nouvelle vente
   * n'a été créée.
   *
   * Les ventes récentes du POS sont également prises
   * en compte.
   */
  const updatedSinceFilter = updatedSince
    ? {
        OR: [
          {
            updatedAt: {
              gt: updatedSince,
            },
          },
          {
            sales: {
              some: {
                pointOfSaleId: context.pointOfSaleId,
                createdAt: {
                  gt: updatedSince,
                },
              },
            },
          },
          {
            loyaltyTransactions: {
              some: {
                createdAt: {
                  gt: updatedSince,
                },
                OR: [
                  {
                    sale: {
                      pointOfSaleId: context.pointOfSaleId,
                    },
                  },
                  {
                    saleId: null,
                  },
                ],
              },
            },
          },
        ],
      }
    : {};

  // ====================================================
  // WHERE FINAL
  // ====================================================

  const where = {
    ...pointOfSaleActivityFilter,
    ...searchFilter,
    ...updatedSinceFilter,
  };

  // ====================================================
  // REQUÊTES
  // ====================================================

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      select: customerListSelect,
      orderBy: {
        updatedAt: "desc",
      },
      skip,
      take: limit,
    }),

    prisma.customer.count({
      where,
    }),
  ]);

  // ====================================================
  // STATISTIQUES PAR CLIENT
  // ====================================================

  const customerIds = customers.map((customer) => customer.id);

  const salesStats =
    customerIds.length > 0
      ? await prisma.sale.groupBy({
          by: ["customerId"],
          where: {
            customerId: {
              in: customerIds,
            },
            pointOfSaleId: context.pointOfSaleId,
          },
          _count: {
            id: true,
          },
          _sum: {
            totalAmount: true,
          },
          _max: {
            createdAt: true,
          },
        })
      : [];

  const statsByCustomer = new Map(
    salesStats.map((stats) => [stats.customerId, stats]),
  );

  const formattedCustomers = customers.map((customer) => {
    const stats = statsByCustomer.get(customer.id);

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      loyaltyPoints: customer.loyaltyPoints,
      totalSpent: stats?._sum.totalAmount?.toString() ?? "0",
      purchaseCount: stats?._count.id ?? 0,
      lastPurchaseAt: stats?._max.createdAt ?? null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  });

  return {
    customers: formattedCustomers,

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },

    pointOfSale: {
      id: context.pointOfSaleId,
    },

    sync: {
      serverTime: new Date(),
      updatedSince: updatedSince ?? null,
    },
  };
};

// ======================================================
// DÉTAIL D'UN CLIENT
// ======================================================

export const getCustomer = async (
  userId: string,
  role: UserRole,
  input: GetCustomerInput,
) => {
  const context = await resolvePointOfSale(userId, role, input.pointOfSaleId);

  // ====================================================
  // CLIENT
  // ====================================================

  const customer = await getCustomerForPointOfSale(
    input.clientId,
    context.shopId,
    context.pointOfSaleId,
  );

  // ====================================================
  // PAGINATION
  // ====================================================

  const skip = (input.page - 1) * input.limit;

  // ====================================================
  // VENTES
  // ====================================================

  const salesWhere = {
    customerId: customer.id,
    pointOfSaleId: context.pointOfSaleId,
  };

  const [sales, salesTotal] = await Promise.all([
    prisma.sale.findMany({
      where: salesWhere,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: input.limit,
      select: {
        id: true,
        receiptNumber: true,
        subtotal: true,
        discountAmount: true,
        totalAmount: true,
        pointsEarned: true,
        pointsUsed: true,
        paymentMethod: true,
        createdAt: true,

        pointOfSale: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },

        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,

            variant: {
              select: {
                id: true,
                sku: true,

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
      },
    }),

    prisma.sale.count({
      where: salesWhere,
    }),
  ]);

  // ====================================================
  // STATISTIQUES
  // ====================================================

  const salesStats = await prisma.sale.aggregate({
    where: salesWhere,
    _count: {
      id: true,
    },
    _sum: {
      totalAmount: true,
      pointsEarned: true,
      pointsUsed: true,
    },
    _avg: {
      totalAmount: true,
    },
    _max: {
      createdAt: true,
    },
  });

  // ====================================================
  // HISTORIQUE FIDÉLITÉ
  // ====================================================

  /**
   * Les transactions liées à une vente sont filtrées
   * sur le POS courant.
   *
   * Les transactions sans saleId correspondent à des
   * ajustements manuels. Comme le client est consulté
   * dans un POS, on les conserve dans son historique
   * afin de ne pas perdre l'audit de fidélité.
   */
  const loyaltyTransactions = await prisma.loyaltyTransaction.findMany({
    where: {
      customerId: customer.id,
      OR: [
        {
          sale: {
            pointOfSaleId: context.pointOfSaleId,
          },
        },
        {
          saleId: null,
        },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      type: true,
      points: true,
      balanceAfter: true,
      reason: true,
      saleId: true,
      createdAt: true,

      sale: {
        select: {
          receiptNumber: true,
          pointOfSaleId: true,
        },
      },
    },
  });

  // ====================================================
  // FORMATAGE
  // ====================================================

  const formattedSales = sales.map((sale) => ({
    id: sale.id,
    receiptNumber: sale.receiptNumber,

    pointOfSale: sale.pointOfSale,

    subtotal: sale.subtotal.toString(),

    discountAmount: sale.discountAmount.toString(),

    totalAmount: sale.totalAmount.toString(),

    pointsEarned: sale.pointsEarned,

    pointsUsed: sale.pointsUsed,

    paymentMethod: sale.paymentMethod,

    createdAt: sale.createdAt,

    items: sale.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,

      unitPrice: item.unitPrice.toString(),

      subtotal: item.subtotal.toString(),

      variant: {
        id: item.variant.id,
        sku: item.variant.sku,

        product: item.variant.product,

        packaging: item.variant.packaging,
      },
    })),
  }));

  const formattedLoyaltyTransactions = loyaltyTransactions.map(
    (transaction) => ({
      id: transaction.id,
      type: transaction.type,
      points: transaction.points,
      balanceAfter: transaction.balanceAfter,
      reason: transaction.reason,
      saleId: transaction.saleId,
      receiptNumber: transaction.sale?.receiptNumber ?? null,
      createdAt: transaction.createdAt,
    }),
  );

  // ====================================================
  // RÉSULTAT
  // ====================================================

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      loyaltyPoints: customer.loyaltyPoints,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    },

    statistics: {
      totalSpent: salesStats._sum.totalAmount?.toString() ?? "0",

      purchaseCount: salesStats._count.id,

      averagePurchaseAmount: salesStats._avg.totalAmount?.toString() ?? "0",

      totalPointsEarned: salesStats._sum.pointsEarned ?? 0,

      totalPointsUsed: salesStats._sum.pointsUsed ?? 0,

      lastPurchaseAt: salesStats._max.createdAt ?? null,
    },

    sales: formattedSales,

    loyaltyTransactions: formattedLoyaltyTransactions,

    pagination: {
      page: input.page,
      limit: input.limit,
      total: salesTotal,
      totalPages: Math.ceil(salesTotal / input.limit),
      hasNextPage: input.page * input.limit < salesTotal,
      hasPreviousPage: input.page > 1,
    },

    pointOfSale: {
      id: context.pointOfSaleId,
    },

    sync: {
      serverTime: new Date(),
    },
  };
};
