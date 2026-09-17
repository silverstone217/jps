import { z } from "zod";

const lossReasonSchema = z.enum([
  "EXPIRED",
  "DAMAGED",
  "STOLEN",
  "QUAL_REJECT",
  "OTHER",
]);

const baseLossSchema = z.object({
  quantity: z.coerce.number().positive("La quantité doit être supérieure à 0."),

  reason: lossReasonSchema,

  note: z
    .string()
    .trim()
    .max(500, "La note ne peut pas dépasser 500 caractères.")
    .optional(),

  pointOfSaleId: z.string().trim().min(1).optional(),
});

const rawIngredientLossSchema = baseLossSchema.extend({
  category: z.literal("RAW_INGREDIENT"),

  ingredientId: z.string().trim().min(1, "L'ingrédient est requis."),

  packagingId: z.undefined().optional(),
  variantId: z.undefined().optional(),
  finishedStockLotId: z.undefined().optional(),
  pointOfSaleId: z.undefined().optional(),
});

const packagingLossSchema = baseLossSchema.extend({
  category: z.literal("PACKAGING"),

  packagingId: z.string().trim().min(1, "Le packaging est requis."),

  ingredientId: z.undefined().optional(),
  variantId: z.undefined().optional(),
  finishedStockLotId: z.undefined().optional(),
  pointOfSaleId: z.undefined().optional(),
});

const finishedProductLossSchema = baseLossSchema.extend({
  category: z.literal("FINISHED_PRODUCT"),

  variantId: z.string().trim().min(1, "Le produit est requis."),

  finishedStockLotId: z.string().trim().min(1, "Le lot est requis."),

  ingredientId: z.undefined().optional(),
  packagingId: z.undefined().optional(),
});

export const createLossSchema = z.discriminatedUnion("category", [
  rawIngredientLossSchema,
  packagingLossSchema,
  finishedProductLossSchema,
]);

export type CreateLossInput = z.infer<typeof createLossSchema>;
