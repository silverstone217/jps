import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import {
  getStockByVariant,
  StockServiceError,
} from "@/lib/modules/stock/stock.service";

import {
  stockVariantIdSchema,
  stockVariantQuerySchema,
} from "@/lib/modules/stock/stock.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];

interface RouteContext {
  params: Promise<{
    variantId: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    // ============================================================
    // AUTHENTIFICATION / AUTORISATION
    // ============================================================

    const payload = await authorize(request, ALLOWED_ROLES);

    // ============================================================
    // PARAMÈTRE [variantId]
    // ============================================================

    const params = await context.params;

    const variantResult = stockVariantIdSchema.safeParse(params);

    if (!variantResult.success) {
      console.error(
        "GET /api/v1/stock/[variantId] PARAM VALIDATION ERROR:",
        variantResult.error.issues,
      );

      const message = variantResult.error.issues
        .map((issue) => {
          const path = issue.path.join(".");

          return path ? `${path}: ${issue.message}` : issue.message;
        })
        .join(", ");

      return NextResponse.json(
        {
          success: false,
          message,
          issues: variantResult.error.issues,
        },
        {
          status: 400,
        },
      );
    }

    // ============================================================
    // QUERY PARAMS
    // ============================================================

    const { searchParams } = new URL(request.url);

    const queryParams = {
      pointOfSaleId: searchParams.get("pointOfSaleId") || undefined,
    };

    const queryResult = stockVariantQuerySchema.safeParse(queryParams);

    if (!queryResult.success) {
      console.error(
        "GET /api/v1/stock/[variantId] QUERY VALIDATION ERROR:",
        queryResult.error.issues,
      );

      const message = queryResult.error.issues
        .map((issue) => {
          const path = issue.path.join(".");

          return path ? `${path}: ${issue.message}` : issue.message;
        })
        .join(", ");

      return NextResponse.json(
        {
          success: false,
          message,
          issues: queryResult.error.issues,
        },
        {
          status: 400,
        },
      );
    }

    // ============================================================
    // SERVICE
    // ============================================================

    const stock = await getStockByVariant(
      payload.userId,
      variantResult.data.variantId,
      queryResult.data,
    );

    // ============================================================
    // RESPONSE
    // ============================================================

    return NextResponse.json(
      {
        success: true,
        shop: stock.shop,
        location: stock.location,
        variant: stock.variant,
        stock: stock.stock,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    // ============================================================
    // LOG
    // ============================================================

    if (error instanceof StockServiceError) {
      console.error("GET /api/v1/stock/[variantId] SERVICE ERROR:", {
        name: error.name,
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
    } else if (error instanceof Error) {
      console.error("GET /api/v1/stock/[variantId] ERROR:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error("GET /api/v1/stock/[variantId] UNKNOWN ERROR:", error);
    }

    // ============================================================
    // AUTH ERRORS
    // ============================================================

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

    // ============================================================
    // SERVICE ERRORS
    // ============================================================

    if (error instanceof StockServiceError) {
      switch (error.code) {
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

    // ============================================================
    // ERREUR INTERNE
    // ============================================================

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
