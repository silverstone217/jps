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
    .positive("Le prix doit être supérieur à 0")
    .finite("Le prix doit être un nombre valide"),

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
    .max(500, "La description ne peut pas dépasser 500 caractères")
    .optional()
    .or(z.literal("")),

  recipeId: z
    .string()
    .trim()
    .min(1, "L'identifiant de la recette est invalide")
    .optional()
    .or(z.literal("")),

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
    .max(500, "La description ne peut pas dépasser 500 caractères")
    .optional()
    .or(z.literal("")),

  recipeId: z
    .string()
    .trim()
    .min(1, "L'identifiant de la recette est invalide")
    .optional()
    .or(z.literal("")),

  isActive: z.boolean().optional(),

  variants: z
    .array(
      productVariantSchema.extend({
        id: z.string().trim().min(1).optional(),
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

// Utilisé lorsqu'une URL Cloudinary doit être validée.
// Le fichier image lui-même sera validé dans la route
// /products/[id]/image.

export const productImageSchema = z.object({
  image: z.url("L'image doit être une URL valide"),
});

export type ProductImageInput = z.infer<typeof productImageSchema>;

// ======================================================
// RÉPONSE / TYPES MÉTIER
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

export interface ProductData {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  image: string | null;
  recipeId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  variants: ProductVariantData[];
}
