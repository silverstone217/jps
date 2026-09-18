import { NextResponse } from "next/server";
import type { Role } from "@/app/generated/prisma/client";
import { authorize } from "@/lib/modules/auth/authorize";
import {
  createExpiredLosses,
  createLoss,
  getLosses,
  getPendingLosses,
} from "@/lib/modules/loss/loss.service";
import { createLossSchema } from "@/lib/modules/loss/loss.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ============================================================
// GET
// ============================================================

export async function GET(request: Request) {
  try {
    const user = await authorize(request, ALLOWED_ROLES);
    const searchParams = new URL(request.url).searchParams;
    const pending = searchParams.get("pending");

    // ========================================================
    // PRODUITS EXPIRÉS À TRAITER
    // ========================================================

    if (pending === "true") {
      const losses = await getPendingLosses(user.userId);

      return NextResponse.json(
        {
          success: true,
          data: losses,
        },
        {
          status: 200,
        },
      );
    }

    // ========================================================
    // HISTORIQUE DES PERTES
    // ========================================================

    const rawPage = searchParams.get("page");
    const rawLimit = searchParams.get("limit");
    const rawCategory = searchParams.get("category");
    const rawReason = searchParams.get("reason");
    const rawPointOfSaleId = searchParams.get("pointOfSaleId");
    const page = rawPage ? Number(rawPage) : 1;
    const limit = rawLimit ? Number(rawLimit) : 20;
    const category = rawCategory?.trim() ? rawCategory.trim() : undefined;
    const reason = rawReason?.trim() ? rawReason.trim() : undefined;
    const pointOfSaleId = rawPointOfSaleId?.trim()
      ? rawPointOfSaleId.trim()
      : undefined;

    const result = await getLosses(user.userId, {
      page,
      limit,
      category: category as
        | "RAW_INGREDIENT"
        | "PACKAGING"
        | "FINISHED_PRODUCT"
        | undefined,
      reason: reason as
        | "EXPIRED"
        | "DAMAGED"
        | "STOLEN"
        | "QUAL_REJECT"
        | "OTHER"
        | undefined,
      pointOfSaleId,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("GET /api/v1/losses error:", error);

    if (error instanceof Error) {
      switch (error.message) {
        case "UNAUTHORIZED":
          return NextResponse.json(
            {
              success: false,
              message: "Non autorisé.",
            },
            {
              status: 401,
            },
          );

        case "FORBIDDEN":
          return NextResponse.json(
            {
              success: false,
              message: "Accès interdit.",
            },
            {
              status: 403,
            },
          );
      }
    }

    const code =
      "code" in (error as object)
        ? (error as { code?: string }).code
        : undefined;

    switch (code) {
      case "USER_NOT_FOUND":
        return NextResponse.json(
          {
            success: false,
            message: "Utilisateur introuvable.",
            code,
          },
          {
            status: 404,
          },
        );

      case "USER_INACTIVE":
        return NextResponse.json(
          {
            success: false,
            message: "Ce compte utilisateur est inactif.",
            code,
          },
          {
            status: 403,
          },
        );

      case "USER_BANNED":
        return NextResponse.json(
          {
            success: false,
            message: "Ce compte utilisateur est temporairement bloqué.",
            code,
          },
          {
            status: 403,
          },
        );

      case "SHOP_NOT_FOUND":
        return NextResponse.json(
          {
            success: false,
            message: "Boutique introuvable.",
            code,
          },
          {
            status: 404,
          },
        );

      case "POINT_OF_SALE_NOT_FOUND":
        return NextResponse.json(
          {
            success: false,
            message: "Point de vente introuvable.",
            code,
          },
          {
            status: 404,
          },
        );

      case "POINT_OF_SALE_INACTIVE":
        return NextResponse.json(
          {
            success: false,
            message: "Ce point de vente est inactif.",
            code,
          },
          {
            status: 400,
          },
        );

      default:
        return NextResponse.json(
          {
            success: false,
            message: "Impossible de récupérer les pertes.",
            code,
          },
          {
            status: 500,
          },
        );
    }
  }
}

// ============================================================
// POST
// ============================================================

export async function POST(request: Request) {
  try {
    const user = await authorize(request, ALLOWED_ROLES);

    const body = await request.json();

    // ========================================================
    // TRAITER LES LOTS EXPIRÉS
    // ========================================================

    if (body?.action === "EXPIRED") {
      const result = await createExpiredLosses(user.userId);

      return NextResponse.json(
        {
          success: true,
          data: result,
        },
        {
          status: 201,
        },
      );
    }

    // ========================================================
    // PERTE MANUELLE
    // ========================================================

    const parsed = createLossSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Données de perte invalides.",
          errors: parsed.error.flatten(),
        },
        {
          status: 400,
        },
      );
    }

    const loss = await createLoss(user.userId, parsed.data);

    return NextResponse.json(
      {
        success: true,
        data: {
          loss,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("POST /api/v1/losses error:", error);

    // ========================================================
    // AUTHORIZATION
    // ========================================================

    if (error instanceof Error) {
      switch (error.message) {
        case "UNAUTHORIZED":
          return NextResponse.json(
            {
              success: false,
              message: "Non autorisé.",
            },
            {
              status: 401,
            },
          );

        case "FORBIDDEN":
          return NextResponse.json(
            {
              success: false,
              message: "Accès interdit.",
            },
            {
              status: 403,
            },
          );
      }
    }

    // ========================================================
    // ERROR CODE
    // ========================================================

    const code =
      "code" in (error as object)
        ? (error as { code?: string }).code
        : undefined;

    // ========================================================
    // ERRORS MÉTIER
    // ========================================================

    switch (code) {
      case "USER_NOT_FOUND":
        return NextResponse.json(
          {
            success: false,
            message: "Utilisateur introuvable.",
            code,
          },
          {
            status: 404,
          },
        );

      case "USER_INACTIVE":
        return NextResponse.json(
          {
            success: false,
            message: "Ce compte utilisateur est inactif.",
            code,
          },
          {
            status: 403,
          },
        );

      case "USER_BANNED":
        return NextResponse.json(
          {
            success: false,
            message: "Ce compte utilisateur est temporairement bloqué.",
            code,
          },
          {
            status: 403,
          },
        );

      case "SHOP_NOT_FOUND":
        return NextResponse.json(
          {
            success: false,
            message: "Boutique introuvable.",
            code,
          },
          {
            status: 404,
          },
        );

      case "INGREDIENT_NOT_FOUND":
        return NextResponse.json(
          {
            success: false,
            message: "Matière première introuvable.",
            code,
          },
          {
            status: 404,
          },
        );

      case "PACKAGING_NOT_FOUND":
        return NextResponse.json(
          {
            success: false,
            message: "Packaging introuvable.",
            code,
          },
          {
            status: 404,
          },
        );

      case "FINISHED_STOCK_LOT_NOT_FOUND":
        return NextResponse.json(
          {
            success: false,
            message: "Le lot de produits finis est introuvable.",
            code,
          },
          {
            status: 404,
          },
        );

      // ======================================================
      // STOCK INSUFFISANT — MATIÈRE PREMIÈRE
      // ======================================================

      case "INSUFFICIENT_INGREDIENT_STOCK":
        return NextResponse.json(
          {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "Stock de matière première insuffisant.",
            code,
          },
          {
            status: 400,
          },
        );

      // ======================================================
      // STOCK INSUFFISANT — PACKAGING
      // ======================================================

      case "INSUFFICIENT_PACKAGING_STOCK":
        return NextResponse.json(
          {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "Stock de packaging insuffisant.",
            code,
          },
          {
            status: 400,
          },
        );

      // ======================================================
      // STOCK INSUFFISANT — PRODUIT FINI
      // ======================================================

      case "INSUFFICIENT_FINISHED_STOCK_LOT":
        return NextResponse.json(
          {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "La quantité demandée dépasse la quantité disponible dans ce lot.",
            code,
          },
          {
            status: 400,
          },
        );

      // ======================================================
      // QUANTITÉS INVALIDES
      // ======================================================

      case "INVALID_PACKAGING_QUANTITY":

      case "INVALID_FINISHED_PRODUCT_QUANTITY":
        return NextResponse.json(
          {
            success: false,
            message: "La quantité doit être un nombre entier.",
            code,
          },
          {
            status: 400,
          },
        );

      // ======================================================
      // INCOHÉRENCE STOCK PRODUIT FINI
      // ======================================================

      case "INCONSISTENT_FINISHED_STOCK":
        return NextResponse.json(
          {
            success: false,
            message:
              "Une incohérence a été détectée dans le stock de produits finis.",
            code,
          },
          {
            status: 409,
          },
        );

      // ======================================================
      // DEFAULT
      // ======================================================

      default:
        return NextResponse.json(
          {
            success: false,
            message:
              error instanceof Error && error.message
                ? error.message
                : "Impossible d'enregistrer la perte.",
            code,
          },
          {
            status: 500,
          },
        );
    }
  }
}
