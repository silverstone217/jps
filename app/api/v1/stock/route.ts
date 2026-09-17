import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import { getStock } from "@/lib/modules/stock/stock.service";

import { stockQuerySchema } from "@/lib/modules/stock/stock.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];

// ============================================================
// GET /api/v1/stock
// ============================================================

export async function GET(request: Request) {
  try {
    // ========================================================
    // AUTHENTIFICATION / RÔLE
    // ========================================================

    const payload = await authorize(request, ALLOWED_ROLES);

    // ========================================================
    // QUERY PARAMS
    // ========================================================

    const url = new URL(request.url);

    const rawQuery = {
      locationType: url.searchParams.get("locationType") ?? undefined,

      pointOfSaleId: url.searchParams.get("pointOfSaleId") ?? undefined,

      category: url.searchParams.get("category") ?? undefined,

      search: url.searchParams.get("search") ?? undefined,

      lowStock: url.searchParams.get("lowStock") ?? undefined,

      page: url.searchParams.get("page") ?? undefined,

      limit: url.searchParams.get("limit") ?? undefined,
    };

    // ========================================================
    // VALIDATION
    // ========================================================

    const result = stockQuerySchema.safeParse(rawQuery);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(", ");

      return NextResponse.json(
        {
          success: false,
          message,
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // RÉCUPÉRATION DU STOCK
    // ========================================================

    const stock = await getStock(payload.userId, result.data);

    // ========================================================
    // SUCCÈS
    // ========================================================

    return NextResponse.json(
      {
        success: true,
        stock,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        // ----------------------------------------------------
        // AUTHENTIFICATION
        // ----------------------------------------------------

        case "UNAUTHORIZED":
          return NextResponse.json(
            {
              success: false,
              message: "Non autorisé",
            },
            {
              status: 401,
            },
          );

        // ----------------------------------------------------
        // AUTORISATION
        // ----------------------------------------------------

        case "FORBIDDEN":
          return NextResponse.json(
            {
              success: false,
              message: "Accès interdit",
            },
            {
              status: 403,
            },
          );

        // ----------------------------------------------------
        // BOUTIQUE INTROUVABLE
        // ----------------------------------------------------

        case "SHOP_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Boutique introuvable",
            },
            {
              status: 404,
            },
          );

        // ----------------------------------------------------
        // UTILISATEUR INTROUVABLE
        // ----------------------------------------------------

        case "USER_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Utilisateur introuvable",
            },
            {
              status: 404,
            },
          );

        // ----------------------------------------------------
        // UTILISATEUR INACTIF
        // ----------------------------------------------------

        case "USER_INACTIVE":
          return NextResponse.json(
            {
              success: false,
              message: "Votre compte est désactivé",
            },
            {
              status: 403,
            },
          );

        // ----------------------------------------------------
        // UTILISATEUR BLOQUÉ
        // ----------------------------------------------------

        case "USER_BANNED":
          return NextResponse.json(
            {
              success: false,
              message: "Votre compte est actuellement bloqué",
            },
            {
              status: 403,
            },
          );

        // ----------------------------------------------------
        // PDV INTROUVABLE
        // ----------------------------------------------------

        case "POS_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Point de vente introuvable",
            },
            {
              status: 404,
            },
          );

        // ----------------------------------------------------
        // PDV INACTIF
        // ----------------------------------------------------

        case "POS_INACTIVE":
          return NextResponse.json(
            {
              success: false,
              message: "Ce point de vente est actuellement désactivé",
            },
            {
              status: 400,
            },
          );

        // ----------------------------------------------------
        // EMPLOYÉ NON AFFECTÉ
        // ----------------------------------------------------

        case "POS_NOT_ASSIGNED":
          return NextResponse.json(
            {
              success: false,
              message:
                "Vous n'êtes actuellement affecté à aucun point de vente",
            },
            {
              status: 403,
            },
          );

        // ----------------------------------------------------
        // CATÉGORIE INVALIDE POUR L'EMPLACEMENT
        // ----------------------------------------------------

        case "INVALID_CATEGORY":
          return NextResponse.json(
            {
              success: false,
              message:
                "Cette catégorie de stock n'est pas disponible dans cet emplacement",
            },
            {
              status: 400,
            },
          );

        // ----------------------------------------------------
        // PRODUIT INTROUVABLE
        // ----------------------------------------------------

        case "STOCK_PRODUCT_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Produit introuvable dans cet emplacement de stock",
            },
            {
              status: 404,
            },
          );
      }
    }

    // ========================================================
    // ERREUR INATTENDUE
    // ========================================================

    console.error("GET /api/v1/stock:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Une erreur interne est survenue",
      },
      {
        status: 500,
      },
    );
  }
}
