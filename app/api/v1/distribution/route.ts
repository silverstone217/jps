import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import {
  createDistribution,
  getDistributionProducts,
} from "@/lib/modules/distribution/distribution.service";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ======================================================
// GET /api/v1/distribution
// Récupérer les produits disponibles pour une distribution
// ======================================================

export async function GET(request: Request) {
  try {
    // --------------------------------------------------
    // AUTORISATION
    // --------------------------------------------------

    const user = await authorize(request, ALLOWED_ROLES);

    // --------------------------------------------------
    // PARAMÈTRE
    //
    // absent = boutique principale
    // id     = point de vente
    // --------------------------------------------------

    const searchParams = new URL(request.url).searchParams;

    const rawFromPosId = searchParams.get("fromPosId");

    const fromPosId = rawFromPosId?.trim() ? rawFromPosId.trim() : null;

    // --------------------------------------------------
    // PRODUITS
    // --------------------------------------------------

    const products = await getDistributionProducts(user.userId, fromPosId);

    return NextResponse.json(
      {
        success: true,
        data: products,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("GET /api/v1/distribution error:", error);

    // --------------------------------------------------
    // AUTORISATION
    // --------------------------------------------------

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "Non autorisé",
        },
        {
          status: 401,
        },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          message: "Accès interdit",
        },
        {
          status: 403,
        },
      );
    }

    // --------------------------------------------------
    // UTILISATEUR
    // --------------------------------------------------

    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Utilisateur introuvable",
        },
        {
          status: 404,
        },
      );
    }

    if (error instanceof Error && error.message === "USER_INACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Votre compte est inactif",
        },
        {
          status: 403,
        },
      );
    }

    if (error instanceof Error && error.message === "USER_BANNED") {
      return NextResponse.json(
        {
          success: false,
          message: "Votre compte est suspendu",
        },
        {
          status: 403,
        },
      );
    }

    // --------------------------------------------------
    // BOUTIQUE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "SHOP_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Boutique introuvable",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------------------------
    // POINT DE VENTE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "POINT_OF_SALE_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Le point de vente sélectionné est introuvable ou inactif",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------------------------
    // ERREUR GÉNÉRIQUE
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: false,
        message: "Impossible de récupérer les produits disponibles",
      },
      {
        status: 500,
      },
    );
  }
}

// ======================================================
// POST /api/v1/distribution
// Créer une distribution
// ======================================================

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // AUTORISATION
    // --------------------------------------------------

    const user = await authorize(request, ALLOWED_ROLES);

    // --------------------------------------------------
    // BODY
    // --------------------------------------------------

    const body = await request.json();

    console.log("=== DISTRIBUTION CREATE SERVER REQUEST ===");

    console.log({
      userId: user.userId,
      body,
    });

    // --------------------------------------------------
    // CRÉER LA DISTRIBUTION
    // --------------------------------------------------

    const distribution = await createDistribution(body, user.userId);

    console.log("=== DISTRIBUTION CREATE SERVER SUCCESS ===");

    console.log({
      distributionId: distribution?.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          distribution,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("POST /api/v1/distribution error:", error);

    // --------------------------------------------------
    // AUTORISATION
    // --------------------------------------------------

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "Non autorisé",
        },
        {
          status: 401,
        },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          message: "Accès interdit",
        },
        {
          status: 403,
        },
      );
    }

    // --------------------------------------------------
    // UTILISATEUR
    // --------------------------------------------------

    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Utilisateur introuvable",
        },
        {
          status: 404,
        },
      );
    }

    if (error instanceof Error && error.message === "USER_INACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Votre compte est inactif",
        },
        {
          status: 403,
        },
      );
    }

    if (error instanceof Error && error.message === "USER_BANNED") {
      return NextResponse.json(
        {
          success: false,
          message: "Votre compte est suspendu",
        },
        {
          status: 403,
        },
      );
    }

    // --------------------------------------------------
    // BOUTIQUE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "SHOP_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Boutique introuvable",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------------------------
    // POINT DE VENTE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "POINT_OF_SALE_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Le point de vente sélectionné est introuvable ou inactif",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------------------------
    // STOCK
    // --------------------------------------------------

    if (error instanceof Error && error.message === "SOURCE_STOCK_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Le produit n'est plus disponible dans le stock source.",
        },
        {
          status: 400,
        },
      );
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        {
          success: false,
          message: "La quantité demandée dépasse le stock disponible.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message === "INSUFFICIENT_AVAILABLE_LOTS"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La quantité demandée dépasse le stock disponible dans les lots non expirés.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message === "PRODUCT_VARIANT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Un des produits sélectionnés n'existe plus ou est inactif.",
        },
        {
          status: 404,
        },
      );
    }

    if (error instanceof Error && error.message === "LOT_TRANSFER_FAILED") {
      return NextResponse.json(
        {
          success: false,
          message: "Impossible de transférer les lots du produit.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // ERREURS GÉNÉRALES DE DISTRIBUTION
    // --------------------------------------------------

    if (error instanceof Error && error.message === "SAME_POINT_OF_SALE") {
      return NextResponse.json(
        {
          success: false,
          message: "La source et la destination doivent être différentes.",
        },
        {
          status: 400,
        },
      );
    }

    if (error instanceof Error && error.message === "INVALID_TRANSFER") {
      return NextResponse.json(
        {
          success: false,
          message: "Le transfert demandé est invalide.",
        },
        {
          status: 400,
        },
      );
    }

    if (error instanceof Error && error.message === "NO_ITEMS") {
      return NextResponse.json(
        {
          success: false,
          message: "Aucun produit n'a été sélectionné.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // ERREUR GÉNÉRIQUE
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: false,
        message: "Impossible de créer la distribution.",
      },
      {
        status: 500,
      },
    );
  }
}
