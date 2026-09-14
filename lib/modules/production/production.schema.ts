import { z } from "zod";

// ======================================================
// MATIÈRE PREMIÈRE UTILISÉE
// ======================================================

export const productionIngredientSchema = z.object({
  ingredientId: z.string().trim().min(1, "La matière première est requise"),

  quantityUsed: z
    .number({
      error: "La quantité utilisée est requise",
    })
    .positive("La quantité utilisée doit être supérieure à 0"),
});

export type ProductionIngredientInput = z.infer<
  typeof productionIngredientSchema
>;

// ======================================================
// EMBALLAGE UTILISÉ
// ======================================================

export const productionPackagingSchema = z.object({
  packagingId: z.string().trim().min(1, "L'emballage est requis"),

  quantityUsed: z
    .number({
      error: "La quantité d'emballages utilisée est requise",
    })
    .int("La quantité d'emballages doit être un nombre entier")
    .positive("La quantité d'emballages utilisée doit être supérieure à 0"),
});

export type ProductionPackagingInput = z.infer<
  typeof productionPackagingSchema
>;

// ======================================================
// PRODUIT FINI
// ======================================================

export const productionItemSchema = z.object({
  variantId: z.string().trim().min(1, "La variante du produit est requise"),

  quantityProduced: z
    .number({
      error: "La quantité produite est requise",
    })
    .int("La quantité produite doit être un nombre entier")
    .positive("La quantité produite doit être supérieure à 0"),
});

export type ProductionItemInput = z.infer<typeof productionItemSchema>;

// ======================================================
// CRÉATION D'UNE PRODUCTION
// ======================================================
//
// IMPORTANT :
//
// - managerId → utilisateur authentifié
// - productId → récupéré via les variantes
// - shopId → récupéré côté serveur
// - producedAt → new Date() côté serveur
// - expiresAt → calculé côté serveur
// - stocks → gérés par le service
//
// Le client envoie uniquement les données nécessaires
// à l'opération de production.
// ======================================================

export const createProductionSchema = z
  .object({
    pointOfSaleId: z.string().trim().min(1, "Le point de vente est requis"),

    totalVolumeMl: z
      .number({
        error: "Le volume total de production est requis",
      })
      .positive("Le volume total de production doit être supérieur à 0"),

    notes: z
      .string()
      .trim()
      .max(500, "La note ne peut pas dépasser 500 caractères")
      .optional()
      .or(z.literal("")),

    ingredients: z
      .array(productionIngredientSchema)
      .min(1, "La production doit contenir au moins une matière première")
      .max(
        50,
        "Une production ne peut pas contenir plus de 50 matières premières",
      ),

    packagings: z
      .array(productionPackagingSchema)
      .min(1, "La production doit contenir au moins un emballage")
      .max(20, "Une production ne peut pas contenir plus de 20 emballages"),

    items: z
      .array(productionItemSchema)
      .min(1, "La production doit générer au moins un produit fini")
      .max(
        50,
        "Une production ne peut pas contenir plus de 50 formats de produits finis",
      ),
  })
  .superRefine((data, ctx) => {
    // ==================================================
    // DOUBLONS MATIÈRES PREMIÈRES
    // ==================================================

    const ingredientIds = data.ingredients.map((item) => item.ingredientId);

    if (new Set(ingredientIds).size !== ingredientIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["ingredients"],
        message:
          "Une matière première ne peut apparaître qu'une seule fois dans une production",
      });
    }

    // ==================================================
    // DOUBLONS EMBALLAGES
    // ==================================================

    const packagingIds = data.packagings.map((item) => item.packagingId);

    if (new Set(packagingIds).size !== packagingIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["packagings"],
        message:
          "Un emballage ne peut apparaître qu'une seule fois dans une production",
      });
    }

    // ==================================================
    // DOUBLONS VARIANTES
    // ==================================================

    const variantIds = data.items.map((item) => item.variantId);

    if (new Set(variantIds).size !== variantIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message:
          "Une variante de produit ne peut apparaître qu'une seule fois dans une production",
      });
    }
  });

export type CreateProductionInput = z.infer<typeof createProductionSchema>;

// ======================================================
// IDENTIFIANT
// ======================================================

export const productionIdSchema = z.object({
  id: z.string().trim().min(1, "L'identifiant de la production est requis"),
});

export type ProductionIdInput = z.infer<typeof productionIdSchema>;

// ======================================================
// FILTRES
// ======================================================

export const productionQuerySchema = z.object({
  productId: z.string().trim().min(1).optional(),

  pointOfSaleId: z.string().trim().min(1).optional(),

  from: z.string().optional(),

  to: z.string().optional(),

  limit: z.coerce.number().int().min(1).max(100).optional().default(20),

  page: z.coerce.number().int().min(1).optional().default(1),
});

export type ProductionQueryInput = z.infer<typeof productionQuerySchema>;
