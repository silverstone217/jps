import { z } from "zod";

/**
 * ======================================================
 * DASHBOARD
 * ======================================================
 *
 * Le dashboard est déterminé à partir de l'utilisateur
 * authentifié.
 *
 * Le rôle et l'identifiant utilisateur ne sont PAS reçus
 * depuis le client : ils proviennent du JWT.
 */

/**
 * ======================================================
 * QUERY
 * ======================================================
 */

export const dashboardQuerySchema = z.object({});

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;
