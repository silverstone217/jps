import { z } from "zod";

// ======================================================
// VARIANTE DE PRODUIT
// ======================================================

export const productVariantSchema = z.object({
  packagingId: z.string().trim().min(1, "L'emballage est requis"),

  sku: z
    .string()
    .trim()
    .min(1, "Le SKU est requis")
    .max(50, "Le SKU ne peut pas dépasser 50 caractères")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Le SKU ne peut contenir que des lettres, chiffres, tirets et underscores",
    )
    .transform((value) => value.toUpperCase()),

  price: z
    .number({
      error: "Le prix est requis",
    })
    .positive("Le prix doit être supérieur à 0"),

  shelfLifeDays: z
    .number({
      error: "La durée de conservation est requise",
    })
    .int("La durée de conservation doit être un nombre entier")
    .min(1, "La durée de conservation doit être d'au moins 1 jour")
    .max(365, "La durée de conservation ne peut pas dépasser 365 jours")
    .default(2),

  isActive: z.boolean().optional().default(true),
});

export type ProductVariantInput = z.infer<typeof productVariantSchema>;

// ======================================================
// ITEM DE RECETTE
// ======================================================

export const productRecipeItemSchema = z.object({
  ingredientId: z.string().trim().min(1, "La matière première est requise"),

  quantity: z
    .number({
      error: "La quantité est requise",
    })
    .positive("La quantité doit être supérieure à 0")
    .finite("La quantité doit être un nombre valide"),
});

export type ProductRecipeItemInput = z.infer<typeof productRecipeItemSchema>;

// ======================================================
// RECETTE DU PRODUIT
// ======================================================

export const productRecipeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de la recette doit contenir au moins 2 caractères")
    .max(80, "Le nom de la recette ne peut pas dépasser 80 caractères"),

  description: z
    .string()
    .trim()
    .max(
      500,
      "La description de la recette ne peut pas dépasser 500 caractères",
    )
    .optional()
    .or(z.literal("")),

  productionVolumeMl: z
    .number({
      error: "Le volume de production est requis",
    })
    .int("Le volume de production doit être un nombre entier")
    .positive("Le volume de production doit être supérieur à 0"),

  items: z
    .array(productRecipeItemSchema)
    .min(1, "La recette doit contenir au moins un ingrédient")
    .max(50, "Une recette ne peut pas contenir plus de 50 ingrédients"),
});

export type ProductRecipeInput = z.infer<typeof productRecipeSchema>;

// ======================================================
// CRÉATION D'UN PRODUIT
// ======================================================

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom du produit doit contenir au moins 2 caractères")
    .max(80, "Le nom du produit ne peut pas dépasser 80 caractères"),

  description: z
    .string()
    .trim()
    .max(500, "Le nom du produit ne peut pas dépasser 500 caractères")
    .optional()
    .or(z.literal("")),

  recipe: productRecipeSchema.optional(),

  isActive: z.boolean().optional().default(true),

  variants: z
    .array(productVariantSchema)
    .min(1, "Le produit doit avoir au moins une variante")
    .max(2, "Un produit ne peut avoir que deux variantes"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// ======================================================
// MODIFICATION D'UN PRODUIT
// ======================================================

export const updateProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom du produit doit contenir au moins 2 caractères")
    .max(80, "Le nom du produit ne peut pas dépasser 80 caractères"),

  description: z
    .string()
    .trim()
    .max(500, "La description du produit ne peut pas dépasser 500 caractères")
    .optional()
    .or(z.literal("")),

  recipe: productRecipeSchema.optional(),

  isActive: z.boolean().optional(),

  variants: z
    .array(
      productVariantSchema.extend({
        id: z
          .string()
          .trim()
          .min(1, "L'identifiant de la variante est invalide")
          .optional(),
      }),
    )
    .min(1, "Le produit doit avoir au moins une variante")
    .max(2, "Un produit ne peut avoir que deux variantes"),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ======================================================
// IDENTIFIANT
// ======================================================

export const productIdSchema = z.object({
  id: z.string().trim().min(1, "L'identifiant du produit est requis"),
});

export type ProductIdInput = z.infer<typeof productIdSchema>;

// ======================================================
// IMAGE
// ======================================================

// Utilisé lorsqu'une URL Cloudinary
// doit être validée.
//
// Le fichier image lui-même sera validé
// dans la route /products/[id]/image.

export const productImageSchema = z.object({
  image: z.url("L'image doit être une URL valide"),
});

export type ProductImageInput = z.infer<typeof productImageSchema>;

// ======================================================
// TYPES MÉTIER — RECETTE
// ======================================================

export interface ProductRecipeItemData {
  id: string;
  recipeId: string;
  ingredientId: string;
  quantity: number;
}

export interface ProductRecipeData {
  id: string;
  productId: string;
  name: string;
  description: string | null;
  productionVolumeMl: number;
  createdAt: string;
  updatedAt: string;
  items: ProductRecipeItemData[];
}

// ======================================================
// TYPES MÉTIER — VARIANTE
// ======================================================

export interface ProductVariantData {
  id: string;
  productId: string;
  packagingId: string;
  sku: string;
  price: number;
  shelfLifeDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ======================================================
// TYPES MÉTIER — PRODUIT
// ======================================================

export interface ProductData {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  image: string | null;

  recipe: ProductRecipeData | null;

  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  variants: ProductVariantData[];
}
