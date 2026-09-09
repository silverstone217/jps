import { z } from "zod";

const telephoneSchema = z
  .string()
  .trim()
  .regex(
    /^0\d{9}$/,
    "Le numéro de téléphone doit contenir exactement 10 chiffres et commencer par 0",
  );

const emailSchema = z
  .email("L'adresse email n'est pas valide")
  .or(z.literal(""));

export const createEmployeeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de l'employé doit contenir au moins 2 caractères")
    .max(40, "Le nom de l'employé ne peut pas dépasser 40 caractères"),

  telephone: telephoneSchema,

  email: emailSchema,

  pointOfSaleId: z
    .string()
    .trim()
    .min(1, "Le point de vente est requis")
    .optional()
    .or(z.literal("")),

  isActive: z.boolean().optional().default(true),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de l'employé doit contenir au moins 2 caractères")
    .max(40, "Le nom de l'employé ne peut pas dépasser 40 caractères"),

  telephone: telephoneSchema,

  email: emailSchema,

  pointOfSaleId: z
    .string()
    .trim()
    .min(1, "Le point de vente est requis")
    .optional()
    .or(z.literal("")),

  isActive: z.boolean().optional().default(true),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const deleteEmployeeSchema = z.object({
  id: z.string().trim().min(1, "L'identifiant de l'employé est requis"),
});

export type DeleteEmployeeInput = z.infer<typeof deleteEmployeeSchema>;
