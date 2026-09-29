import { z } from "zod";

// ============================================================
// REPORT TYPES
// ============================================================

export const reportTypeSchema = z.enum([
  "SALES",
  "PRODUCTION",
  "RAW_MATERIAL_STOCK",
  "FINISHED_STOCK",
]);

// ============================================================
// BASE REPORT SCHEMA
// ============================================================

const baseReportSchema = z.object({
  dateFrom: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "La date de début doit être au format YYYY-MM-DD.",
    )
    .optional(),

  dateTo: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "La date de fin doit être au format YYYY-MM-DD.",
    )
    .optional(),
});

// ============================================================
// SALES REPORT
// ============================================================

const salesReportSchema = baseReportSchema.extend({
  type: z.literal("SALES"),
  pointOfSaleId: z.string().trim().min(1).optional(),
});

// ============================================================
// PRODUCTION REPORT
// ============================================================

const productionReportSchema = baseReportSchema.extend({
  type: z.literal("PRODUCTION"),
});

// ============================================================
// RAW MATERIAL STOCK REPORT
// ============================================================

const rawMaterialStockReportSchema = baseReportSchema.extend({
  type: z.literal("RAW_MATERIAL_STOCK"),
});

// ============================================================
// FINISHED STOCK REPORT
// ============================================================

const finishedStockReportSchema = baseReportSchema.extend({
  type: z.literal("FINISHED_STOCK"),
  pointOfSaleId: z.string().trim().min(1).optional(),
});

// ============================================================
// REPORT QUERY
// ============================================================

export const reportQuerySchema = z.discriminatedUnion("type", [
  salesReportSchema,
  productionReportSchema,
  rawMaterialStockReportSchema,
  finishedStockReportSchema,
]);

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
