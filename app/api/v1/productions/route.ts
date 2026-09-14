import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import {
  createProduction,
  getProductions,
} from "@/lib/modules/production/production.service";

import {
  createProductionSchema,
  productionQuerySchema,
} from "@/lib/modules/production/production.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ======================================================
// GET /api/v1/productions
// ======================================================

export async function GET(request: Request) {
  try {
    await authorize(request, ALLOWED_ROLES);

    // ==================================================
    // QUERY PARAMS
    // ==================================================

    const { searchParams } = new URL(request.url);

    const queryParams = {
      productId: searchParams.get("productId") || undefined,

      pointOfSaleId: searchParams.get("pointOfSaleId") || undefined,

      from: searchParams.get("from") || undefined,

      to: searchParams.get("to") || undefined,

      limit: searchParams.get("limit") || undefined,

      page: searchParams.get("page") || undefined,
    };

    // ==================================================
    // VALIDATION
    // ==================================================

    const result = productionQuerySchema.safeParse(queryParams);

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

    // ==================================================
    // SERVICE
    // ==================================================

    const resultData = await getProductions(result.data);

    return NextResponse.json(
      {
        success: true,
        productions: resultData.productions,
        pagination: resultData.pagination,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        // ==============================================
        // AUTH
        // ==============================================

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

        // ==============================================
        // SHOP
        // ==============================================

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

        // ==============================================
        // DATES
        // ==============================================

        case "INVALID_FROM_DATE":
          return NextResponse.json(
            {
              success: false,
              message: "La date de début est invalide",
            },
            {
              status: 400,
            },
          );

        case "INVALID_TO_DATE":
          return NextResponse.json(
            {
              success: false,
              message: "La date de fin est invalide",
            },
            {
              status: 400,
            },
          );
      }
    }

    console.error("GET /api/v1/productions:", error);

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

// ======================================================
// POST /api/v1/productions
// ======================================================

export async function POST(request: Request) {
  try {
    // ==================================================
    // AUTHENTIFICATION
    // ==================================================

    const payload = await authorize(request, ALLOWED_ROLES);

    // ==================================================
    // BODY
    // ==================================================

    const body = await request.json();

    // ==================================================
    // VALIDATION
    // ==================================================

    const result = createProductionSchema.safeParse(body);

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

    // ==================================================
    // CRÉATION
    // ==================================================
    //
    // managerId vient du token JWT.
    //
    // Le client ne peut donc pas choisir
    // quel manager a créé la production.
    // ==================================================

    const production = await createProduction(payload.userId, result.data);

    return NextResponse.json(
      {
        success: true,
        message: "Production enregistrée avec succès",
        production,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        // ==============================================
        // AUTH
        // ==============================================

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

        // ==============================================
        // UTILISATEUR
        // ==============================================

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

        case "USER_BANNED":
          return NextResponse.json(
            {
              success: false,
              message: "Votre compte est actuellement suspendu",
            },
            {
              status: 403,
            },
          );

        // ==============================================
        // SHOP
        // ==============================================

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

        // ==============================================
        // POINT DE VENTE
        // ==============================================

        case "POINT_OF_SALE_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Point de vente introuvable",
            },
            {
              status: 404,
            },
          );

        case "POINT_OF_SALE_INACTIVE":
          return NextResponse.json(
            {
              success: false,
              message: "Ce point de vente est désactivé",
            },
            {
              status: 400,
            },
          );

        // ==============================================
        // MATIÈRES PREMIÈRES
        // ==============================================

        case "INGREDIENT_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Une matière première sélectionnée est introuvable",
            },
            {
              status: 404,
            },
          );

        case "INGREDIENT_INACTIVE":
          return NextResponse.json(
            {
              success: false,
              message: "Une matière première sélectionnée est désactivée",
            },
            {
              status: 400,
            },
          );

        case "INSUFFICIENT_INGREDIENT_STOCK":
          return NextResponse.json(
            {
              success: false,
              message:
                "Stock insuffisant pour une ou plusieurs matières premières",
            },
            {
              status: 409,
            },
          );

        // ==============================================
        // EMBALLAGES
        // ==============================================

        case "PACKAGING_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Un emballage sélectionné est introuvable",
            },
            {
              status: 404,
            },
          );

        case "PACKAGING_INACTIVE":
          return NextResponse.json(
            {
              success: false,
              message: "Un emballage sélectionné est désactivé",
            },
            {
              status: 400,
            },
          );

        case "INSUFFICIENT_PACKAGING_STOCK":
          return NextResponse.json(
            {
              success: false,
              message: "Stock insuffisant pour un ou plusieurs emballages",
            },
            {
              status: 409,
            },
          );

        case "INSUFFICIENT_DECLARED_PACKAGING":
          return NextResponse.json(
            {
              success: false,
              message:
                "La quantité d'emballages déclarée ne couvre pas la production",
            },
            {
              status: 400,
            },
          );

        // ==============================================
        // PRODUITS / VARIANTES
        // ==============================================

        case "VARIANT_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Une variante de produit sélectionnée est introuvable",
            },
            {
              status: 404,
            },
          );

        case "VARIANT_INACTIVE":
          return NextResponse.json(
            {
              success: false,
              message: "Une variante de produit sélectionnée est désactivée",
            },
            {
              status: 400,
            },
          );

        case "PRODUCT_INACTIVE":
          return NextResponse.json(
            {
              success: false,
              message: "Le produit sélectionné est désactivé",
            },
            {
              status: 400,
            },
          );

        case "RECIPE_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Le produit sélectionné ne possède pas de recette",
            },
            {
              status: 400,
            },
          );

        case "MULTIPLE_PRODUCTS":
          return NextResponse.json(
            {
              success: false,
              message: "Une production ne peut concerner qu'un seul produit",
            },
            {
              status: 400,
            },
          );

        // ==============================================
        // PRODUCTION
        // ==============================================

        case "PRODUCTION_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "La production est introuvable",
            },
            {
              status: 404,
            },
          );
      }
    }

    console.error("POST /api/v1/productions:", error);

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
