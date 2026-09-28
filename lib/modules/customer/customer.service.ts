import { prisma } from "@/lib/prisma";

import type { GetCustomerInput, GetCustomersInput } from "./customer.schema";

// ======================================================
// TYPES
// ======================================================

type UserRole = "MANAGER" | "EMPLOYEE";

interface CustomerContext {
  shopId: string;

  /**
   * null = manager consulte tous les POS
   */
  pointOfSaleId: string | null;

  /**
   * Liste des POS autorisés dans le contexte courant.
   *
   * EMPLOYEE :
   *   → uniquement son POS
   *
   * MANAGER + POS :
   *   → uniquement le POS sélectionné
   *
   * MANAGER sans POS :
   *   → tous les POS actifs de la boutique
   */
  pointOfSaleIds: string[];

  /**
   * true = manager consulte tous les POS
   */
  isAllPointOfSales: boolean;
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
 * Résout le contexte de consultation des clients.
 *
 * IMPORTANT :
 *
 * Customer est global à la boutique.
 * Il n'appartient pas directement à un POS.
 *
 * Le POS sert uniquement à filtrer son activité commerciale.
 *
 * ------------------------------------------------------
 * EMPLOYEE
 * ------------------------------------------------------
 *
 * L'employé utilise obligatoirement son affectation active.
 *
 * Un pointOfSaleId fourni par le client est ignoré.
 *
 * ------------------------------------------------------
 * MANAGER
 * ------------------------------------------------------
 *
 * pointOfSaleId fourni :
 *   → consultation d'un POS précis
 *
 * pointOfSaleId absent :
 *   → consultation de tous les POS actifs de sa boutique
 */
const resolveCustomerContext = async (
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
      pointOfSaleIds: [assignment.pointOfSaleId],
      isAllPointOfSales: false,
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

  // ====================================================
  // MANAGER → POS SPÉCIFIQUE
  // ====================================================

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
      pointOfSaleIds: [pointOfSale.id],
      isAllPointOfSales: false,
    };
  }

  // ====================================================
  // MANAGER → TOUS LES POS
  // ====================================================

  const pointOfSales = await prisma.pointOfSale.findMany({
    where: {
      shopId: shop.id,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  return {
    shopId: shop.id,
    pointOfSaleId: null,
    pointOfSaleIds: pointOfSales.map((pointOfSale) => pointOfSale.id),
    isAllPointOfSales: true,
  };
};

// ======================================================
// FILTRE FACTURES POUR ACTIVITÉ CLIENT
// ======================================================

/**
 * Construit le filtre utilisé pour identifier l'activité
 * d'un client dans le contexte courant.
 *
 * Customer n'a pas de shopId.
 *
 * On utilise donc Invoice.pointOfSaleId.
 *
 * Les pointOfSaleIds ont déjà été validés par
 * resolveCustomerContext().
 */
const buildCustomerInvoiceActivityFilter = (context: CustomerContext) => {
  return {
    invoices: {
      some: {
        pointOfSaleId: {
          in: context.pointOfSaleIds,
        },
      },
    },
  };
};

// ======================================================
// FILTRE FACTURES POUR STATISTIQUES
// ======================================================

const buildInvoiceWhere = (customerIds: string[], context: CustomerContext) => {
  return {
    customerId: {
      in: customerIds,
    },
    pointOfSaleId: {
      in: context.pointOfSaleIds,
    },
  };
};

// ======================================================
// CLIENT DANS LE CONTEXTE
// ======================================================

/**
 * Vérifie qu'un client possède au moins une facture
 * dans le contexte demandé.
 *
 * Un client n'est donc jamais rattaché directement
 * à un POS.
 */
const getCustomerForContext = async (
  customerId: string,
  context: CustomerContext,
) => {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      invoices: {
        some: {
          pointOfSaleId: {
            in: context.pointOfSaleIds,
          },
        },
      },
    },
    select: customerListSelect,
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
  // ====================================================
  // CONTEXTE
  // ====================================================

  const context = await resolveCustomerContext(
    userId,
    role,
    input.pointOfSaleId,
  );

  const { search, page, limit, updatedSince } = input;

  const skip = (page - 1) * limit;

  // ====================================================
  // RECHERCHE
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
  // ACTIVITÉ DU CLIENT
  // ====================================================

  /**
   * Un Customer est visible uniquement s'il possède
   * au moins une facture dans le contexte.
   *
   * MANAGER + POS :
   *   → factures de ce POS
   *
   * MANAGER sans POS :
   *   → factures de tous les POS actifs de la boutique
   *
   * EMPLOYEE :
   *   → factures de son POS
   */
  const activityFilter = buildCustomerInvoiceActivityFilter(context);

  // ====================================================
  // SYNCHRONISATION OFFLINE-FIRST
  // ====================================================

  /**
   * On conserve Customer.updatedAt :
   *
   * - modification du nom
   * - modification du téléphone
   * - modification du client
   *
   * On prend également en compte :
   *
   * - nouvelles factures
   * - nouvelles transactions de fidélité
   *
   * IMPORTANT :
   * Invoice ne possède actuellement pas updatedAt.
   * On utilise donc createdAt pour détecter les nouvelles
   * factures.
   */
  const updatedSinceFilter = updatedSince
    ? {
        OR: [
          // ----------------------------------------------
          // Modification du client
          // ----------------------------------------------

          {
            updatedAt: {
              gt: updatedSince,
            },
          },

          // ----------------------------------------------
          // Nouvelle facture dans le contexte
          // ----------------------------------------------

          {
            invoices: {
              some: {
                pointOfSaleId: {
                  in: context.pointOfSaleIds,
                },
                createdAt: {
                  gt: updatedSince,
                },
              },
            },
          },

          // ----------------------------------------------
          // Nouvelle transaction de fidélité
          // ----------------------------------------------

          {
            loyaltyTransactions: {
              some: {
                createdAt: {
                  gt: updatedSince,
                },
                OR: [
                  // ----------------------------------------
                  // Transaction liée à une vente du contexte
                  // ----------------------------------------

                  {
                    sale: {
                      pointOfSaleId: {
                        in: context.pointOfSaleIds,
                      },
                    },
                  },

                  // ----------------------------------------
                  // Ajustement manuel
                  // ----------------------------------------

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
    ...activityFilter,
    ...searchFilter,
    ...updatedSinceFilter,
  };

  // ====================================================
  // CLIENTS + TOTAL
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

  /**
   * Les statistiques commerciales viennent des factures
   * et non plus des ventes.
   */
  const invoices =
    customerIds.length > 0
      ? await prisma.invoice.findMany({
          where: buildInvoiceWhere(customerIds, context),
          select: {
            customerId: true,
            totalAmount: true,
            createdAt: true,
          },
        })
      : [];

  // ====================================================
  // AGRÉGATION DES STATISTIQUES
  // ====================================================

  const statsByCustomer = new Map<
    string,
    {
      totalSpent: string;
      purchaseCount: number;
      lastPurchaseAt: Date | null;
    }
  >();

  for (const invoice of invoices) {
    if (!invoice.customerId) {
      continue;
    }

    const current = statsByCustomer.get(invoice.customerId);

    const currentTotal = current ? Number(current.totalSpent) : 0;

    const invoiceTotal = Number(invoice.totalAmount);

    const lastPurchaseAt =
      !current?.lastPurchaseAt || invoice.createdAt > current.lastPurchaseAt
        ? invoice.createdAt
        : current.lastPurchaseAt;

    statsByCustomer.set(invoice.customerId, {
      totalSpent: (currentTotal + invoiceTotal).toString(),
      purchaseCount: (current?.purchaseCount ?? 0) + 1,
      lastPurchaseAt,
    });
  }

  // ====================================================
  // FORMATAGE
  // ====================================================

  const formattedCustomers = customers.map((customer) => {
    const stats = statsByCustomer.get(customer.id);

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      loyaltyPoints: customer.loyaltyPoints,

      totalSpent: stats?.totalSpent ?? "0",

      purchaseCount: stats?.purchaseCount ?? 0,

      lastPurchaseAt: stats?.lastPurchaseAt ?? null,

      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  });

  // ====================================================
  // RÉSULTAT
  // ====================================================

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
      isAll: context.isAllPointOfSales,
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
  // ====================================================
  // CONTEXTE
  // ====================================================

  const context = await resolveCustomerContext(
    userId,
    role,
    input.pointOfSaleId,
  );

  // ====================================================
  // CLIENT
  // ====================================================

  const customer = await getCustomerForContext(input.clientId, context);

  // ====================================================
  // PAGINATION
  // ====================================================

  const skip = (input.page - 1) * input.limit;

  // ====================================================
  // FILTRE FACTURES
  // ====================================================

  const invoiceWhere = {
    customerId: customer.id,

    pointOfSaleId: {
      in: context.pointOfSaleIds,
    },
  };

  // ====================================================
  // FACTURES
  // ====================================================

  const [invoices, invoicesTotal] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceWhere,

      orderBy: {
        createdAt: "desc",
      },

      skip,
      take: input.limit,

      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        deliveryMethod: true,
        whatsappSentAt: true,
        printedAt: true,

        shopName: true,

        pointOfSaleId: true,
        pointOfSaleName: true,
        pointOfSaleAddress: true,
        pointOfSaleTelephone: true,

        sellerName: true,
        paymentMethod: true,
        currency: true,

        subtotal: true,
        discountAmount: true,
        totalAmount: true,

        pointsEarned: true,
        pointsUsed: true,

        customerName: true,
        customerPhone: true,

        createdAt: true,

        items: {
          select: {
            id: true,
            productName: true,
            size: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            currency: true,
          },
        },
      },
    }),

    prisma.invoice.count({
      where: invoiceWhere,
    }),
  ]);

  // ====================================================
  // STATISTIQUES
  // ====================================================

  /**
   * Les statistiques utilisent également Invoice.
   *
   * On ne dépend donc plus de Sale pour :
   *
   * - total dépensé
   * - nombre d'achats
   * - moyenne
   * - dernier achat
   */

  const invoiceStats = await prisma.invoice.aggregate({
    where: invoiceWhere,

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
   * Pour le moment LoyaltyTransaction possède
   * uniquement saleId comme relation vers une opération
   * commerciale.
   *
   * Les transactions avec saleId = null correspondent
   * aux ajustements manuels.
   */

  const loyaltyTransactions = await prisma.loyaltyTransaction.findMany({
    where: {
      customerId: customer.id,

      OR: [
        // --------------------------------------------
        // Transaction liée à une vente du contexte
        // --------------------------------------------

        {
          sale: {
            pointOfSaleId: {
              in: context.pointOfSaleIds,
            },
          },
        },

        // --------------------------------------------
        // Ajustement manuel
        // --------------------------------------------

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
  // FORMATAGE FACTURES
  // ====================================================

  const formattedInvoices = invoices.map((invoice) => ({
    id: invoice.id,

    invoiceNumber: invoice.invoiceNumber,

    status: invoice.status,

    deliveryMethod: invoice.deliveryMethod,

    whatsappSentAt: invoice.whatsappSentAt,

    printedAt: invoice.printedAt,

    shopName: invoice.shopName,

    pointOfSale: {
      id: invoice.pointOfSaleId,
      name: invoice.pointOfSaleName,
      address: invoice.pointOfSaleAddress,
      telephone: invoice.pointOfSaleTelephone,
    },

    sellerName: invoice.sellerName,

    paymentMethod: invoice.paymentMethod,

    currency: invoice.currency,

    subtotal: invoice.subtotal.toString(),

    discountAmount: invoice.discountAmount.toString(),

    totalAmount: invoice.totalAmount.toString(),

    pointsEarned: invoice.pointsEarned,

    pointsUsed: invoice.pointsUsed,

    customerName: invoice.customerName,

    customerPhone: invoice.customerPhone,

    createdAt: invoice.createdAt,

    items: invoice.items.map((item) => ({
      id: item.id,

      productName: item.productName,

      size: item.size,

      quantity: item.quantity,

      unitPrice: item.unitPrice.toString(),

      subtotal: item.subtotal.toString(),

      currency: item.currency,
    })),
  }));

  // ====================================================
  // FORMATAGE FIDÉLITÉ
  // ====================================================

  const formattedLoyaltyTransactions = loyaltyTransactions.map(
    (transaction) => ({
      id: transaction.id,

      type: transaction.type,

      points: transaction.points,

      balanceAfter: transaction.balanceAfter,

      reason: transaction.reason,

      saleId: transaction.saleId,

      receiptNumber: transaction.sale?.receiptNumber ?? null,

      pointOfSaleId: transaction.sale?.pointOfSaleId ?? null,

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
      totalSpent: invoiceStats._sum.totalAmount?.toString() ?? "0",

      purchaseCount: invoiceStats._count.id,

      averagePurchaseAmount: invoiceStats._avg.totalAmount?.toString() ?? "0",

      totalPointsEarned: invoiceStats._sum.pointsEarned ?? 0,

      totalPointsUsed: invoiceStats._sum.pointsUsed ?? 0,

      lastPurchaseAt: invoiceStats._max.createdAt ?? null,
    },

    invoices: formattedInvoices,

    loyaltyTransactions: formattedLoyaltyTransactions,

    pagination: {
      page: input.page,
      limit: input.limit,
      total: invoicesTotal,

      totalPages: Math.ceil(invoicesTotal / input.limit),

      hasNextPage: input.page * input.limit < invoicesTotal,

      hasPreviousPage: input.page > 1,
    },

    pointOfSale: {
      id: context.pointOfSaleId,
      isAll: context.isAllPointOfSales,
    },

    sync: {
      serverTime: new Date(),
    },
  };
};
