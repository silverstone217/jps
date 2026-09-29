// lib/modules/report/report.service.ts

import { Prisma } from "@/app/generated/prisma/client";
import type { ReportQueryInput } from "@/lib/modules/report/report.schema";
import { prisma } from "@/lib/prisma";

// ============================================================
// TYPES
// ============================================================

export type ReportServiceErrorCode =
  | "SHOP_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "FORBIDDEN"
  | "USER_INACTIVE"
  | "USER_BANNED"
  | "POINT_OF_SALE_NOT_FOUND"
  | "INVALID_DATE_RANGE";

export class ReportServiceError extends Error {
  constructor(
    public code: ReportServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReportServiceError";
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
      currency: true,
    },
  });

  if (!shop) {
    throw new ReportServiceError(
      "SHOP_NOT_FOUND",
      "La boutique principale est introuvable.",
    );
  }

  return shop;
}

// ------------------------------------------------------------
// VALIDATE MANAGER
// ------------------------------------------------------------

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
    throw new ReportServiceError("USER_NOT_FOUND", "Utilisateur introuvable.");
  }

  if (user.role !== "MANAGER") {
    throw new ReportServiceError(
      "FORBIDDEN",
      "Seul un manager peut consulter les rapports.",
    );
  }

  if (!user.isActive) {
    throw new ReportServiceError(
      "USER_INACTIVE",
      "Ce compte utilisateur est inactif.",
    );
  }

  if (user.isBanned && (!user.banExpiresAt || user.banExpiresAt > new Date())) {
    throw new ReportServiceError(
      "USER_BANNED",
      "Ce compte utilisateur est temporairement bloqué.",
    );
  }

  return user;
}

// ------------------------------------------------------------
// VALIDATE POS
// ------------------------------------------------------------
//
// IMPORTANT :
// Le manager peut accéder à tous les POS.
//
// Cette fonction sert uniquement à vérifier que le POS
// appartient bien à la boutique principale.
// ------------------------------------------------------------

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
    throw new ReportServiceError(
      "POINT_OF_SALE_NOT_FOUND",
      "Point de vente introuvable.",
    );
  }

  return pointOfSale;
}

// ------------------------------------------------------------
// CREATE DATE RANGE
// ------------------------------------------------------------
//
// Règles :
//
// dateFrom = 2026-09-20
// dateTo   = 2026-09-20
// => 20 septembre uniquement
//
// dateFrom = 2026-09-20
// dateTo   = 2026-09-25
// => 20 → 25 septembre
//
// dateFrom = 2026-09-20
// dateTo   = absent
// => 20 septembre → aujourd'hui
//
// dateFrom = absent
// dateTo   = absent
// => tout l'historique → aujourd'hui
//
// dateFrom = absent
// dateTo   = 2026-09-25
// => tout l'historique → 25 septembre
//
// Les journées sont interprétées dans le fuseau
// Africa/Kinshasa (UTC+1).
// ------------------------------------------------------------

function createDateRange(dateFrom?: string, dateTo?: string) {
  const now = new Date();

  let startDate: Date;
  let endDate: Date;

  // ----------------------------------------------------------
  // END DATE
  // ----------------------------------------------------------

  if (dateTo) {
    endDate = new Date(`${dateTo}T23:59:59.999+01:00`);
  } else {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Kinshasa",
    }).format(now);

    endDate = new Date(`${today}T23:59:59.999+01:00`);
  }

  // ----------------------------------------------------------
  // START DATE
  // ----------------------------------------------------------

  if (dateFrom) {
    startDate = new Date(`${dateFrom}T00:00:00+01:00`);
  } else {
    // Depuis le début possible de l'historique.
    startDate = new Date(0);
  }

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new ReportServiceError(
      "INVALID_DATE_RANGE",
      "La période sélectionnée est invalide.",
    );
  }

  if (startDate > endDate) {
    throw new ReportServiceError(
      "INVALID_DATE_RANGE",
      "La date de début doit être antérieure ou égale à la date de fin.",
    );
  }

  return {
    startDate,
    endDate,
  };
}

// ------------------------------------------------------------
// DECIMAL TO NUMBER
// ------------------------------------------------------------

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

// ------------------------------------------------------------
// GET PREVIOUS DATE
// ------------------------------------------------------------
//
// Utilisé pour calculer le stock d'ouverture.
// ------------------------------------------------------------

function getPreviousDate(date: Date) {
  return new Date(date.getTime() - 1);
}

