import { z } from "zod";

/**
 * ======================================================
 * CRÉATION D'UN POINT DE VENTE
 * ======================================================
 */
export const createPointOfSaleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom du point de vente doit contenir au moins 2 caractères")
    .max(50, "Le nom du point de vente ne peut pas dépasser 50 caractères"),

  code: z
    .string()
    .trim()
    .min(2, "Le code du point de vente doit contenir au moins 2 caractères")
    .max(20, "Le code du point de vente ne peut pas dépasser 20 caractères")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Le code ne peut contenir que des lettres, chiffres, tirets et underscores",
    )
    .transform((value) => value.toUpperCase()),

  telephone: z
    .string()
    .trim()
    .regex(
      /^0\d{9}$/,
      "Le numéro de téléphone doit contenir exactement 10 chiffres et commencer par 0",
    )
    .optional()
    .or(z.literal("")),

  address: z
    .string()
    .trim()
    .max(255, "L'adresse ne peut pas dépasser 255 caractères")
    .optional()
    .or(z.literal("")),

  isMainStore: z.boolean().optional().default(false),

  isActive: z.boolean().optional().default(true),
});

export type CreatePointOfSaleInput = z.infer<typeof createPointOfSaleSchema>;

/**
 * ======================================================
 * MODIFICATION D'UN POINT DE VENTE
 * ======================================================
 */
export const updatePointOfSaleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom du point de vente doit contenir au moins 2 caractères")
    .max(50, "Le nom du point de vente ne peut pas dépasser 50 caractères"),

  code: z
    .string()
    .trim()
    .min(2, "Le code du point de vente doit contenir au moins 2 caractères")
    .max(20, "Le code du point de vente ne peut pas dépasser 20 caractères")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Le code ne peut contenir que des lettres, chiffres, tirets et underscores",
    )
    .transform((value) => value.toUpperCase()),

  telephone: z
    .string()
    .trim()
    .regex(
      /^0\d{9}$/,
      "Le numéro de téléphone doit contenir exactement 10 chiffres et commencer par 0",
    )
    .optional()
    .or(z.literal("")),

  address: z
    .string()
    .trim()
    .max(255, "L'adresse ne peut pas dépasser 255 caractères")
    .optional()
    .or(z.literal("")),

  isMainStore: z.boolean().optional(),

  isActive: z.boolean().optional(),
});

// ============================================================
// AFFECTER UN EMPLOYÉ
// ============================================================

export const assignEmployeeSchema = z.object({
  employeeId: z.string().trim().min(1, "L'identifiant de l'employé est requis"),
});

export type AssignEmployeeInput = z.infer<typeof assignEmployeeSchema>;

export type UpdatePointOfSaleInput = z.infer<typeof updatePointOfSaleSchema>;

/**
 * ======================================================
 * SUPPRESSION D'UN POINT DE VENTE
 * ======================================================
 */
export const deletePointOfSaleSchema = z.object({
  id: z.string().trim().min(1, "L'identifiant du point de vente est requis"),
});

export type DeletePointOfSaleInput = z.infer<typeof deletePointOfSaleSchema>;
