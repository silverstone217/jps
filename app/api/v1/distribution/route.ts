import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import { createDistribution } from "@/lib/modules/distribution/distribution.service";

import { createDistributionSchema } from "@/lib/modules/distribution/distribution.schema";

// ======================================================
// CONFIGURATION
// ======================================================

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ======================================================
// POST /api/v1/distribution
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

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Le corps de la requête est invalide",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    const result = createDistributionSchema.safeParse(body);

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

    // --------------------------------------------------
    // CRÉATION
    // --------------------------------------------------

    const distribution = await createDistribution(result.data, user.userId);

    return NextResponse.json(
      {
        success: true,
        message: "Distribution créée avec succès",
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
    // ERREURS D'AUTORISATION
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
    // POINTS DE VENTE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "POINT_OF_SALE_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Un des points de vente sélectionnés est introuvable ou inactif",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------------------------
    // PRODUIT
    // --------------------------------------------------

    if (
      error instanceof Error &&
      error.message === "PRODUCT_VARIANT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Un des produits sélectionnés est introuvable ou inactif",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------------------------
    // STOCK SOURCE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "SOURCE_STOCK_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Le produit ne possède pas de stock dans le point de départ",
        },
        {
          status: 404,
        },
      );
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        {
          success: false,
          message: "La quantité demandée dépasse le stock disponible",
        },
        {
          status: 409,
        },
      );
    }

    // --------------------------------------------------
    // LOTS
    // --------------------------------------------------

    if (
      error instanceof Error &&
      error.message === "INSUFFICIENT_AVAILABLE_LOTS"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La quantité demandée dépasse le stock disponible dans les lots non expirés",
        },
        {
          status: 409,
        },
      );
    }

    if (error instanceof Error && error.message === "LOT_TRANSFER_FAILED") {
      return NextResponse.json(
        {
          success: false,
          message: "Impossible de transférer complètement les lots du produit",
        },
        {
          status: 409,
        },
      );
    }

    // --------------------------------------------------
    // ERREUR GÉNÉRIQUE
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: false,
        message: "Impossible de créer la distribution",
      },
      {
        status: 500,
      },
    );
  }
}
