import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import {
  createRawIngredient,
  getRawIngredients,
} from "@/lib/modules/raw-ingredient/raw-ingredient.service";

import { createRawIngredientSchema } from "@/lib/modules/raw-ingredient/raw-ingredient.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ============================================================
// GET /api/v1/raw-ingredient
// ============================================================

export async function GET(request: Request) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const rawIngredients = await getRawIngredients(payload.userId);

    return NextResponse.json(
      {
        success: true,
        rawIngredients,
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

    console.error("GET /api/v1/raw-ingredient:", error);

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
// POST /api/v1/raw-ingredient
// ============================================================

export async function POST(request: Request) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const body = await request.json();

    const result = createRawIngredientSchema.safeParse(body);

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

    const rawIngredient = await createRawIngredient(
      payload.userId,
      result.data,
    );

    return NextResponse.json(
      {
        success: true,
        message: "Matière première créée avec succès",
        rawIngredient,
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
        // MATIÈRE PREMIÈRE DÉJÀ EXISTANTE
        // ------------------------------------------------------

        case "RAW_INGREDIENT_ALREADY_EXISTS":
          return NextResponse.json(
            {
              success: false,
              message: "Cette matière première existe déjà",
            },
            {
              status: 409,
            },
          );
      }
    }

    console.error("POST /api/v1/raw-ingredient:", error);

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
