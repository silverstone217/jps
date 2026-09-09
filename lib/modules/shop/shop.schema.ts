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
});

export type UpdateShopInput = z.infer<typeof updateShopSchema>;
