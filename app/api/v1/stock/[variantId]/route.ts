import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import {
  getStockProduct,
  StockServiceError,
} from "@/lib/modules/stock/stock.service";

const ALLOWED_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];

interface RouteContext {
  params: Promise<{
    variantId: string;
  }>;
}

// ============================================================
// GET /api/v1/stock/:variantId
// ============================================================

export async function GET(request: Request, context: RouteContext) {
  try {
    // ========================================================
    // AUTHENTIFICATION / RÔLE
    // ========================================================

    const payload = await authorize(request, ALLOWED_ROLES);

    // ========================================================
    // PARAMÈTRE ROUTE
    // ========================================================

    const { variantId } = await context.params;

    if (!variantId?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "L'identifiant du produit est requis",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // LOCALISATION DEMANDÉE
    // ========================================================

    const url = new URL(request.url);

    const pointOfSaleId = url.searchParams.get("pointOfSaleId") ?? undefined;

    const requestedLocation = pointOfSaleId
      ? {
          locationType: "POS" as const,
          pointOfSaleId,
        }
      : {
          locationType: "MAIN" as const,
        };

    // ========================================================
    // RÉCUPÉRATION DU PRODUIT
    // ========================================================

    const product = await getStockProduct(
      payload.userId,
      variantId.trim(),
      requestedLocation,
    );

    // ========================================================
    // SUCCÈS
    // ========================================================

    return NextResponse.json(
      {
        success: true,
        product,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    // ========================================================
    // ERREURS DU STOCK SERVICE
    // ========================================================

    if (error instanceof StockServiceError) {
      switch (error.code) {
        // ----------------------------------------------------
        // BOUTIQUE INTROUVABLE
        // ----------------------------------------------------

        case "SHOP_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Boutique introuvable",
            },
            { status: 404 },
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
            { status: 404 },
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
            { status: 403 },
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
            { status: 403 },
          );

        // ----------------------------------------------------
        // ACCÈS INTERDIT
        // ----------------------------------------------------

        case "FORBIDDEN":
          return NextResponse.json(
            {
              success: false,
              message: "Accès interdit",
            },
            { status: 403 },
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
            { status: 404 },
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
            { status: 400 },
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
            { status: 403 },
          );

        // ----------------------------------------------------
        // PDV REQUIS
        // ----------------------------------------------------

        case "POS_REQUIRED":
          return NextResponse.json(
            {
              success: false,
              message: "Le point de vente est requis pour cet emplacement",
            },
            { status: 400 },
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
            { status: 404 },
          );
      }
    }

    // ========================================================
    // ERREURS D'AUTHENTIFICATION
    // ========================================================

    if (error instanceof Error) {
      switch (error.message) {
        case "UNAUTHORIZED":
          return NextResponse.json(
            {
              success: false,
              message: "Non autorisé",
            },
            { status: 401 },
          );

        case "FORBIDDEN":
          return NextResponse.json(
            {
              success: false,
              message: "Accès interdit",
            },
            { status: 403 },
          );
      }
    }

    // ========================================================
    // ERREUR INATTENDUE
    // ========================================================

    console.error("GET /api/v1/stock/[variantId]:", error);

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
