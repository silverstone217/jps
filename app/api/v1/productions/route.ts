import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import {
  createProduction,
  getProductions,
  ProductionServiceError,
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
      const issues = result.error.issues;

      console.error("GET /api/v1/productions VALIDATION ERROR:", issues);

      const message = issues
        .map((issue) => {
          const path = issue.path.join(".");

          return path ? `${path}: ${issue.message}` : issue.message;
        })
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
    // ==================================================
    // LOG
    // ==================================================

    if (error instanceof Error) {
      console.error("GET /api/v1/productions ERROR:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error("GET /api/v1/productions UNKNOWN ERROR:", error);
    }

    // ==================================================
    // SERVICE ERRORS
    // ==================================================

    if (error instanceof ProductionServiceError) {
      switch (error.code) {
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

        // ==============================================
        // FALLBACK SERVICE ERROR
        // ==============================================

        default:
          return NextResponse.json(
            {
              success: false,
              message: error.message,
            },
            {
              status: 400,
            },
          );
      }
    }

    // ==================================================
    // UNEXPECTED ERROR
    // ==================================================

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

    let body: unknown;

    try {
      body = await request.json();
    } catch (error) {
      console.error("POST /api/v1/productions INVALID JSON:", error);

      return NextResponse.json(
        {
          success: false,
          message: "Le corps de la requête est invalide.",
        },
        {
          status: 400,
        },
      );
    }

    // ==================================================
    // VALIDATION ZOD
    // ==================================================

    const result = createProductionSchema.safeParse(body);

    if (!result.success) {
      console.error("POST /api/v1/productions VALIDATION ERROR:", {
        issues: result.error.issues,
        body,
      });

      const message = result.error.issues
        .map((issue) => {
          const path = issue.path.join(".");

          return path ? `${path}: ${issue.message}` : issue.message;
        })
        .join(", ");

      return NextResponse.json(
        {
          success: false,
          message,
          issues: result.error.issues,
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
    //
    // shopId est récupéré côté serveur.
    // producedAt est généré côté serveur.
    // expiresAt est calculé côté serveur.
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
    // ==================================================
    // LOG COMPLET
    // ==================================================

    if (error instanceof ProductionServiceError) {
      console.error("POST /api/v1/productions SERVICE ERROR:", {
        name: error.name,
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
    } else if (error instanceof Error) {
      console.error("POST /api/v1/productions ERROR:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error("POST /api/v1/productions UNKNOWN ERROR:", error);
    }

    // ==================================================
    // PRODUCTION SERVICE ERRORS
    // ==================================================

    if (error instanceof ProductionServiceError) {
      switch (error.code) {
        // ==============================================
        // AUTH
        // ==============================================

        case "UNAUTHORIZED":
          return NextResponse.json(
            {
              success: false,
              message: "Non autorisé",
              code: error.code,
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
              code: error.code,
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
              code: error.code,
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
              code: error.code,
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
              code: error.code,
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
              code: error.code,
            },
            {
              status: 404,
            },
          );

        // ==============================================
        // POINT DE VENTE
        // ==============================================
        //
        // Ces codes sont conservés pour compatibilité
        // avec d'anciennes versions du service.
        //
        // La production actuelle ne dépend plus
        // d'un point de vente.
        // ==============================================

        case "POINT_OF_SALE_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Point de vente introuvable",
              code: error.code,
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
              code: error.code,
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
              code: error.code,
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
              code: error.code,
            },
            {
              status: 400,
            },
          );

        case "INSUFFICIENT_INGREDIENT_STOCK":
          return NextResponse.json(
            {
              success: false,
              message: error.message,
              code: error.code,
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
              code: error.code,
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
              code: error.code,
            },
            {
              status: 400,
            },
          );

        case "INSUFFICIENT_PACKAGING_STOCK":
          return NextResponse.json(
            {
              success: false,
              message: error.message,
              code: error.code,
            },
            {
              status: 409,
            },
          );

        case "INSUFFICIENT_DECLARED_PACKAGING":
          return NextResponse.json(
            {
              success: false,
              message: error.message,
              code: error.code,
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
              code: error.code,
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
              code: error.code,
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
              code: error.code,
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
              code: error.code,
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
              code: error.code,
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
              code: error.code,
            },
            {
              status: 404,
            },
          );

        // ==============================================
        // ERREUR MÉTIER NON RÉPERTORIÉE
        // ==============================================

        default:
          return NextResponse.json(
            {
              success: false,
              message: error.message,
              code: error.code,
            },
            {
              status: 400,
            },
          );
      }
    }

    // ==================================================
    // ERREUR INATTENDUE
    // ==================================================

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
