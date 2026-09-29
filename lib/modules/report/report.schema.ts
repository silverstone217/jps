// lib/modules/report/report.schema.ts

import { z } from "zod";

// ======================================================
// REPORT TYPES
// ======================================================

export const reportTypeSchema = z.enum([
  "SALES",
  "PRODUCTION",
  "RAW_MATERIAL_STOCK",
  "FINISHED_STOCK",
]);

export type ReportType = z.infer<typeof reportTypeSchema>;

// ======================================================
// DATE SCHEMA
// ======================================================

const reportDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La date doit être au format YYYY-MM-DD.");

// ======================================================
// BASE
// ======================================================

const baseReportSchema = z.object({
  dateFrom: reportDateSchema.optional(),

  dateTo: reportDateSchema.optional(),
});

// ======================================================
// SALES
// ======================================================

const salesReportSchema = baseReportSchema.extend({
  type: z.literal("SALES"),

  /**
   * POS actuel sélectionné par le manager.
   *
   * undefined = tous les POS.
   *
   * Le rapport historique utilise ensuite
   * Invoice.pointOfSaleName pour afficher le POS,
   * même si celui-ci a été supprimé/désactivé.
   */
  pointOfSaleId: z.string().trim().min(1).optional(),
});

// ======================================================
// PRODUCTION
// ======================================================

const productionReportSchema = baseReportSchema.extend({
  type: z.literal("PRODUCTION"),
});

// ======================================================
// RAW MATERIAL STOCK
// ======================================================

const rawMaterialStockReportSchema = baseReportSchema.extend({
  type: z.literal("RAW_MATERIAL_STOCK"),
});

// ======================================================
// FINISHED STOCK
// ======================================================

const finishedStockReportSchema = baseReportSchema.extend({
  type: z.literal("FINISHED_STOCK"),

  /**
   * undefined = tous les POS + Reste
   *
   * sinon = POS précis.
   */
  pointOfSaleId: z.string().trim().min(1).optional(),
});

// ======================================================
// REPORT QUERY
// ======================================================

export const reportQuerySchema = z.discriminatedUnion("type", [
  salesReportSchema,
  productionReportSchema,
  rawMaterialStockReportSchema,
  finishedStockReportSchema,
]);

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;

// ======================================================
// POS LIST
// ======================================================

/**
 * Le endpoint qui alimente PointOfSaleSelector
 * ne nécessite aucun paramètre.
 *
 * Le shop et le manager sont résolus depuis
 * l'utilisateur authentifié côté service.
 */
export const reportPointOfSaleSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
});

export type ReportPointOfSale = z.infer<typeof reportPointOfSaleSchema>;

export const reportPointOfSalesResponseSchema = z.object({
  success: z.literal(true),

  data: z.array(reportPointOfSaleSchema),
});

export type ReportPointOfSalesResponse = z.infer<
  typeof reportPointOfSalesResponseSchema
>;
