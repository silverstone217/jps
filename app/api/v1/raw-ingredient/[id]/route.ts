import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import {
  deleteRawIngredient,
  getRawIngredient,
  updateRawIngredient,
} from "@/lib/modules/raw-ingredient/raw-ingredient.service";

import { updateRawIngredientSchema } from "@/lib/modules/raw-ingredient/raw-ingredient.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// ============================================================
// GET /api/v1/raw-ingredient/:id
// ============================================================

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const { id } = await params;

    const rawIngredient = await getRawIngredient(payload.userId, id);

    return NextResponse.json(
      {
        success: true,
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
      }
    }

    console.error("GET /api/v1/raw-ingredient/[id]:", error);

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
// PATCH /api/v1/raw-ingredient/:id
// ============================================================

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const { id } = await params;

    const body = await request.json();

    const result = updateRawIngredientSchema.safeParse(body);

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
    // MODIFICATION
    // ----------------------------------------------------------

    const rawIngredient = await updateRawIngredient(
      payload.userId,
      id,
      result.data,
    );

    return NextResponse.json(
      {
        success: true,
        message: "Matière première mise à jour avec succès",
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
        // NOM DÉJÀ UTILISÉ
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

    console.error("PATCH /api/v1/raw-ingredient/[id]:", error);

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
// DELETE /api/v1/raw-ingredient/:id
// ============================================================

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const { id } = await params;

    await deleteRawIngredient(payload.userId, id);

    return NextResponse.json(
      {
        success: true,
        message: "Matière première supprimée avec succès",
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
        // HISTORIQUE EXISTANT
        // ------------------------------------------------------

        case "RAW_INGREDIENT_HAS_HISTORY":
          return NextResponse.json(
            {
              success: false,
              message:
                "Cette matière première possède déjà un historique. Désactivez-la plutôt que de la supprimer.",
            },
            {
              status: 409,
            },
          );

        // ------------------------------------------------------
        // STOCK EXISTANT
        // ------------------------------------------------------

        case "RAW_INGREDIENT_HAS_STOCK":
          return NextResponse.json(
            {
              success: false,
              message:
                "Impossible de supprimer une matière première qui possède encore du stock.",
            },
            {
              status: 409,
            },
          );
      }
    }

    console.error("DELETE /api/v1/raw-ingredient/[id]:", error);

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
