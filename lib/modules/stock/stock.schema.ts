import { z } from "zod";

// ======================================================
// LOCALISATION DU STOCK
// ======================================================

export const stockLocationSchema = z
  .object({
    locationType: z.enum(["MAIN", "POS"], {
      error: "Le type d'emplacement est invalide",
    }),

    pointOfSaleId: z
      .string()
      .trim()
      .min(1, "L'identifiant du point de vente est requis")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.locationType === "POS" && !data.pointOfSaleId) {
      ctx.addIssue({
        code: "custom",
        path: ["pointOfSaleId"],
        message: "Le point de vente est requis.",
      });
    }

    if (data.locationType === "MAIN" && data.pointOfSaleId) {
      ctx.addIssue({
        code: "custom",
        path: ["pointOfSaleId"],
        message: "Le stock principal ne nécessite pas de point de vente.",
      });
    }
  });

export type StockLocationInput = z.infer<typeof stockLocationSchema>;

// ======================================================
// CATÉGORIE DE STOCK
// ======================================================

export const stockCategorySchema = z.enum(
  ["RAW_INGREDIENT", "PACKAGING", "FINISHED_PRODUCT"],
  {
    error: "La catégorie de stock est invalide",
  },
);

export type StockCategory = z.infer<typeof stockCategorySchema>;

// ======================================================
// FILTRES DU STOCK
// ======================================================

export const stockQuerySchema = z.object({
  locationType: z
    .enum(["MAIN", "POS"], {
      error: "Le type d'emplacement est invalide",
    })
    .optional(),

  pointOfSaleId: z
    .string()
    .trim()
    .min(1, "L'identifiant du point de vente est invalide")
    .optional(),

  category: stockCategorySchema.optional(),

  search: z
    .string()
    .trim()
    .max(100, "La recherche ne peut pas dépasser 100 caractères")
    .optional(),

  lowStock: z.coerce
    .boolean({
      error: "Le filtre de stock faible est invalide",
    })
    .optional(),

  page: z.coerce
    .number()
    .int()
    .min(1, "La page doit être supérieure ou égale à 1")
    .optional()
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .min(1, "La limite doit être supérieure ou égale à 1")
    .max(50, "La limite ne peut pas dépasser 50")
    .optional()
    .default(20),
});

export type StockQueryInput = z.infer<typeof stockQuerySchema>;

// ======================================================
// IDENTIFIANT D'UNE VARIANTE
// ======================================================

export const stockVariantIdSchema = z.object({
  variantId: z
    .string()
    .trim()
    .min(1, "L'identifiant de la variante est requis"),
});

export type StockVariantIdInput = z.infer<typeof stockVariantIdSchema>;
