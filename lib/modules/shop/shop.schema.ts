import { z } from "zod";

export const updateShopSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de la boutique doit contenir au moins 2 caractères")
    .max(40, "Le nom de la boutique ne peut pas dépasser 40 caractères"),

  slogan: z
    .string()
    .trim()
    .max(150, "Le slogan ne peut pas dépasser 150 caractères")
    .optional()
    .or(z.literal("")),

  telephone: z
    .string()
    .regex(
      /^0\d{9}$/,
      "Le numéro de téléphone doit contenir exactement 10 chiffres et commencer par 0",
    ),

  email: z.email("L'adresse email est invalide").or(z.literal("")),

  address: z
    .string()
    .trim()
    .max(255, "L'adresse ne peut pas dépasser 255 caractères")
    .optional()
    .or(z.literal("")),

  currency: z.enum(["CDF", "USD", "EUR"], {
    message: "La devise sélectionnée est invalide",
  }),

  // ======================================================
  // FIDÉLITÉ
  // ======================================================

  loyaltyPurchaseAmount: z
    .number()
    .positive("Le montant d'achat doit être supérieur à 0"),

  loyaltyPointsEarned: z
    .number()
    .int("Le nombre de points doit être un nombre entier")
    .positive("Le nombre de points doit être supérieur à 0"),

  loyaltyPointsForDiscount: z
    .number()
    .int("Le nombre de points doit être un nombre entier")
    .positive("Le nombre de points doit être supérieur à 0"),

  loyaltyDiscountAmount: z
    .number()
    .positive("Le montant de la réduction doit être supérieur à 0"),
});

export type UpdateShopInput = z.infer<typeof updateShopSchema>;
