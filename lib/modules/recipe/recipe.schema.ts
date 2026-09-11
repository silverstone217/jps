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
//
// Ce schéma représente uniquement les données propres
// à la recette.
//
// productId n'est volontairement PAS présent ici.
// Le service reçoit productId séparément.
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
// REQUÊTE HTTP DE CRÉATION
// ======================================================
//
// Le client envoie productId avec les données de recette.
//
// Exemple :
//
// {
//   productId: "...",
//   name: "Jus Ananas",
//   description: "...",
//   productionVolumeMl: 2000,
//   items: []
// }
//
// productId est ensuite séparé dans la route avant
// d'appeler le service.
// ======================================================

export const createRecipeRequestSchema = createRecipeSchema.extend({
  productId: z.string().trim().min(1, "Le produit est requis"),
});

export type CreateRecipeRequestInput = z.infer<
  typeof createRecipeRequestSchema
>;

// ======================================================
// MODIFICATION D'UNE RECETTE
// ======================================================
//
// productId n'est pas nécessaire ici.
// L'identifiant de la recette dans l'URL permet déjà
// de retrouver le produit concerné.
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
        id: z
          .string()
          .trim()
          .min(1, "L'identifiant de l'élément est invalide")
          .optional(),
      }),
    )
    .min(1, "Une recette doit contenir au moins un ingrédient")
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
  productId: string;
  name: string;
  description: string | null;
  productionVolumeMl: number;
  createdAt: string;
  updatedAt: string;
  items: RecipeItemData[];
}
