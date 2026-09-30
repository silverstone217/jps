import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.email("Adresse email invalide"),

  telephone: z
    .string()
    .trim()
    .regex(/^0\d{9}$/, "Le numéro de téléphone doit contenir 10 chiffres"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est requis"),

    newPassword: z
      .string()
      .min(6, "Le nouveau mot de passe doit contenir au moins 6 caractères"),

    confirmPassword: z
      .string()
      .min(1, "La confirmation du mot de passe est requise"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
