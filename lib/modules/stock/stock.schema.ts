import { z } from "zod";

// ======================================================
// FILTRES STOCK
// ======================================================

export const stockQuerySchema = z.object({
  pointOfSaleId: z
    .string()
    .trim()
    .min(1, "L'identifiant du point de vente est invalide")
    .optional(),

  limit: z.coerce.number().int().min(1).max(100).optional().default(20),

  page: z.coerce.number().int().min(1).optional().default(1),
});

export type StockQueryInput = z.infer<typeof stockQuerySchema>;

// ======================================================
// IDENTIFIANT VARIANTE
// ======================================================

export const stockVariantIdSchema = z.object({
  variantId: z
    .string()
    .trim()
    .min(1, "L'identifiant de la variante est requis"),
});

export type StockVariantIdInput = z.infer<typeof stockVariantIdSchema>;

// ======================================================
// FILTRES DÉTAIL STOCK VARIANTE
// ======================================================

export const stockVariantQuerySchema = z.object({
  pointOfSaleId: z
    .string()
    .trim()
    .min(1, "L'identifiant du point de vente est invalide")
    .optional(),
});

export type StockVariantQueryInput = z.infer<typeof stockVariantQuerySchema>;

// ======================================================
// AJUSTEMENT D'INVENTAIRE
// ======================================================
//
// IMPORTANT :
//
// - variantId → envoyé par le client
// - pointOfSaleId → envoyé uniquement pour un stock PDV
// - null / absent → stock central
// - actualQuantity → quantité réellement comptée
// - note → commentaire facultatif
//
// Le serveur détermine :
//
// - shopId
// - utilisateur connecté
// - quantité actuelle
// - différence d'inventaire
// - FinishedStock
// - FinishedStockEntry
// - FinishedStockLot
// - date de l'ajustement
// ======================================================

export const stockAdjustmentSchema = z.object({
  variantId: z
    .string()
    .trim()
    .min(1, "L'identifiant de la variante est requis"),

  pointOfSaleId: z
    .string()
    .trim()
    .min(1, "L'identifiant du point de vente est invalide")
    .nullable()
    .optional(),

  actualQuantity: z
    .number({
      error: "La quantité réelle est requise",
    })
    .int("La quantité réelle doit être un nombre entier")
    .nonnegative("La quantité réelle ne peut pas être négative"),

  note: z
    .string()
    .trim()
    .max(500, "La note ne peut pas dépasser 500 caractères")
    .optional()
    .or(z.literal("")),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
