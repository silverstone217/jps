import { z } from "zod";

// ============================================================
// POS
// ============================================================

export const assignOrderPosSchema = z.object({
  pointOfSaleId: z.string().trim().min(1, "Le point de vente est requis"),
});

export const getOrderProductsSchema = z.object({
  pointOfSaleId: z.string().trim().min(1, "Le point de vente est requis"),
});

// ============================================================
// PRODUITS / COMMANDE
// ============================================================

export const orderItemSchema = z.object({
  variantId: z.string().trim().min(1, "La variante du produit est requise"),

  quantity: z
    .number()
    .int("La quantité doit être un nombre entier")
    .positive("La quantité doit être supérieure à 0"),
});

// ============================================================
// CLIENT
// ============================================================

export const orderCustomerSchema = z.object({
  id: z.string().trim().min(1).optional(),

  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères")
    .optional()
    .or(z.literal("")),

  phone: z
    .string()
    .trim()
    .regex(
      /^0\d{9}$/,
      "Le numéro de téléphone doit contenir exactement 10 chiffres et commencer par 0",
    ),
});

// ============================================================
// VALIDATION COMMANDE
// ============================================================

export const validateOrderSchema = z.object({
  pointOfSaleId: z.string().trim().min(1, "Le point de vente est requis"),

  items: z
    .array(orderItemSchema)
    .min(1, "La commande doit contenir au moins un produit"),

  customer: orderCustomerSchema.optional(),

  pointsUsed: z
    .number()
    .int("Les points utilisés doivent être un nombre entier")
    .nonnegative("Les points utilisés ne peuvent pas être négatifs")
    .default(0),

  paymentMethod: z
    .enum(["CASH", "MOBILE_MONEY", "CARD", "OTHER"])
    .default("CASH"),
});

// ============================================================
// TYPES
// ============================================================

export type AssignOrderPosInput = z.infer<typeof assignOrderPosSchema>;

export type GetOrderProductsInput = z.infer<typeof getOrderProductsSchema>;

export type OrderItemInput = z.infer<typeof orderItemSchema>;

export type OrderCustomerInput = z.infer<typeof orderCustomerSchema>;

export type ValidateOrderInput = z.infer<typeof validateOrderSchema>;
