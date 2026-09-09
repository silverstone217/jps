import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import { adjustRawIngredientStock } from "@/lib/modules/raw-ingredient/raw-ingredient.service";

import { adjustRawIngredientStockSchema } from "@/lib/modules/raw-ingredient/raw-ingredient.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// ============================================================
// PATCH /api/v1/raw-ingredient/:id/stock
// ============================================================

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const { id } = await params;

    const body = await request.json();

    const result = adjustRawIngredientStockSchema.safeParse(body);

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
    // AJUSTEMENT
    // ----------------------------------------------------------

    const rawIngredient = await adjustRawIngredientStock(
      payload.userId,
      id,
      result.data,
    );

    return NextResponse.json(
      {
        success: true,
        message: "Stock ajusté avec succès",
        rawIngredient,
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

        // ------------------------------------------------------
        // MATIÈRE PREMIÈRE INTROUVABLE
        // ------------------------------------------------------

        case "RAW_INGREDIENT_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Matière première introuvable",
            },
            {
              status: 404,
            },
          );

        // ------------------------------------------------------
        // STOCK INSUFFISANT
        // ------------------------------------------------------

        case "INSUFFICIENT_RAW_INGREDIENT_STOCK":
          return NextResponse.json(
            {
              success: false,
              message: "Le stock ne peut pas devenir négatif",
            },
            {
              status: 409,
            },
          );
      }
    }

    console.error("PATCH /api/v1/raw-ingredient/[id]/stock:", error);

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
