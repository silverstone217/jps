import { z } from "zod";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "L'ancien mot de passe est requis"),

    newPassword: z
      .string()
      .min(6, "Le nouveau mot de passe doit contenir au moins 6 caractères")
      .max(12, "Le nouveau mot de passe ne peut pas dépasser 12 caractères"),

    confirmPassword: z
      .string()
      .min(1, "La confirmation du mot de passe est requise"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les nouveaux mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Le nouveau mot de passe doit être différent de l'ancien",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
