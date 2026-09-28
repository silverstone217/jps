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
// POS OPTIONNEL
// ======================================================

/**
 * POS utilisé pour filtrer l'activité du client.
 *
 * MANAGER :
 *   - fourni     → consultation d'un POS précis
 *   - absent     → consultation de tous les POS
 *
 * EMPLOYEE :
 *   - cette valeur n'est jamais une autorisation
 *   - le service impose toujours le POS assigné
 *
 * IMPORTANT :
 * Customer n'appartient pas à un POS.
 * Le POS sert uniquement à filtrer son activité
 * (factures, statistiques, historique, etc.).
 */
const pointOfSaleIdSchema = z
  .string()
  .trim()
  .min(1, "L'identifiant du point de vente est requis")
  .optional();

// ======================================================
// LISTE DES CLIENTS
// ======================================================

export const getCustomersSchema = z.object({
  /**
   * Recherche par :
   * - nom du client
   * - numéro de téléphone
   */
  search: searchSchema,

  /**
   * Filtre optionnel par POS.
   *
   * MANAGER :
   *   - POS fourni → clients ayant une activité
   *     dans ce POS
   *   - aucun POS → clients de tous les POS
   *
   * EMPLOYEE :
   *   - le service ignore ce filtre
   *   - seul son POS assigné est utilisé
   */
  pointOfSaleId: pointOfSaleIdSchema,

  /**
   * Pagination.
   */
  page: pageSchema,

  limit: limitSchema,

  /**
   * Synchronisation offline-first.
   *
   * Permet de récupérer les clients dont les données
   * ou l'activité ont changé depuis cette date.
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
   * Filtre optionnel par POS.
   *
   * MANAGER :
   *   - POS fourni → détail et historique de ce POS
   *   - aucun POS → détail et historique de tous les POS
   *
   * EMPLOYEE :
   *   - le service ignore cette valeur
   *   - seul son POS assigné est utilisé
   *
   * Customer reste global à la boutique MAIN.
   */
  pointOfSaleId: pointOfSaleIdSchema,

  /**
   * Pagination de l'historique des factures.
   */
  page: pageSchema,

  limit: limitSchema,
});

export type GetCustomerInput = z.infer<typeof getCustomerSchema>;
