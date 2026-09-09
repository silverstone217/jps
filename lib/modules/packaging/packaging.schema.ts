import { z } from "zod";

const bottleSizeEnum = z.enum(["ML_200", "ML_500"]);

export const createPackagingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de l'emballage doit contenir au moins 2 caractères")
    .max(100, "Le nom de l'emballage ne peut pas dépasser 100 caractères"),

  size: bottleSizeEnum,

  capacityMl: z
    .number()
    .int("La capacité doit être un nombre entier")
    .positive("La capacité doit être supérieure à zéro"),

  stockQty: z
    .number()
    .int("Le stock initial doit être un nombre entier")
    .min(0, "Le stock initial ne peut pas être négatif")
    .optional()
    .default(0),

  minAlert: z
    .number()
    .int("Le seuil d'alerte doit être un nombre entier")
    .min(0, "Le seuil d'alerte ne peut pas être négatif")
    .optional()
    .default(50),

  isActive: z.boolean().optional().default(true),
});

export type CreatePackagingInput = z.infer<typeof createPackagingSchema>;

export const updatePackagingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de l'emballage doit contenir au moins 2 caractères")
    .max(100, "Le nom de l'emballage ne peut pas dépasser 100 caractères"),

  size: bottleSizeEnum,

  capacityMl: z
    .number()
    .int("La capacité doit être un nombre entier")
    .positive("La capacité doit être supérieure à zéro"),

  minAlert: z
    .number()
    .int("Le seuil d'alerte doit être un nombre entier")
    .min(0, "Le seuil d'alerte ne peut pas être négatif"),

  isActive: z.boolean().optional(),
});

export type UpdatePackagingInput = z.infer<typeof updatePackagingSchema>;

export const adjustPackagingStockSchema = z.object({
  quantity: z
    .number()
    .int("La quantité d'ajustement doit être un nombre entier")
    .refine(
      (value) => value !== 0,
      "La quantité d'ajustement ne peut pas être égale à zéro",
    ),

  note: z
    .string()
    .trim()
    .max(255, "La note ne peut pas dépasser 255 caractères")
    .optional()
    .or(z.literal("")),
});

export type AdjustPackagingStockInput = z.infer<
  typeof adjustPackagingStockSchema
>;

export const deletePackagingSchema = z.object({
  id: z.string().trim().min(1, "L'identifiant de l'emballage est requis"),
});

export type DeletePackagingInput = z.infer<typeof deletePackagingSchema>;
