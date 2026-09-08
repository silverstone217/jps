import { z } from "zod";

export const loginSchema = z.object({
  telephone: z
    .string()
    .regex(
      /^0\d{9}$/,
      "Le numéro doit contenir exactement 10 chiffres et commencer par 0",
    ),

  password: z.string().min(1, "Le mot de passe est requis"),
});

export type LoginInput = z.infer<typeof loginSchema>;
