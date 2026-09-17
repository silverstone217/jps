import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import { getDistributionProducts } from "@/lib/modules/distribution/distribution.service";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ======================================================
// GET /api/v1/distribution/products
// ======================================================

export async function GET(request: Request) {
  try {
    // --------------------------------------------------
    // AUTORISATION
    // --------------------------------------------------

    const user = await authorize(request, ALLOWED_ROLES);

    // --------------------------------------------------
    // POINT DE DÉPART
    //
    // absent = boutique principale
    // id     = point de vente
    // --------------------------------------------------

    const { searchParams } = new URL(request.url);

    const fromPosId = searchParams.get("fromPosId");

    const products = await getDistributionProducts(
      user.userId,
      fromPosId || null,
    );

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
    console.error("GET /api/v1/distribution/products error:", error);

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
