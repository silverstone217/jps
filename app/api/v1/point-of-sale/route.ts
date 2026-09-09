import { NextResponse } from "next/server";
import type { Role } from "@/app/generated/prisma/client";
import { authorize } from "@/lib/modules/auth/authorize";
import {
  createPointOfSale,
  getPointOfSales,
} from "@/lib/modules/point-of-sale/point-of-sale.service";

import { createPointOfSaleSchema } from "@/lib/modules/point-of-sale/point-of-sale.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ============================================================
// GET /api/v1/point-of-sale
// ============================================================

export async function GET(request: Request) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const pointOfSales = await getPointOfSales(payload.userId);

    return NextResponse.json(
      {
        success: true,
        pointOfSales,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        // ------------------------------------------------------
        // AUTHENTIFICATION
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // AUTORISATION
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // BOUTIQUE INTROUVABLE
        // ------------------------------------------------------

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
      }
    }

    console.error("GET /api/v1/point-of-sale:", error);

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

// ============================================================
// POST /api/v1/point-of-sale
// ============================================================

export async function POST(request: Request) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const body = await request.json();

    const result = createPointOfSaleSchema.safeParse(body);

    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // CRÉATION
    // ----------------------------------------------------------

    const pointOfSale = await createPointOfSale(payload.userId, result.data);

    return NextResponse.json(
      {
        success: true,
        message: "Point de vente créé avec succès",
        pointOfSale,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        // ------------------------------------------------------
        // AUTHENTIFICATION
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // AUTORISATION
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // BOUTIQUE INTROUVABLE
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // CODE DÉJÀ UTILISÉ
        // ------------------------------------------------------

        case "POINT_OF_SALE_CODE_ALREADY_EXISTS":
          return NextResponse.json(
            {
              success: false,
              message: "Ce code de point de vente est déjà utilisé",
            },
            {
              status: 409,
            },
          );
      }
    }

    console.error("POST /api/v1/point-of-sale:", error);

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
