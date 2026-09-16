import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import { getStock, StockServiceError } from "@/lib/modules/stock/stock.service";

import { stockQuerySchema } from "@/lib/modules/stock/stock.schema";

// ======================================================
// RÔLES AUTORISÉS
// ======================================================
//
// MANAGER
// → stock central
// → stock de tous les PDV
// → matières premières
// → packaging
//
// EMPLOYEE
// → uniquement les jus finis de son PDV assigné
//
// ======================================================

const ALLOWED_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];

// ======================================================
// GET /api/v1/stock
// ======================================================

export async function GET(request: Request) {
  try {
    // ====================================================
    // AUTHENTIFICATION
    // ====================================================

    const payload = await authorize(request, ALLOWED_ROLES);

    // ====================================================
    // QUERY PARAMS
    // ====================================================

    const { searchParams } = new URL(request.url);

    const queryParams = {
      pointOfSaleId: searchParams.get("pointOfSaleId") || undefined,

      limit: searchParams.get("limit") || undefined,

      page: searchParams.get("page") || undefined,
    };

    // ====================================================
    // VALIDATION
    // ====================================================

    const result = stockQuerySchema.safeParse(queryParams);

    if (!result.success) {
      console.error("GET /api/v1/stock VALIDATION ERROR:", result.error.issues);

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

    // ====================================================
    // SERVICE
    // ====================================================
    //
    // IMPORTANT :
    //
    // Pour un EMPLOYEE, le service ignore le
    // pointOfSaleId envoyé par le client et récupère
    // automatiquement le PDV depuis StaffAssignment.
    //
    // Pour un MANAGER, le pointOfSaleId permet de choisir
    // le stock central ou celui d'un PDV.
    //
    // ====================================================

    const stock = await getStock(payload.userId, result.data);

    // ====================================================
    // SUCCESS
    // ====================================================

    return NextResponse.json(
      {
        success: true,

        shop: stock.shop,

        location: stock.location,

        rawIngredients: stock.rawIngredients,

        packagings: stock.packagings,

        finishedStocks: stock.finishedStocks,

        pagination: stock.pagination,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    // ====================================================
    // LOGGING
    // ====================================================

    if (error instanceof StockServiceError) {
      console.error("GET /api/v1/stock SERVICE ERROR:", {
        name: error.name,
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
    } else if (error instanceof Error) {
      console.error("GET /api/v1/stock ERROR:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error("GET /api/v1/stock UNKNOWN ERROR:", error);
    }

    // ====================================================
    // AUTHENTIFICATION
    // ====================================================

    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
          {
            success: false,
            message: "Non autorisé",
            code: "UNAUTHORIZED",
          },
          {
            status: 401,
          },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            success: false,
            message: "Accès interdit",
            code: "FORBIDDEN",
          },
          {
            status: 403,
          },
        );
      }
    }

    // ====================================================
    // ERREURS MÉTIER
    // ====================================================

    if (error instanceof StockServiceError) {
      switch (error.code) {
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
        // AFFECTATION PDV
        // ==============================================

        case "POS_ASSIGNMENT_REQUIRED":
          return NextResponse.json(
            {
              success: false,

              message:
                "Vous n'êtes affecté à aucun point de vente. Veuillez demander à un manager de vous affecter à un point de vente avant de consulter le stock.",

              code: error.code,
            },
            {
              status: 403,
            },
          );

        // ==============================================
        // PDV
        // ==============================================

        case "POS_NOT_FOUND":
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

        case "POS_INACTIVE":
          return NextResponse.json(
            {
              success: false,
              message: "Le point de vente est actuellement désactivé",
              code: error.code,
            },
            {
              status: 403,
            },
          );

        // ==============================================
        // BOUTIQUE
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
        // VARIANTE
        // ==============================================

        case "VARIANT_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Variante de produit introuvable",
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
              message: "La variante de produit est désactivée",
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
              message: "Le produit est désactivé",
              code: error.code,
            },
            {
              status: 400,
            },
          );

        // ==============================================
        // STOCK
        // ==============================================

        case "STOCK_INCONSISTENCY":
          return NextResponse.json(
            {
              success: false,

              message:
                "Une incohérence a été détectée dans le stock. Veuillez contacter un manager.",

              code: error.code,
            },
            {
              status: 409,
            },
          );

        case "INVALID_STOCK_LOT":
          return NextResponse.json(
            {
              success: false,

              message: "Un lot de stock contient des données incohérentes.",

              code: error.code,
            },
            {
              status: 409,
            },
          );

        // ==============================================
        // AUTRES ERREURS MÉTIER
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

    // ====================================================
    // ERREUR INTERNE
    // ====================================================

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