// ============================================================
// SALES REPORT
// ============================================================

async function getSalesReport(
  userId: string,
  input: Extract<ReportQueryInput, { type: "SALES" }>,
) {
  await validateManager(userId);

  const shop = await getMainShop();

  const { startDate, endDate } = createDateRange(input.dateFrom, input.dateTo);

  // ----------------------------------------------------------
  // POS FILTER
  // ----------------------------------------------------------

  let pointOfSale = null;

  if (input.pointOfSaleId) {
    pointOfSale = await validatePointOfSale(shop.id, input.pointOfSaleId);
  }

  // ----------------------------------------------------------
  // INVOICES
  // ----------------------------------------------------------

  const invoices = await prisma.invoice.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },

      status: {
        not: "CANCELLED",
      },

      // Si un POS est fourni :
      // uniquement ce POS.
      //
      // Sinon :
      // tous les POS.
      ...(input.pointOfSaleId
        ? {
            pointOfSaleId: input.pointOfSaleId,
          }
        : {
            pointOfSaleId: {
              not: null,
            },
          }),
    },

    select: {
      id: true,
      invoiceNumber: true,
      pointOfSaleId: true,
      pointOfSaleName: true,
      subtotal: true,
      discountAmount: true,
      totalAmount: true,
      paymentMethod: true,
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

    orderBy: {
      createdAt: "asc",
    },
  });

  // ----------------------------------------------------------
  // GROUP BY POS / PRODUCT / FORMAT
  // ----------------------------------------------------------

  type SalesRow = {
    pointOfSaleId: string;
    pointOfSaleName: string;
    productName: string;
    size: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  };

  const salesMap = new Map<string, SalesRow>();

  let totalSales = 0;
  let totalQuantity = 0;
  let grossAmount = 0;
  let discountAmount = 0;
  let netAmount = 0;

  const paymentTotals = {
    CASH: 0,
    MOBILE_MONEY: 0,
    CARD: 0,
    OTHER: 0,
  };

  for (const invoice of invoices) {
    totalSales += 1;

    grossAmount += decimalToNumber(invoice.subtotal);

    discountAmount += decimalToNumber(invoice.discountAmount);

    netAmount += decimalToNumber(invoice.totalAmount);

    const paymentMethod = invoice.paymentMethod;

    if (paymentMethod in paymentTotals) {
      paymentTotals[paymentMethod as keyof typeof paymentTotals] +=
        decimalToNumber(invoice.totalAmount);
    }

    for (const item of invoice.items) {
      totalQuantity += item.quantity;

      const key = [
        invoice.pointOfSaleId,
        item.productName,
        item.size,
        decimalToNumber(item.unitPrice),
      ].join("|");

      const existing = salesMap.get(key);

      if (existing) {
        existing.quantity += item.quantity;

        existing.totalAmount += decimalToNumber(item.subtotal);
      } else {
        salesMap.set(key, {
          pointOfSaleId: invoice.pointOfSaleId!,
          pointOfSaleName: invoice.pointOfSaleName,
          productName: item.productName,
          size: item.size,
          quantity: item.quantity,
          unitPrice: decimalToNumber(item.unitPrice),
          totalAmount: decimalToNumber(item.subtotal),
        });
      }
    }
  }

  // ----------------------------------------------------------
  // SORT
  // ----------------------------------------------------------

  const rows = Array.from(salesMap.values()).sort((a, b) => {
    const posCompare = a.pointOfSaleName.localeCompare(b.pointOfSaleName);

    if (posCompare !== 0) {
      return posCompare;
    }

    const productCompare = a.productName.localeCompare(b.productName);

    if (productCompare !== 0) {
      return productCompare;
    }

    return a.size.localeCompare(b.size);
  });

  // ----------------------------------------------------------
  // TOTALS BY POS
  // ----------------------------------------------------------

  const pointOfSaleMap = new Map<
    string,
    {
      pointOfSaleId: string;
      pointOfSaleName: string;
      quantity: number;
      totalAmount: number;
    }
  >();

  for (const row of rows) {
    const existing = pointOfSaleMap.get(row.pointOfSaleId);

    if (existing) {
      existing.quantity += row.quantity;
      existing.totalAmount += row.totalAmount;
    } else {
      pointOfSaleMap.set(row.pointOfSaleId, {
        pointOfSaleId: row.pointOfSaleId,
        pointOfSaleName: row.pointOfSaleName,
        quantity: row.quantity,
        totalAmount: row.totalAmount,
      });
    }
  }

  return {
    type: "SALES" as const,

    period: {
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
      startDate,
      endDate,
    },

    filter: {
      pointOfSaleId: pointOfSale?.id ?? null,

      pointOfSaleName: pointOfSale?.name ?? null,

      allPointOfSales: !pointOfSale,
    },

    summary: {
      totalSales,
      totalQuantity,
      grossAmount,
      discountAmount,
      netAmount,
      paymentTotals,
    },

    byPointOfSale: Array.from(pointOfSaleMap.values()),

    rows,
  };
}

