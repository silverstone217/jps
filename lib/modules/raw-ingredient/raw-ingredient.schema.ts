import { z } from "zod";

const unitEnum = z.enum(["PIECE", "GRAM", "KILOGRAM", "MILLILITER", "LITER"]);

export const createRawIngredientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de la matière première doit contenir au moins 2 caractères")
    .max(
      100,
      "Le nom de la matière première ne peut pas dépasser 100 caractères",
    ),

  unit: unitEnum,

  stockQty: z
    .number()
    .min(0, "Le stock initial ne peut pas être négatif")
    .optional()
    .default(0),

  minAlert: z
    .number()
    .min(0, "Le seuil d'alerte ne peut pas être négatif")
    .optional()
    .default(5),

  isActive: z.boolean().optional().default(true),
});

export type CreateRawIngredientInput = z.infer<
  typeof createRawIngredientSchema
>;

export const updateRawIngredientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de la matière première doit contenir au moins 2 caractères")
    .max(
      100,
      "Le nom de la matière première ne peut pas dépasser 100 caractères",
    ),

  unit: unitEnum,

  minAlert: z.number().min(0, "Le seuil d'alerte ne peut pas être négatif"),

  isActive: z.boolean().optional(),
});

export type UpdateRawIngredientInput = z.infer<
  typeof updateRawIngredientSchema
>;

export const adjustRawIngredientStockSchema = z.object({
  quantity: z
    .number()
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

export type AdjustRawIngredientStockInput = z.infer<
  typeof adjustRawIngredientStockSchema
>;

export const deleteRawIngredientSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "L'identifiant de la matière première est requis"),
});

export type DeleteRawIngredientInput = z.infer<
  typeof deleteRawIngredientSchema
>;
