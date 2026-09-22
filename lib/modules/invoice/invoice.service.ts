import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { InvoiceData, InvoiceFilterInput } from "./invoice.schema";

// ======================================================
// CONFIGURATION
// ======================================================

const MAIN_SHOP_SINGLETON = "MAIN";

// ======================================================
// SELECT
// ======================================================

const invoiceSelect = {
  id: true,
  saleId: true,
  invoiceNumber: true,
  status: true,
  deliveryMethod: true,
  whatsappSentAt: true,
  printedAt: true,
  paymentMethod: true,

  // ----------------------------------------------------
  // SNAPSHOT BOUTIQUE
  // ----------------------------------------------------

  shopName: true,

  // ----------------------------------------------------
  // SNAPSHOT POS
  // ----------------------------------------------------

  pointOfSaleName: true,
  pointOfSaleAddress: true,
  pointOfSaleTelephone: true,

  // ----------------------------------------------------
  // SNAPSHOT VENDEUR
  // ----------------------------------------------------

  sellerName: true,

  // ----------------------------------------------------
  // SNAPSHOT FACTURE
  // ----------------------------------------------------

  currency: true,
  subtotal: true,
  discountAmount: true,
  totalAmount: true,

  // ----------------------------------------------------
  // SNAPSHOT FIDÉLITÉ
  // ----------------------------------------------------

  pointsEarned: true,
  pointsUsed: true,

  // ----------------------------------------------------
  // SNAPSHOT CLIENT
  // ----------------------------------------------------

  customerName: true,
  customerPhone: true,

  // ----------------------------------------------------
  // DATE
  // ----------------------------------------------------

  createdAt: true,

  // ----------------------------------------------------
  // ARTICLES
  // ----------------------------------------------------

  items: {
    orderBy: {
      id: "asc",
    },

    select: {
      id: true,
      invoiceId: true,
      productName: true,
      size: true,
      quantity: true,
      unitPrice: true,
      subtotal: true,
      currency: true,
    },
  },
} satisfies Prisma.InvoiceSelect;

// ======================================================
// SHOP
// ======================================================

async function getMainShop() {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: MAIN_SHOP_SINGLETON,
    },

    select: {
      id: true,
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  return shop;
}

// ======================================================
// DATE RANGE
// ======================================================

function getDateRange(
  period: InvoiceFilterInput["period"],
  date: string,
): {
  start: Date;
  end: Date;
} {
  const baseDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(baseDate.getTime())) {
    throw new Error("INVALID_DATE");
  }

  switch (period) {
    // --------------------------------------------------
    // ANNÉE
    // --------------------------------------------------

    case "year": {
      const start = new Date(baseDate.getFullYear(), 0, 1);

      const end = new Date(baseDate.getFullYear() + 1, 0, 1);

      return {
        start,
        end,
      };
    }

    // --------------------------------------------------
    // MOIS
    // --------------------------------------------------

    case "month": {
      const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);

      const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);

      return {
        start,
        end,
      };
    }

    // --------------------------------------------------
    // SEMAINE
    // --------------------------------------------------

    case "week": {
      const day = baseDate.getDay();

      // Dimanche = 0
      // Lundi = 1

      // On considère le lundi comme
      // premier jour de la semaine.

      const daysFromMonday = day === 0 ? 6 : day - 1;

      const start = new Date(baseDate);

      start.setDate(baseDate.getDate() - daysFromMonday);

      start.setHours(0, 0, 0, 0);

      const end = new Date(start);

      end.setDate(start.getDate() + 7);

      return {
        start,
        end,
      };
    }

    // --------------------------------------------------
    // JOUR
    // --------------------------------------------------

    case "day": {
      const start = new Date(baseDate);

      start.setHours(0, 0, 0, 0);

      const end = new Date(start);

      end.setDate(start.getDate() + 1);

      return {
        start,
        end,
      };
    }

    default:
      throw new Error("INVALID_PERIOD");
  }
}

// ======================================================
// MAPPING
// ======================================================

