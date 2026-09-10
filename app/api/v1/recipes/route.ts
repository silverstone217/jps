import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";
import { createRecipe, getRecipes } from "@/lib/modules/recipe/recipe.service";
import { createRecipeSchema } from "@/lib/modules/recipe/recipe.schema";

// ======================================================
// CONFIGURATION
// ======================================================

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ======================================================
// GET /api/v1/recipes
// ======================================================

export async function GET(request: Request) {
  try {
    // --------------------------------------------------
    // AUTORISATION
    // --------------------------------------------------

    await authorize(request, ALLOWED_ROLES);

    // --------------------------------------------------
    // RÉCUPÉRATION
    // --------------------------------------------------

    const recipes = await getRecipes();

    return NextResponse.json(
      {
        success: true,
        message: "Recettes récupérées avec succès",
        data: {
          recipes,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("GET /api/v1/recipes error:", error);

    // --------------------------------------------------
    // ERREURS D'AUTORISATION
    // --------------------------------------------------

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "Non autorisé",
        },
        {
          status: 401,
        },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          message: "Accès interdit",
        },
        {
          status: 403,
        },
      );
    }

    // --------------------------------------------------
    // BOUTIQUE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "SHOP_NOT_FOUND") {
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

    // --------------------------------------------------
    // ERREUR GÉNÉRIQUE
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: false,
        message: "Impossible de récupérer les recettes",
      },
      {
        status: 500,
      },
    );
  }
}

// ======================================================
// POST /api/v1/recipes
// ======================================================

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // AUTORISATION
    // --------------------------------------------------

    await authorize(request, ALLOWED_ROLES);

    // --------------------------------------------------
    // BODY
    // --------------------------------------------------

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Le corps de la requête est invalide",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    const result = createRecipeSchema.safeParse(body);

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

    // --------------------------------------------------
    // CRÉATION
    // --------------------------------------------------

    const recipe = await createRecipe(result.data);

    return NextResponse.json(
      {
        success: true,
        message: "Recette créée avec succès",
        data: {
          recipe,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("POST /api/v1/recipes error:", error);

    // --------------------------------------------------
    // ERREURS D'AUTORISATION
    // --------------------------------------------------

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "Non autorisé",
        },
        {
          status: 401,
        },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          message: "Accès interdit",
        },
        {
          status: 403,
        },
      );
    }

    // --------------------------------------------------
    // BOUTIQUE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "SHOP_NOT_FOUND") {
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

    // --------------------------------------------------
    // RECETTE
    // --------------------------------------------------

    if (
      error instanceof Error &&
      error.message === "RECIPE_NAME_ALREADY_EXISTS"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Une recette porte déjà ce nom",
        },
        {
          status: 409,
        },
      );
    }

    // --------------------------------------------------
    // ITEMS
    // --------------------------------------------------

    if (error instanceof Error && error.message === "TOO_MANY_RECIPE_ITEMS") {
      return NextResponse.json(
        {
          success: false,
          message: "Une recette ne peut pas contenir plus de 50 ingrédients",
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message === "DUPLICATE_RECIPE_INGREDIENT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Un même ingrédient ne peut pas apparaître plusieurs fois dans une recette",
        },
        {
          status: 409,
        },
      );
    }

    if (error instanceof Error && error.message === "INGREDIENT_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Une des matières premières sélectionnées est introuvable",
        },
        {
          status: 404,
        },
      );
    }

    if (error instanceof Error && error.message === "INGREDIENT_INACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Une des matières premières sélectionnées est inactive",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // ERREUR GÉNÉRIQUE
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: false,
        message: "Impossible de créer la recette",
      },
      {
        status: 500,
      },
    );
  }
}
