import { z } from "zod";

// ======================================================
// ÉLÉMENT DE RECETTE
// ======================================================

export const recipeItemSchema = z.object({
  ingredientId: z
    .string()
    .trim()
    .min(1, "L'identifiant de la matière première est requis"),

  quantity: z
    .number({
      error: "La quantité est requise",
    })
    .positive("La quantité doit être supérieure à 0")
    .finite("La quantité doit être un nombre valide"),
});

export type RecipeItemInput = z.infer<typeof recipeItemSchema>;

// ======================================================
// CRÉATION D'UNE RECETTE
// ======================================================

export const createRecipeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de la recette doit contenir au moins 2 caractères")
    .max(80, "Le nom de la recette ne peut pas dépasser 80 caractères"),

  description: z
    .string()
    .trim()
    .max(500, "La description ne peut pas dépasser 500 caractères")
    .optional()
    .or(z.literal("")),

  productionVolumeMl: z
    .number({
      error: "Le volume de production est requis",
    })
    .int("Le volume de production doit être un nombre entier")
    .positive("Le volume de production doit être supérieur à 0"),

  items: z
    .array(recipeItemSchema)
    .min(1, "La recette doit contenir au moins un ingrédient")
    .max(50, "Une recette ne peut pas contenir plus de 50 ingrédients"),
});

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

// ======================================================
// MODIFICATION D'UNE RECETTE
// ======================================================

export const updateRecipeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de la recette doit contenir au moins 2 caractères")
    .max(80, "Le nom de la recette ne peut pas dépasser 80 caractères"),

  description: z
    .string()
    .trim()
    .max(500, "La description ne peut pas dépasser 500 caractères")
    .optional()
    .or(z.literal("")),

  productionVolumeMl: z
    .number({
      error: "Le volume de production est requis",
    })
    .int("Le volume de production doit être un nombre entier")
    .positive("Le volume de production doit être supérieur à 0"),

  items: z
    .array(
      recipeItemSchema.extend({
        id: z.string().trim().min(1).optional(),
      }),
    )
    .min(1, "La recette doit contenir au moins un ingrédient")
    .max(50, "Une recette ne peut pas contenir plus de 50 ingrédients"),
});

export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

// ======================================================
// IDENTIFIANT
// ======================================================

export const recipeIdSchema = z.object({
  id: z.string().trim().min(1, "L'identifiant de la recette est requis"),
});

export type RecipeIdInput = z.infer<typeof recipeIdSchema>;

// ======================================================
// TYPES DE RÉPONSE
// ======================================================

export interface RecipeItemData {
  id: string;
  recipeId: string;
  ingredientId: string;
  quantity: number;
}

export interface RecipeData {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  productionVolumeMl: number;
  createdAt: string;
  updatedAt: string;
  items: RecipeItemData[];
}
