import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import {
  adjustStock,
  StockServiceError,
} from "@/lib/modules/stock/stock.service";

import { stockAdjustmentSchema } from "@/lib/modules/stock/stock.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

export async function POST(request: Request) {
  try {
    // ============================================================
    // AUTHENTIFICATION / AUTORISATION
    // ============================================================

    const payload = await authorize(request, ALLOWED_ROLES);

    // ============================================================
    // BODY
    // ============================================================

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Le corps de la requête est invalide.",
          code: "INVALID_JSON",
        },
        {
          status: 400,
        },
      );
    }

    // ============================================================
    // VALIDATION
    // ============================================================

    const result = stockAdjustmentSchema.safeParse(body);

    if (!result.success) {
      console.error(
        "POST /api/v1/stock/adjustments VALIDATION ERROR:",
        result.error.issues,
      );

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

    // ============================================================
    // AJUSTEMENT
    // ============================================================

    const stock = await adjustStock(payload.userId, result.data);

    // ============================================================
    // RESPONSE
    // ============================================================

    return NextResponse.json(
      {
        success: true,
        message: "Le stock a été ajusté avec succès.",
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
      console.error("POST /api/v1/stock/adjustments SERVICE ERROR:", {
        name: error.name,
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
    } else if (error instanceof Error) {
      console.error("POST /api/v1/stock/adjustments ERROR:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error("POST /api/v1/stock/adjustments UNKNOWN ERROR:", error);
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

        case "FORBIDDEN":
          return NextResponse.json(
            {
              success: false,
              message: "Seul un manager peut effectuer un ajustement de stock.",
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
              message: "Le point de vente sélectionné est désactivé.",
              code: error.code,
            },
            {
              status: 403,
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
              message: "La variante de produit est désactivée.",
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
              message: "Le produit est désactivé.",
              code: error.code,
            },
            {
              status: 400,
            },
          );

        case "STOCK_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message:
                "Aucun stock existant n'a été trouvé pour cette variante à cet emplacement.",
              code: error.code,
            },
            {
              status: 404,
            },
          );

        case "NO_ADJUSTMENT_NEEDED":
          return NextResponse.json(
            {
              success: false,
              message:
                "La quantité réelle est identique à la quantité actuelle. Aucun ajustement n'est nécessaire.",
              code: error.code,
            },
            {
              status: 400,
            },
          );

        case "INSUFFICIENT_LOT_STOCK":
          return NextResponse.json(
            {
              success: false,
              message:
                "La quantité à retirer dépasse la quantité disponible dans les lots de stock.",
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

        case "STOCK_INCONSISTENCY":
          return NextResponse.json(
            {
              success: false,
              message:
                "Une incohérence a été détectée dans le stock. Veuillez vérifier les lots avant de continuer.",
              code: error.code,
            },
            {
              status: 409,
            },
          );

        case "STOCK_CONCURRENT_UPDATE":
          return NextResponse.json(
            {
              success: false,
              message:
                "Le stock a été modifié par une autre opération. Veuillez actualiser puis réessayer.",
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