function mapInvoice(
  invoice: Prisma.InvoiceGetPayload<{
    select: typeof invoiceSelect;
  }>,
): InvoiceData {
  return {
    id: invoice.id,
    saleId: invoice.saleId,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    deliveryMethod: invoice.deliveryMethod,
    whatsappSentAt: invoice.whatsappSentAt
      ? invoice.whatsappSentAt.toISOString()
      : null,

    printedAt: invoice.printedAt ? invoice.printedAt.toISOString() : null,

    // ==================================================
    // BOUTIQUE
    // ==================================================

    shop: {
      name: invoice.shopName,
    },

    // ==================================================
    // POINT DE VENTE
    // ==================================================

    pointOfSale: {
      name: invoice.pointOfSaleName,
      address: invoice.pointOfSaleAddress,
      telephone: invoice.pointOfSaleTelephone,
    },

    // ==================================================
    // VENDEUR
    // ==================================================

    seller: {
      name: invoice.sellerName,
    },

    // ==================================================
    // FACTURE
    // ==================================================

    paymentMethod: invoice.paymentMethod,
    currency: invoice.currency,
    subtotal: Number(invoice.subtotal),
    discountAmount: Number(invoice.discountAmount),
    totalAmount: Number(invoice.totalAmount),

    // ==================================================
    // FIDÉLITÉ
    // ==================================================

    loyalty: {
      pointsEarned: invoice.pointsEarned,
      pointsUsed: invoice.pointsUsed,
    },

    // ==================================================
    // CLIENT
    // ==================================================

    customer: {
      name: invoice.customerName,
      phone: invoice.customerPhone,
    },

    // ==================================================
    // DATE
    // ==================================================

    createdAt: invoice.createdAt.toISOString(),

    // ==================================================
    // ARTICLES
    // ==================================================

    items: invoice.items.map((item) => ({
      id: item.id,
      invoiceId: item.invoiceId,

      productName: item.productName,
      size: item.size,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
      currency: item.currency,
    })),
  };
}

// ======================================================
// RÉCUPÉRER TOUTES LES FACTURES
// ======================================================

export async function getInvoices(
  filters: InvoiceFilterInput = {},
): Promise<InvoiceData[]> {
  const shop = await getMainShop();

  // ----------------------------------------------------
  // DATE
  // ----------------------------------------------------

  const dateRange =
    filters.period && filters.date
      ? getDateRange(filters.period, filters.date)
      : undefined;

  // ----------------------------------------------------
  // WHERE
  // ----------------------------------------------------

  const where: Prisma.InvoiceWhereInput = {
    // --------------------------------------------------
    // SÉCURITÉ SHOP
    // --------------------------------------------------

    sale: {
      pointOfSale: {
        shopId: shop.id,
      },
    },

    // --------------------------------------------------
    // FILTRE MONTANT
    // --------------------------------------------------

    ...(filters.minAmount !== undefined || filters.maxAmount !== undefined
      ? {
          totalAmount: {
            ...(filters.minAmount !== undefined
              ? {
                  gte: filters.minAmount,
                }
              : {}),

            ...(filters.maxAmount !== undefined
              ? {
                  lte: filters.maxAmount,
                }
              : {}),
          },
        }
      : {}),

    // --------------------------------------------------
    // FILTRE DATE
    // --------------------------------------------------

    ...(dateRange
      ? {
          createdAt: {
            gte: dateRange.start,
            lt: dateRange.end,
          },
        }
      : {}),

    // --------------------------------------------------
    // FILTRE NUMÉRO CLIENT
    // --------------------------------------------------

    ...(filters.customerPhone
      ? {
          customerPhone: {
            contains: filters.customerPhone,
          },
        }
      : {}),
  };

  // ----------------------------------------------------
  // QUERY
  // ----------------------------------------------------

  const invoices = await prisma.invoice.findMany({
    where,

    orderBy: {
      createdAt: "desc",
    },

    select: invoiceSelect,
  });

  // ----------------------------------------------------
  // MAPPING
  // ----------------------------------------------------

  return invoices.map(mapInvoice);
}

// ======================================================
// RÉCUPÉRER UNE FACTURE
// ======================================================

export async function getInvoiceById(invoiceId: string): Promise<InvoiceData> {
  const shop = await getMainShop();

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,

      sale: {
        pointOfSale: {
          shopId: shop.id,
        },
      },
    },

    select: invoiceSelect,
  });

  if (!invoice) {
    throw new Error("INVOICE_NOT_FOUND");
  }

  return mapInvoice(invoice);
}