// ============================================================
// PRODUCTION REPORT
// ============================================================

async function getProductionReport(
  userId: string,
  input: Extract<ReportQueryInput, { type: "PRODUCTION" }>,
) {
  await validateManager(userId);

  const shop = await getMainShop();

  const { startDate, endDate } = createDateRange(input.dateFrom, input.dateTo);

  // ----------------------------------------------------------
  // PRODUCTIONS
  // ----------------------------------------------------------

  const productions = await prisma.production.findMany({
    where: {
      producedAt: {
        gte: startDate,
        lte: endDate,
      },

      manager: {
        shopOwner: {
          id: shop.id,
        },
      },
    },

    select: {
      id: true,
      totalVolumeMl: true,
      notes: true,
      producedAt: true,

      manager: {
        select: {
          id: true,
          name: true,
        },
      },

      ingredients: {
        select: {
          id: true,
          quantityUsed: true,

          ingredient: {
            select: {
              id: true,
              name: true,
              unit: true,
            },
          },
        },
      },

      packagings: {
        select: {
          id: true,
          quantityUsed: true,

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

      items: {
        select: {
          id: true,
          variantId: true,
          quantityProduced: true,
          remainingQuantity: true,
          expiresAt: true,

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
      },
    },

    orderBy: {
      producedAt: "asc",
    },
  });

  // ----------------------------------------------------------
  // TOTALS
  // ----------------------------------------------------------

  let totalProduction = 0;
  let totalVolumeMl = 0;
  let totalQuantityProduced = 0;

  for (const production of productions) {
    totalProduction += 1;

    totalVolumeMl += decimalToNumber(production.totalVolumeMl);

    for (const item of production.items) {
      totalQuantityProduced += item.quantityProduced;
    }
  }

  return {
    type: "PRODUCTION" as const,

    period: {
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
      startDate,
      endDate,
    },

    summary: {
      totalProduction,
      totalVolumeMl,
      totalQuantityProduced,
    },

    rows: productions.map((production) => ({
      id: production.id,

      producedAt: production.producedAt,

      totalVolumeMl: decimalToNumber(production.totalVolumeMl),

      notes: production.notes,

      manager: production.manager,

      items: production.items.map((item) => ({
        id: item.id,
        variantId: item.variantId,

        productName: item.variant.product.name,

        sku: item.variant.sku,

        size: item.variant.packaging.size,

        capacityMl: item.variant.packaging.capacityMl,

        quantityProduced: item.quantityProduced,

        remainingQuantity: item.remainingQuantity,

        expiresAt: item.expiresAt,
      })),

      ingredients: production.ingredients.map((item) => ({
        id: item.id,

        ingredientId: item.ingredient.id,

        ingredientName: item.ingredient.name,

        unit: item.ingredient.unit,

        quantityUsed: decimalToNumber(item.quantityUsed),
      })),

      packagings: production.packagings.map((item) => ({
        id: item.id,

        packagingId: item.packaging.id,

        packagingName: item.packaging.name,

        size: item.packaging.size,

        capacityMl: item.packaging.capacityMl,

        quantityUsed: item.quantityUsed,
      })),
    })),
  };
}

// ============================================================
// RAW MATERIAL STOCK REPORT
// ============================================================
//
// Le stock actuel est corrigé par les mouvements postérieurs
// à la date de fin afin de reconstruire le stock historique.
//
// Exemple :
//
// stock actuel = 100
//
// mouvements après le 20 septembre = +30 -10 +5
//
// stock au 20 septembre
// = 100 - (+30 -10 +5)
// = 75
//
// RawMaterialHistory.quantity est traité comme un delta signé.
// ------------------------------------------------------------

async function getRawMaterialStockReport(
  userId: string,
  input: Extract<ReportQueryInput, { type: "RAW_MATERIAL_STOCK" }>,
) {
  await validateManager(userId);

  const shop = await getMainShop();

  const { startDate, endDate } = createDateRange(input.dateFrom, input.dateTo);

  const previousDate = getPreviousDate(startDate);

  // ----------------------------------------------------------
  // LOAD CURRENT STOCK + HISTORY
  // ----------------------------------------------------------

  const [ingredients, packagings, history] = await prisma.$transaction([
    prisma.rawIngredient.findMany({
      where: {
        shopId: shop.id,
      },

      select: {
        id: true,
        name: true,
        unit: true,
        stockQty: true,
        minAlert: true,
        isActive: true,
      },

      orderBy: {
        name: "asc",
      },
    }),

    prisma.packaging.findMany({
      where: {
        shopId: shop.id,
      },

      select: {
        id: true,
        name: true,
        size: true,
        capacityMl: true,
        stockQty: true,
        minAlert: true,
        isActive: true,
      },

      orderBy: [
        {
          name: "asc",
        },
        {
          capacityMl: "asc",
        },
      ],
    }),

    prisma.rawMaterialHistory.findMany({
      where: {
        shopId: shop.id,
        createdAt: {
          lte: endDate,
        },
      },

      select: {
        id: true,
        ingredientId: true,
        packagingId: true,
        quantity: true,
        type: true,
        note: true,
        createdAt: true,
      },

      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);

  // ----------------------------------------------------------
  // HISTORY MAP
  // ----------------------------------------------------------

  const ingredientHistory = new Map<
    string,
    {
      opening: number;
      purchases: number;
      production: number;
      losses: number;
      adjustments: number;
    }
  >();

  const packagingHistory = new Map<
    string,
    {
      opening: number;
      purchases: number;
      production: number;
      losses: number;
      adjustments: number;
    }
  >();

  // ----------------------------------------------------------
  // HELPER TO CREATE HISTORY OBJECT
  // ----------------------------------------------------------

  function createHistorySummary() {
    return {
      opening: 0,
      purchases: 0,
      production: 0,
      losses: 0,
      adjustments: 0,
    };
  }

  // ----------------------------------------------------------
  // CALCULATE PERIOD MOVEMENTS
  // ----------------------------------------------------------

  for (const movement of history) {
    const quantity = decimalToNumber(movement.quantity);

    const isInPeriod =
      movement.createdAt >= startDate && movement.createdAt <= endDate;

    if (movement.ingredientId && isInPeriod) {
      let summary = ingredientHistory.get(movement.ingredientId);

      if (!summary) {
        summary = createHistorySummary();

        ingredientHistory.set(movement.ingredientId, summary);
      }

      switch (movement.type) {
        case "PURCHASE":
          summary.purchases += quantity;
          break;

        case "PRODUCTION":
          summary.production += quantity;
          break;

        case "LOSS":
          summary.losses += quantity;
          break;

        case "INITIALIZATION":
        case "ADJUSTMENT":
          summary.adjustments += quantity;
          break;
      }
    }

    if (movement.packagingId && isInPeriod) {
      let summary = packagingHistory.get(movement.packagingId);

      if (!summary) {
        summary = createHistorySummary();

        packagingHistory.set(movement.packagingId, summary);
      }

      switch (movement.type) {
        case "PURCHASE":
          summary.purchases += quantity;
          break;

        case "PRODUCTION":
          summary.production += quantity;
          break;

        case "LOSS":
          summary.losses += quantity;
          break;

        case "INITIALIZATION":
        case "ADJUSTMENT":
          summary.adjustments += quantity;
          break;
      }
    }
  }

  // ----------------------------------------------------------
  // CALCULATE OPENING STOCK
  // ----------------------------------------------------------
  //
  // Pour retrouver le stock au début de période :
  //
  // stock actuel
  // - mouvements après la date précédente
  // = stock d'ouverture
  //
  // On recharge les mouvements après previousDate.
  // ----------------------------------------------------------

  const futureHistory = await prisma.rawMaterialHistory.findMany({
    where: {
      shopId: shop.id,
      createdAt: {
        gt: previousDate,
        lte: endDate,
      },
    },

    select: {
      ingredientId: true,
      packagingId: true,
      quantity: true,
      createdAt: true,
    },
  });

  const openingDeltaIngredients = new Map<string, number>();

  const openingDeltaPackagings = new Map<string, number>();

  // ----------------------------------------------------------
  // IMPORTANT :
  //
  // Ici on calcule le stock à startDate.
  //
  // Pour une période 20 → 25 :
  // on doit retirer les mouvements du 20 → 25
  // du stock de fin.
  //
  // ----------------------------------------------------------

  for (const movement of futureHistory) {
    const quantity = decimalToNumber(movement.quantity);

    if (movement.ingredientId) {
      openingDeltaIngredients.set(
        movement.ingredientId,
        (openingDeltaIngredients.get(movement.ingredientId) ?? 0) + quantity,
      );
    }

    if (movement.packagingId) {
      openingDeltaPackagings.set(
        movement.packagingId,
        (openingDeltaPackagings.get(movement.packagingId) ?? 0) + quantity,
      );
    }
  }

  // ----------------------------------------------------------
  // INGREDIENT ROWS
  // ----------------------------------------------------------

  const ingredientRows = ingredients.map((ingredient) => {
    const currentStock = decimalToNumber(ingredient.stockQty);

    const periodDelta =
      ingredientHistory.get(ingredient.id) ?? createHistorySummary();

    const openingStock =
      currentStock - (openingDeltaIngredients.get(ingredient.id) ?? 0);

    const periodMovement =
      periodDelta.purchases +
      periodDelta.production +
      periodDelta.losses +
      periodDelta.adjustments;

    const closingStock = openingStock + periodMovement;

    return {
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      openingQuantity: openingStock,
      purchases: periodDelta.purchases,
      productionUsage: periodDelta.production,
      losses: periodDelta.losses,
      adjustments: periodDelta.adjustments,
      closingQuantity: closingStock,
      currentQuantity: currentStock,
      minAlert: decimalToNumber(ingredient.minAlert),
      isActive: ingredient.isActive,
    };
  });

  // ----------------------------------------------------------
  // PACKAGING ROWS
  // ----------------------------------------------------------

  const packagingRows = packagings.map((packaging) => {
    const currentStock = packaging.stockQty;

    const periodDelta =
      packagingHistory.get(packaging.id) ?? createHistorySummary();

    const openingStock =
      currentStock - (openingDeltaPackagings.get(packaging.id) ?? 0);

    const periodMovement =
      periodDelta.purchases +
      periodDelta.production +
      periodDelta.losses +
      periodDelta.adjustments;

    const closingStock = openingStock + periodMovement;

    return {
      id: packaging.id,
      name: packaging.name,
      size: packaging.size,
      capacityMl: packaging.capacityMl,
      openingQuantity: openingStock,
      purchases: periodDelta.purchases,
      productionUsage: periodDelta.production,
      losses: periodDelta.losses,
      adjustments: periodDelta.adjustments,
      closingQuantity: closingStock,
      currentQuantity: currentStock,
      minAlert: packaging.minAlert,
      isActive: packaging.isActive,
    };
  });

  return {
    type: "RAW_MATERIAL_STOCK" as const,

    period: {
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
      startDate,
      endDate,
    },

    summary: {
      totalIngredients: ingredientRows.length,

      totalPackagings: packagingRows.length,
    },

    ingredients: ingredientRows,

    packagings: packagingRows,
  };
}

// ============================================================
// FINISHED STOCK REPORT
// ============================================================
//
// pointOfSaleId = null
// => Reste
//
// pointOfSaleId = POS ID
// => stock du POS
//
// Sans filtre :
// => Reste + tous les POS
//
// Avec filtre :
// => uniquement le POS demandé
//
// Le stock historique est reconstruit à partir des événements
// connus :
// - production
// - transferts
// - ventes
// - pertes
// - ajustements / entrées manuelles
// ============================================================

async function getFinishedStockReport(
  userId: string,
  input: Extract<ReportQueryInput, { type: "FINISHED_STOCK" }>,
) {
  await validateManager(userId);

  const shop = await getMainShop();

  const { startDate, endDate } = createDateRange(input.dateFrom, input.dateTo);

  // ----------------------------------------------------------
  // POS FILTER
  // ----------------------------------------------------------

  let pointOfSale = null;

  if (input.pointOfSaleId) {
    pointOfSale = await validatePointOfSale(shop.id, input.pointOfSaleId);
  }

  // ----------------------------------------------------------
  // CURRENT STOCK
  // ----------------------------------------------------------

  const stocks = await prisma.finishedStock.findMany({
    where: {
      shopId: shop.id,

      ...(input.pointOfSaleId
        ? {
            pointOfSaleId: input.pointOfSaleId,
          }
        : {}),
    },

    select: {
      id: true,
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

    orderBy: [
      {
        pointOfSaleId: "asc",
      },
      {
        variant: {
          product: {
            name: "asc",
          },
        },
      },
    ],
  });

  // ----------------------------------------------------------
  // CURRENT STOCK MAP
  // ----------------------------------------------------------

  const stockMap = new Map<string, number>();

  for (const stock of stocks) {
    const key = [stock.pointOfSaleId ?? "REMAINING", stock.variant.id].join(
      "|",
    );

    stockMap.set(key, stock.quantity);
  }

  // ----------------------------------------------------------
  // LOAD HISTORICAL EVENTS
  // ----------------------------------------------------------

  const [productions, transfers, invoices, losses, entries] =
    await prisma.$transaction([
      // --------------------------------------------------------
      // PRODUCTION
      // --------------------------------------------------------

      prisma.productionItem.findMany({
        where: {
          production: {
            producedAt: {
              gt: getPreviousDate(startDate),
              lte: endDate,
            },
          },
        },

        select: {
          variantId: true,
          quantityProduced: true,

          production: {
            select: {
              producedAt: true,
            },
          },
        },
      }),

      // --------------------------------------------------------
      // TRANSFERS
      // --------------------------------------------------------

      prisma.stockTransfer.findMany({
        where: {
          shopId: shop.id,

          transferredAt: {
            gt: getPreviousDate(startDate),
            lte: endDate,
          },
        },

        select: {
          fromPosId: true,
          toPosId: true,

          items: {
            select: {
              variantId: true,
              quantity: true,
            },
          },

          transferredAt: true,
        },
      }),

      // --------------------------------------------------------
      // SALES
      // --------------------------------------------------------

      prisma.invoice.findMany({
        where: {
          createdAt: {
            gt: getPreviousDate(startDate),
            lte: endDate,
          },

          status: {
            not: "CANCELLED",
          },

          pointOfSaleId: {
            not: null,
          },
        },

        select: {
          pointOfSaleId: true,
          createdAt: true,

          items: {
            select: {
              productName: true,
              size: true,
              quantity: true,
            },
          },
        },
      }),

      // --------------------------------------------------------
      // LOSSES
      // --------------------------------------------------------

      prisma.loss.findMany({
        where: {
          shopId: shop.id,

          category: "FINISHED_PRODUCT",

          reportedAt: {
            gt: getPreviousDate(startDate),
            lte: endDate,
          },
        },

        select: {
          pointOfSaleId: true,
          variantId: true,
          quantity: true,
          reportedAt: true,
        },
      }),

      // --------------------------------------------------------
      // MANUAL FINISHED STOCK ENTRIES
      // --------------------------------------------------------

      prisma.finishedStockEntry.findMany({
        where: {
          finishedStock: {
            shopId: shop.id,

            ...(input.pointOfSaleId
              ? {
                  pointOfSaleId: input.pointOfSaleId,
                }
              : {}),
          },

          createdAt: {
            gt: getPreviousDate(startDate),
            lte: endDate,
          },

          origin: {
            in: ["ACHAT", "RECUPERATION", "AJUSTEMENT"],
          },
        },

        select: {
          finishedStockId: true,
          quantity: true,
          createdAt: true,

          finishedStock: {
            select: {
              pointOfSaleId: true,
              variantId: true,
            },
          },
        },
      }),
    ]);

  // ----------------------------------------------------------
  // IMPORTANT :
  //
  // Pour reconstruire un stock historique, on part du stock
  // actuel et on retire les mouvements qui ont eu lieu
  // après la date de début.
  //
  // Puis on calcule les mouvements de la période.
  // ----------------------------------------------------------

  type MovementSummary = {
    openingDelta: number;
    production: number;
    transferIn: number;
    transferOut: number;
    sales: number;
    losses: number;
    adjustments: number;
  };

  const movementMap = new Map<string, MovementSummary>();

  function getMovement(pointOfSaleId: string | null, variantId: string) {
    const key = [pointOfSaleId ?? "REMAINING", variantId].join("|");

    let movement = movementMap.get(key);

    if (!movement) {
      movement = {
        openingDelta: 0,
        production: 0,
        transferIn: 0,
        transferOut: 0,
        sales: 0,
        losses: 0,
        adjustments: 0,
      };

      movementMap.set(key, movement);
    }

    return movement;
  }

  // ----------------------------------------------------------
  // PRODUCTION
  //
  // Production = boutique principale / Reste.
  // ----------------------------------------------------------

  for (const item of productions) {
    const movement = getMovement(null, item.variantId);

    const quantity = item.quantityProduced;

    movement.openingDelta += quantity;

    if (
      item.production.producedAt >= startDate &&
      item.production.producedAt <= endDate
    ) {
      movement.production += quantity;
    }
  }

  // ----------------------------------------------------------
  // TRANSFERS
  // ----------------------------------------------------------

  for (const transfer of transfers) {
    for (const item of transfer.items) {
      const quantity = item.quantity;

      // Source
      if (transfer.fromPosId !== null) {
        const sourceMovement = getMovement(transfer.fromPosId, item.variantId);

        sourceMovement.openingDelta -= quantity;

        if (
          transfer.transferredAt >= startDate &&
          transfer.transferredAt <= endDate
        ) {
          sourceMovement.transferOut += quantity;
        }
      } else {
        const sourceMovement = getMovement(null, item.variantId);

        sourceMovement.openingDelta -= quantity;

        if (
          transfer.transferredAt >= startDate &&
          transfer.transferredAt <= endDate
        ) {
          sourceMovement.transferOut += quantity;
        }
      }

      // Destination
      if (transfer.toPosId !== null) {
        const destinationMovement = getMovement(
          transfer.toPosId,
          item.variantId,
        );

        destinationMovement.openingDelta += quantity;

        if (
          transfer.transferredAt >= startDate &&
          transfer.transferredAt <= endDate
        ) {
          destinationMovement.transferIn += quantity;
        }
      } else {
        const destinationMovement = getMovement(null, item.variantId);

        destinationMovement.openingDelta += quantity;

        if (
          transfer.transferredAt >= startDate &&
          transfer.transferredAt <= endDate
        ) {
          destinationMovement.transferIn += quantity;
        }
      }
    }
  }

  // ----------------------------------------------------------
  // LOSSES
  // ----------------------------------------------------------

  for (const loss of losses) {
    if (!loss.variantId) {
      continue;
    }

    const movement = getMovement(loss.pointOfSaleId, loss.variantId);
    const quantity = decimalToNumber(loss.quantity);

    movement.openingDelta -= quantity;

    if (loss.reportedAt >= startDate && loss.reportedAt <= endDate) {
      movement.losses += quantity;
    }
  }

  // ----------------------------------------------------------
  // MANUAL ENTRIES
  //
  // ACHAT / RECUPERATION / AJUSTEMENT
  // sont considérés comme des mouvements
  // d'entrée du stock.
  // ----------------------------------------------------------

  for (const entry of entries) {
    const pointOfSaleId = entry.finishedStock.pointOfSaleId;
    const variantId = entry.finishedStock.variantId;
    const movement = getMovement(pointOfSaleId, variantId);

    movement.openingDelta += entry.quantity;

    if (entry.createdAt >= startDate && entry.createdAt <= endDate) {
      movement.adjustments += entry.quantity;
    }
  }

  // ----------------------------------------------------------
  // SALES
  //
  // ATTENTION :
  //
  // InvoiceItem ne contient pas variantId.
  // On doit donc retrouver le variant correspondant au
  // produit + format.
  //
  // Pour éviter d'associer plusieurs variants identiques,
  // on récupère les variants du shop et on fait la résolution
  // par productName + BottleSize.
  // ----------------------------------------------------------

  const variants = await prisma.productVariant.findMany({
    where: {
      product: {
        shopId: shop.id,
      },
    },

    select: {
      id: true,

      product: {
        select: {
          name: true,
        },
      },

      packaging: {
        select: {
          size: true,
        },
      },
    },
  });

  const variantLookup = new Map<string, string>();

  for (const variant of variants) {
    const key = [variant.product.name, variant.packaging.size].join("|");

    variantLookup.set(key, variant.id);
  }

  for (const invoice of invoices) {
    if (!invoice.pointOfSaleId) {
      continue;
    }

    for (const item of invoice.items) {
      const variantId = variantLookup.get(
        [item.productName, item.size].join("|"),
      );

      if (!variantId) {
        continue;
      }

      const movement = getMovement(invoice.pointOfSaleId, variantId);

      movement.openingDelta -= item.quantity;

      if (invoice.createdAt >= startDate && invoice.createdAt <= endDate) {
        movement.sales += item.quantity;
      }
    }
  }

  // ----------------------------------------------------------
  // BUILD ROWS
  // ----------------------------------------------------------

  const rows = stocks.map((stock) => {
    const key = [stock.pointOfSaleId ?? "REMAINING", stock.variant.id].join(
      "|",
    );

    const movement = movementMap.get(key) ?? {
      openingDelta: 0,
      production: 0,
      transferIn: 0,
      transferOut: 0,
      sales: 0,
      losses: 0,
      adjustments: 0,
    };

    // ------------------------------------------------------
    // Stock au début de période
    //
    // current stock - delta cumulé de la période
    // ------------------------------------------------------

    const periodNetMovement =
      movement.production +
      movement.transferIn -
      movement.transferOut -
      movement.sales -
      movement.losses +
      movement.adjustments;

    const openingQuantity = stock.quantity - movement.openingDelta;
    const closingQuantity = openingQuantity + periodNetMovement;

    return {
      finishedStockId: stock.id,
      location: stock.pointOfSale
        ? {
            type: "POINT_OF_SALE" as const,
            id: stock.pointOfSale.id,
            name: stock.pointOfSale.name,
            code: stock.pointOfSale.code,
          }
        : {
            type: "REMAINING" as const,
            id: null,
            name: "Reste",
            code: null,
          },

      variant: {
        id: stock.variant.id,
        sku: stock.variant.sku,
        productName: stock.variant.product.name,
        size: stock.variant.packaging.size,
        capacityMl: stock.variant.packaging.capacityMl,
      },

      openingQuantity,
      production: movement.production,
      transferIn: movement.transferIn,
      transferOut: movement.transferOut,
      sales: movement.sales,
      losses: movement.losses,
      adjustments: movement.adjustments,
      closingQuantity,
      currentQuantity: stock.quantity,
      unitPrice: decimalToNumber(stock.variant.price),
      stockValue: closingQuantity * decimalToNumber(stock.variant.price),
    };
  });

  // ----------------------------------------------------------
  // SORT
  // ----------------------------------------------------------

  rows.sort((a, b) => {
    const locationA = a.location.name;
    const locationB = b.location.name;
    const locationCompare = locationA.localeCompare(locationB);

    if (locationCompare !== 0) {
      return locationCompare;
    }

    return a.variant.productName.localeCompare(b.variant.productName);
  });

  // ----------------------------------------------------------
  // TOTALS
  // ----------------------------------------------------------

  const totalOpeningQuantity = rows.reduce(
    (total, row) => total + row.openingQuantity,
    0,
  );

  const totalProduction = rows.reduce(
    (total, row) => total + row.production,
    0,
  );

  const totalTransferIn = rows.reduce(
    (total, row) => total + row.transferIn,
    0,
  );

  const totalTransferOut = rows.reduce(
    (total, row) => total + row.transferOut,
    0,
  );

  const totalSales = rows.reduce((total, row) => total + row.sales, 0);
  const totalLosses = rows.reduce((total, row) => total + row.losses, 0);
  const totalAdjustments = rows.reduce(
    (total, row) => total + row.adjustments,
    0,
  );

  const totalClosingQuantity = rows.reduce(
    (total, row) => total + row.closingQuantity,
    0,
  );

  const totalStockValue = rows.reduce(
    (total, row) => total + row.stockValue,
    0,
  );

  // ----------------------------------------------------------
  // RETURN
  // ----------------------------------------------------------

  return {
    type: "FINISHED_STOCK" as const,

    period: {
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
      startDate,
      endDate,
    },

    filter: {
      pointOfSaleId: pointOfSale?.id ?? null,
      pointOfSaleName: pointOfSale?.name ?? null,
      allLocations: !pointOfSale,
    },

    summary: {
      totalOpeningQuantity,
      totalProduction,
      totalTransferIn,
      totalTransferOut,
      totalSales,
      totalLosses,
      totalAdjustments,
      totalClosingQuantity,
      totalStockValue,
    },

    rows,
  };
}

// ============================================================
// GENERATE REPORT
// ============================================================

export async function generateReport(userId: string, input: ReportQueryInput) {
  switch (input.type) {
    case "SALES":
      return getSalesReport(userId, input);

    case "PRODUCTION":
      return getProductionReport(userId, input);

    case "RAW_MATERIAL_STOCK":
      return getRawMaterialStockReport(userId, input);

    case "FINISHED_STOCK":
      return getFinishedStockReport(userId, input);
  }
}
