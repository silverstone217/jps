// lib/modules/report/report.service.ts
import { prisma } from "@/lib/prisma";

import {
  InvoiceStatus,
  RawMaterialHistoryType,
  Role,
} from "@/app/generated/prisma/enums";

import type { ReportQueryInput } from "./report.schema";

// ======================================================
// TYPES
// ======================================================

type DateRange = {
  startDate: Date;
  endDate: Date;
};

type PointOfSaleInfo = {
  id: string;
  name: string;
  code: string;
};

type ReportPeriod = {
  dateFrom: string | null;
  dateTo: string | null;
  startDate: Date;
  endDate: Date;
};

// ======================================================
// ERRORS
// ======================================================

export class ReportServiceError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ReportServiceError";
  }
}

// ======================================================
// SERVICE
// ======================================================

export const ReportService = {
  // ====================================================
  // SHOP
  // ====================================================

  async getMainShop() {
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
  },

  // ====================================================
  // MANAGER
  // ====================================================

  async validateManager(userId: string) {
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
        shopOwner: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      throw new ReportServiceError(
        "USER_NOT_FOUND",
        "Utilisateur introuvable.",
      );
    }

    if (user.role !== Role.MANAGER) {
      throw new ReportServiceError(
        "FORBIDDEN",
        "Seul un manager peut consulter les rapports.",
      );
    }

    if (!user.isActive) {
      throw new ReportServiceError(
        "USER_INACTIVE",
        "Votre compte est inactif.",
      );
    }

    const isBanExpired =
      user.banExpiresAt !== null && user.banExpiresAt.getTime() <= Date.now();

    if (user.isBanned && !isBanExpired) {
      throw new ReportServiceError("USER_BANNED", "Votre compte est suspendu.");
    }

    return user;
  },

  // ====================================================
  // POS LIST
  // ====================================================

  async getPointOfSales(userId: string) {
    const user = await this.validateManager(userId);

    const shop = await this.getMainShop();

    if (!user.shopOwner) {
      throw new ReportServiceError(
        "FORBIDDEN",
        "Ce manager n'est associé à aucune boutique.",
      );
    }

    if (user.shopOwner.id !== shop.id) {
      throw new ReportServiceError(
        "FORBIDDEN",
        "Vous n'avez pas accès à cette boutique.",
      );
    }

    return prisma.pointOfSale.findMany({
      where: {
        shopId: shop.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  },

  // ====================================================
  // POS VALIDATION
  // ====================================================

  async validatePointOfSale(
    shopId: string,
    pointOfSaleId: string,
  ): Promise<PointOfSaleInfo> {
    const pointOfSale = await prisma.pointOfSale.findFirst({
      where: {
        id: pointOfSaleId,
        shopId,
        // isMainStore: false,
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

    if (!pointOfSale.isActive) {
      throw new ReportServiceError(
        "POINT_OF_SALE_INACTIVE",
        "Ce point de vente est désactivé.",
      );
    }

    return {
      id: pointOfSale.id,
      name: pointOfSale.name,
      code: pointOfSale.code,
    };
  },

  // ====================================================
  // DATE RANGE
  // ====================================================

  createDateRange(dateFrom?: string, dateTo?: string): DateRange {
    const today = new Date();

    const startDate = dateFrom
      ? new Date(`${dateFrom}T00:00:00+01:00`)
      : new Date(0);

    const endDate = dateTo
      ? new Date(`${dateTo}T23:59:59.999+01:00`)
      : new Date(`${today.toISOString().slice(0, 10)}T23:59:59.999+01:00`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new ReportServiceError(
        "INVALID_DATE_RANGE",
        "Les dates du rapport sont invalides.",
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
  },

  // ====================================================
  // PERIOD
  // ====================================================

  createPeriod(input: ReportQueryInput, range: DateRange): ReportPeriod {
    return {
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
      startDate: range.startDate,
      endDate: range.endDate,
    };
  },

  // ====================================================
  // DECIMAL
  // ====================================================

  decimalToNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    return Number(value);
  },

  // ====================================================
  // MAIN ENTRY
  // ====================================================

  async generateReport(userId: string, input: ReportQueryInput) {
    await this.validateManager(userId);

    switch (input.type) {
      case "SALES":
        return this.getSalesReport(userId, input);

      case "PRODUCTION":
        return this.getProductionReport(userId, input);

      case "RAW_MATERIAL_STOCK":
        return this.getRawMaterialStockReport(userId, input);

      case "FINISHED_STOCK":
        return this.getFinishedStockReport(userId, input);

      default:
        throw new ReportServiceError(
          "INVALID_REPORT_TYPE",
          "Type de rapport invalide.",
        );
    }
  },

  // ====================================================
  // SALES REPORT
  // ====================================================

  async getSalesReport(
    userId: string,
    input: Extract<ReportQueryInput, { type: "SALES" }>,
  ) {
    const user = await this.validateManager(userId);

    const shop = await this.getMainShop();

    if (!user.shopOwner || user.shopOwner.id !== shop.id) {
      throw new ReportServiceError(
        "FORBIDDEN",
        "Vous n'avez pas accès à cette boutique.",
      );
    }

    const range = this.createDateRange(input.dateFrom, input.dateTo);

    let selectedPointOfSale: PointOfSaleInfo | undefined;

    if (input.pointOfSaleId) {
      selectedPointOfSale = await this.validatePointOfSale(
        shop.id,
        input.pointOfSaleId,
      );
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: range.startDate,
          lte: range.endDate,
        },

        status: {
          not: InvoiceStatus.CANCELLED,
        },

        pointOfSaleId: input.pointOfSaleId
          ? input.pointOfSaleId
          : {
              not: null,
            },
      },

      select: {
        id: true,
        invoiceNumber: true,
        pointOfSaleId: true,
        pointOfSaleName: true,
        sellerName: true,
        subtotal: true,
        discountAmount: true,
        totalAmount: true,
        paymentMethod: true,
        currency: true,
        createdAt: true,

        items: {
          select: {
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

    // ==================================================
    // SUMMARY
    // ==================================================

    let totalSales = 0;
    let totalQuantity = 0;
    let grossAmount = 0;
    let discountAmount = 0;
    let netAmount = 0;

    const paymentMap = new Map<string, number>();

    const posMap = new Map<
      string,
      {
        pointOfSaleId: string | null;
        pointOfSaleName: string;
        totalSales: number;
        totalQuantity: number;
        grossAmount: number;
        discountAmount: number;
        netAmount: number;
      }
    >();

    const rowMap = new Map<
      string,
      {
        pointOfSaleId: string | null;
        pointOfSaleName: string;
        productName: string;
        size: string;
        unitPrice: number;
        quantity: number;
        grossAmount: number;
        discountAmount: number;
        netAmount: number;
      }
    >();

    for (const invoice of invoices) {
      totalSales += 1;

      const invoiceSubtotal = this.decimalToNumber(invoice.subtotal);

      const invoiceDiscount = this.decimalToNumber(invoice.discountAmount);

      const invoiceTotal = this.decimalToNumber(invoice.totalAmount);

      grossAmount += invoiceSubtotal;
      discountAmount += invoiceDiscount;
      netAmount += invoiceTotal;

      // ==================================================
      // PAYMENT
      // ==================================================

      const paymentKey = invoice.paymentMethod;

      paymentMap.set(
        paymentKey,
        (paymentMap.get(paymentKey) ?? 0) + invoiceTotal,
      );

      // ==================================================
      // POS
      // ==================================================

      const posKey =
        invoice.pointOfSaleId ?? `HISTORICAL:${invoice.pointOfSaleName}`;

      const existingPos = posMap.get(posKey);

      if (existingPos) {
        existingPos.totalSales += 1;
        existingPos.discountAmount += invoiceDiscount;
        existingPos.netAmount += invoiceTotal;
        existingPos.grossAmount += invoiceSubtotal;
      } else {
        posMap.set(posKey, {
          pointOfSaleId: invoice.pointOfSaleId,
          pointOfSaleName: invoice.pointOfSaleName,
          totalSales: 1,
          totalQuantity: 0,
          grossAmount: invoiceSubtotal,
          discountAmount: invoiceDiscount,
          netAmount: invoiceTotal,
        });
      }

      // ==================================================
      // ITEMS
      // ==================================================

      for (const item of invoice.items) {
        const quantity = item.quantity;

        const unitPrice = this.decimalToNumber(item.unitPrice);

        const itemSubtotal = this.decimalToNumber(item.subtotal);

        totalQuantity += quantity;

        const currentPos = posMap.get(posKey);

        if (currentPos) {
          currentPos.totalQuantity += quantity;
        }

        const rowKey = [posKey, item.productName, item.size, unitPrice].join(
          "|",
        );

        const existingRow = rowMap.get(rowKey);

        if (existingRow) {
          existingRow.quantity += quantity;
          existingRow.grossAmount += itemSubtotal;
          existingRow.netAmount += itemSubtotal;
        } else {
          rowMap.set(rowKey, {
            pointOfSaleId: invoice.pointOfSaleId,
            pointOfSaleName: invoice.pointOfSaleName,
            productName: item.productName,
            size: item.size,
            unitPrice,
            quantity,
            grossAmount: itemSubtotal,
            discountAmount: 0,
            netAmount: itemSubtotal,
          });
        }
      }
    }

    return {
      type: "SALES" as const,

      period: {
        dateFrom: input.dateFrom ?? null,
        dateTo: input.dateTo ?? null,
        startDate: range.startDate,
        endDate: range.endDate,
      },

      filter: {
        pointOfSaleId: selectedPointOfSale?.id ?? null,

        pointOfSaleName: selectedPointOfSale?.name ?? null,

        allPointOfSales: !input.pointOfSaleId,
      },

      summary: {
        totalSales,
        totalQuantity,
        grossAmount,
        discountAmount,
        netAmount,
      },

      paymentTotals: Array.from(paymentMap.entries()).map(
        ([paymentMethod, amount]) => ({
          paymentMethod,
          amount,
        }),
      ),

      byPointOfSale: Array.from(posMap.values()),

      rows: Array.from(rowMap.values()),
    };
  },

  // ====================================================
  // PRODUCTION REPORT
  // ====================================================

  async getProductionReport(
    userId: string,
    input: Extract<ReportQueryInput, { type: "PRODUCTION" }>,
  ) {
    const user = await this.validateManager(userId);

    const shop = await this.getMainShop();

    if (!user.shopOwner || user.shopOwner.id !== shop.id) {
      throw new ReportServiceError(
        "FORBIDDEN",
        "Vous n'avez pas accès à cette boutique.",
      );
    }

    const range = this.createDateRange(input.dateFrom, input.dateTo);

    const productions = await prisma.production.findMany({
      where: {
        producedAt: {
          gte: range.startDate,
          lte: range.endDate,
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

        ingredients: {
          select: {
            id: true,
            ingredientId: true,
            quantityUsed: true,

            ingredient: {
              select: {
                name: true,
                unit: true,
              },
            },
          },
        },

        packagings: {
          select: {
            id: true,
            packagingId: true,
            quantityUsed: true,

            packaging: {
              select: {
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
                sku: true,

                product: {
                  select: {
                    name: true,
                  },
                },

                packaging: {
                  select: {
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

    let totalVolumeMl = 0;
    let totalQuantityProduced = 0;

    const rows = productions.map((production) => {
      const totalVolume = this.decimalToNumber(production.totalVolumeMl);

      totalVolumeMl += totalVolume;

      const items = production.items.map((item) => {
        totalQuantityProduced += item.quantityProduced;

        return {
          id: item.id,
          variantId: item.variantId,
          productName: item.variant.product.name,
          sku: item.variant.sku,
          size: item.variant.packaging.size,
          capacityMl: item.variant.packaging.capacityMl,
          quantityProduced: item.quantityProduced,
          remainingQuantity: item.remainingQuantity,
          expiresAt: item.expiresAt,
        };
      });

      return {
        id: production.id,
        producedAt: production.producedAt,
        totalVolumeMl: totalVolume,
        notes: production.notes,

        ingredients: production.ingredients.map((item) => ({
          id: item.id,
          ingredientId: item.ingredientId,
          ingredientName: item.ingredient.name,
          quantityUsed: this.decimalToNumber(item.quantityUsed),
          unit: item.ingredient.unit,
        })),

        packagings: production.packagings.map((item) => ({
          id: item.id,
          packagingId: item.packagingId,
          packagingName: item.packaging.name,
          size: item.packaging.size,
          capacityMl: item.packaging.capacityMl,
          quantityUsed: item.quantityUsed,
        })),

        items,
      };
    });

    return {
      type: "PRODUCTION" as const,

      period: {
        dateFrom: input.dateFrom ?? null,
        dateTo: input.dateTo ?? null,
        startDate: range.startDate,
        endDate: range.endDate,
      },

      summary: {
        totalProductions: productions.length,
        totalVolumeMl,
        totalQuantityProduced,
      },

      rows,
    };
  },

  // ====================================================
  // RAW MATERIAL STOCK REPORT
  // ====================================================

  async getRawMaterialStockReport(
    userId: string,
    input: Extract<ReportQueryInput, { type: "RAW_MATERIAL_STOCK" }>,
  ) {
    const user = await this.validateManager(userId);

    const shop = await this.getMainShop();

    if (!user.shopOwner || user.shopOwner.id !== shop.id) {
      throw new ReportServiceError(
        "FORBIDDEN",
        "Vous n'avez pas accès à cette boutique.",
      );
    }

    const range = this.createDateRange(input.dateFrom, input.dateTo);

    const [ingredients, packagings, histories] = await Promise.all([
      prisma.rawIngredient.findMany({
        where: {
          shopId: shop.id,
        },

        select: {
          id: true,
          name: true,
          unit: true,
          stockQty: true,
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
        },

        orderBy: [
          {
            name: "asc",
          },
          {
            size: "asc",
          },
        ],
      }),

      prisma.rawMaterialHistory.findMany({
        where: {
          shopId: shop.id,

          createdAt: {
            lte: range.endDate,
          },
        },

        select: {
          id: true,
          ingredientId: true,
          packagingId: true,
          quantity: true,
          type: true,
          createdAt: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

    const getSignedQuantity = (
      type: RawMaterialHistoryType,
      quantity: number,
    ) => {
      switch (type) {
        case RawMaterialHistoryType.PURCHASE:
        case RawMaterialHistoryType.INITIALIZATION:
        case RawMaterialHistoryType.ADJUSTMENT:
          return quantity;

        case RawMaterialHistoryType.PRODUCTION:
        case RawMaterialHistoryType.LOSS:
          return -quantity;

        default:
          return 0;
      }
    };

    // ==================================================
    // INGREDIENTS
    // ==================================================

    const ingredientRows = ingredients.map((ingredient) => {
      const related = histories.filter(
        (history) => history.ingredientId === ingredient.id,
      );

      let openingQuantity = 0;
      let purchasedQuantity = 0;
      let productionQuantity = 0;
      let lossQuantity = 0;
      let adjustmentQuantity = 0;

      for (const history of related) {
        const quantity = this.decimalToNumber(history.quantity);

        const signed = getSignedQuantity(history.type, quantity);

        if (history.createdAt < range.startDate) {
          openingQuantity += signed;
        }

        if (
          history.createdAt >= range.startDate &&
          history.createdAt <= range.endDate
        ) {
          switch (history.type) {
            case RawMaterialHistoryType.PURCHASE:
              purchasedQuantity += quantity;
              break;

            case RawMaterialHistoryType.PRODUCTION:
              productionQuantity += quantity;
              break;

            case RawMaterialHistoryType.LOSS:
              lossQuantity += quantity;
              break;

            case RawMaterialHistoryType.ADJUSTMENT:
              adjustmentQuantity += quantity;
              break;
          }
        }
      }

      const closingQuantity = this.decimalToNumber(ingredient.stockQty);

      return {
        id: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        openingQuantity,
        purchasedQuantity,
        productionQuantity,
        lossQuantity,
        adjustmentQuantity,
        closingQuantity,
      };
    });

    // ==================================================
    // PACKAGINGS
    // ==================================================

    const packagingRows = packagings.map((packaging) => {
      const related = histories.filter(
        (history) => history.packagingId === packaging.id,
      );

      let openingQuantity = 0;
      let purchasedQuantity = 0;
      let productionQuantity = 0;
      let lossQuantity = 0;
      let adjustmentQuantity = 0;

      for (const history of related) {
        const quantity = this.decimalToNumber(history.quantity);

        const signed = getSignedQuantity(history.type, quantity);

        if (history.createdAt < range.startDate) {
          openingQuantity += signed;
        }

        if (
          history.createdAt >= range.startDate &&
          history.createdAt <= range.endDate
        ) {
          switch (history.type) {
            case RawMaterialHistoryType.PURCHASE:
              purchasedQuantity += quantity;
              break;

            case RawMaterialHistoryType.PRODUCTION:
              productionQuantity += quantity;
              break;

            case RawMaterialHistoryType.LOSS:
              lossQuantity += quantity;
              break;

            case RawMaterialHistoryType.ADJUSTMENT:
              adjustmentQuantity += quantity;
              break;
          }
        }
      }

      const closingQuantity = this.decimalToNumber(packaging.stockQty);

      return {
        id: packaging.id,
        name: packaging.name,
        size: packaging.size,
        capacityMl: packaging.capacityMl,
        openingQuantity,
        purchasedQuantity,
        productionQuantity,
        lossQuantity,
        adjustmentQuantity,
        closingQuantity,
      };
    });

    return {
      type: "RAW_MATERIAL_STOCK" as const,

      period: {
        dateFrom: input.dateFrom ?? null,
        dateTo: input.dateTo ?? null,
        startDate: range.startDate,
        endDate: range.endDate,
      },

      summary: {
        totalIngredients: ingredients.length,
        totalPackagings: packagings.length,
      },

      ingredients: ingredientRows,
      packagings: packagingRows,
    };
  },

  // ====================================================
  // FINISHED STOCK REPORT
  // ====================================================

  async getFinishedStockReport(
    userId: string,
    input: Extract<ReportQueryInput, { type: "FINISHED_STOCK" }>,
  ) {
    const user = await this.validateManager(userId);

    const shop = await this.getMainShop();

    if (!user.shopOwner || user.shopOwner.id !== shop.id) {
      throw new ReportServiceError(
        "FORBIDDEN",
        "Vous n'avez pas accès à cette boutique.",
      );
    }

    const range = this.createDateRange(input.dateFrom, input.dateTo);

    let selectedPointOfSale: PointOfSaleInfo | undefined;

    if (input.pointOfSaleId) {
      selectedPointOfSale = await this.validatePointOfSale(
        shop.id,
        input.pointOfSaleId,
      );
    }

    // ==================================================
    // CURRENT FINISHED STOCK
    // ==================================================

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
        variantId: true,
        quantity: true,

        pointOfSale: {
          select: {
            id: true,
            name: true,
            code: true,
            isMainStore: true,
          },
        },

        variant: {
          select: {
            id: true,
            sku: true,
            price: true,

            product: {
              select: {
                name: true,
              },
            },

            packaging: {
              select: {
                size: true,
                capacityMl: true,
              },
            },
          },
        },
      },

      orderBy: {
        variant: {
          product: {
            name: "asc",
          },
        },
      },
    });

    // ==================================================
    // ROWS
    // ==================================================

    const rows = stocks.map((stock) => {
      const unitPrice = this.decimalToNumber(stock.variant.price);

      const quantity = stock.quantity;

      return {
        variantId: stock.variant.id,

        productName: stock.variant.product.name,

        sku: stock.variant.sku,

        size: stock.variant.packaging.size,

        pointOfSale: stock.pointOfSale
          ? {
              id: stock.pointOfSale.id,
              name: stock.pointOfSale.name,
              code: stock.pointOfSale.code,
            }
          : null,

        // Stock central non distribué.
        pointOfSaleName: stock.pointOfSale?.name ?? "Reste",

        quantity,

        unitPrice,

        stockValue: quantity * unitPrice,
      };
    });

    // ==================================================
    // SUMMARY
    // ==================================================

    const totalQuantity = rows.reduce((total, row) => total + row.quantity, 0);

    const totalStockValue = rows.reduce(
      (total, row) => total + row.stockValue,
      0,
    );

    const totalVariants = new Set(rows.map((row) => row.variantId)).size;

    // ==================================================
    // RETURN
    // ==================================================

    return {
      type: "FINISHED_STOCK" as const,

      period: {
        dateFrom: input.dateFrom ?? null,
        dateTo: input.dateTo ?? null,
        startDate: range.startDate,
        endDate: range.endDate,
      },

      filter: {
        pointOfSaleId: selectedPointOfSale?.id ?? null,

        pointOfSaleName: selectedPointOfSale?.name ?? null,

        allPointOfSales: !input.pointOfSaleId,
      },

      summary: {
        totalVariants,
        totalQuantity,
        totalStockValue,
      },

      rows,
    };
  },
};
