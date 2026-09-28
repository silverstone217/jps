// lib/modules/customer/customer.schema.ts

import { z } from "zod";

// ======================================================
// PARAMÈTRES COMMUNS
// ======================================================

const searchSchema = z
  .string()
  .trim()
  .max(100, "La recherche ne peut pas dépasser 100 caractères")
  .optional();

const pageSchema = z.coerce
  .number({
    message: "Le numéro de page est invalide",
  })
  .int("Le numéro de page doit être un entier")
  .positive("Le numéro de page doit être supérieur à 0")
  .default(1);

const limitSchema = z.coerce
  .number({
    message: "La limite doit être un nombre",
  })
  .int("La limite doit être un entier")
  .positive("La limite doit être supérieure à 0")
  .max(50, "La limite ne peut pas dépasser 50")
  .default(20);

const updatedSinceSchema = z.coerce
  .date({
    message: "La date de synchronisation est invalide",
  })
  .optional();

// ======================================================
// LISTE DES CLIENTS
// ======================================================

export const getCustomersSchema = z.object({
  /**
   * Recherche par :
   * - nom du client
   * - numéro de téléphone
   *
   * La recherche est ensuite appliquée dans
   * le POS courant.
   */
  search: searchSchema,

  /**
   * POS demandé par le manager.
   *
   * Pour un employé, cette valeur ne doit pas être
   * considérée comme une autorisation : le service
   * utilisera obligatoirement son POS assigné.
   */
  pointOfSaleId: z
    .string()
    .trim()
    .min(1, "L'identifiant du point de vente est requis")
    .optional(),

  /**
   * Pagination.
   */
  page: pageSchema,

  limit: limitSchema,

  /**
   * Permet de préparer la synchronisation
   * offline-first.
   */
  updatedSince: updatedSinceSchema,
});

export type GetCustomersInput = z.infer<typeof getCustomersSchema>;

// ======================================================
// DÉTAIL D'UN CLIENT
// ======================================================

export const getCustomerSchema = z.object({
  /**
   * Identifiant du client.
   */
  clientId: z.string().trim().min(1, "L'identifiant du client est requis"),

  /**
   * POS dans lequel consulter l'historique.
   *
   * Pour le manager :
   * - le POS est choisi dans le filtre.
   *
   * Pour l'employé :
   * - le service imposera son POS assigné.
   */
  pointOfSaleId: z
    .string()
    .trim()
    .min(1, "L'identifiant du point de vente est requis")
    .optional(),

  /**
   * Pagination de l'historique des ventes.
   */
  page: pageSchema,

  limit: limitSchema,
});

export type GetCustomerInput = z.infer<typeof getCustomerSchema>;
