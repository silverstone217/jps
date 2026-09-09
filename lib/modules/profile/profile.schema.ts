import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(40, "Le nom ne peut pas dépasser 40 caractères"),

  telephone: z
    .string()
    .regex(
      /^0\d{9}$/,
      "Le numéro de téléphone doit contenir exactement 10 chiffres et commencer par 0",
    ),

  email: z.email("L'adresse email est invalide").or(z.literal("")),

  isActive: z.boolean().optional(),
});

export const updateProfileImageSchema = z.object({
  image: z.url("L'image doit être une URL valide"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateProfileImageInput = z.infer<typeof updateProfileImageSchema>;
