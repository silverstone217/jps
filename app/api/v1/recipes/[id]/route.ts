import { NextResponse } from "next/server";
import type { Role } from "@/app/generated/prisma/client";
import { authorize } from "@/lib/modules/auth/authorize";
import {
  deleteRecipe,
  getRecipeById,
  updateRecipe,
} from "@/lib/modules/recipe/recipe.service";
import {
  recipeIdSchema,
  updateRecipeSchema,
} from "@/lib/modules/recipe/recipe.schema";

// ======================================================
// CONFIGURATION
// ======================================================

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ======================================================
// GET /api/v1/recipes/[id]
// ======================================================

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    // --------------------------------------------------
    // AUTORISATION
    // --------------------------------------------------

    await authorize(request, ALLOWED_ROLES);

    // --------------------------------------------------
    // PARAMÈTRE
    // --------------------------------------------------

    const { id } = await context.params;

    const idResult = recipeIdSchema.safeParse({
      id,
    });

    if (!idResult.success) {
      const message = idResult.error.issues
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
    // RÉCUPÉRATION
    // --------------------------------------------------

    const recipe = await getRecipeById(idResult.data.id);

    return NextResponse.json(
      {
        success: true,
        message: "Recette récupérée avec succès",
        data: {
          recipe,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("GET /api/v1/recipes/[id] error:", error);

    // --------------------------------------------------
    // AUTORISATION
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
    // RECETTE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "RECIPE_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Recette introuvable",
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
        message: "Impossible de récupérer la recette",
      },
      {
        status: 500,
      },
    );
  }
}

// ======================================================
// PATCH /api/v1/recipes/[id]
// ======================================================

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    // --------------------------------------------------
    // AUTORISATION
    // --------------------------------------------------

    await authorize(request, ALLOWED_ROLES);

    // --------------------------------------------------
    // PARAMÈTRE
    // --------------------------------------------------

    const { id } = await context.params;

    const idResult = recipeIdSchema.safeParse({
      id,
    });

    if (!idResult.success) {
      const message = idResult.error.issues
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

    const result = updateRecipeSchema.safeParse(body);

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
    // MODIFICATION
    // --------------------------------------------------

    const recipe = await updateRecipe(idResult.data.id, result.data);

    return NextResponse.json(
      {
        success: true,
        message: "Recette mise à jour avec succès",
        data: {
          recipe,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("PATCH /api/v1/recipes/[id] error:", error);

    // --------------------------------------------------
    // AUTORISATION
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
    // RECETTE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "RECIPE_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Recette introuvable",
        },
        {
          status: 404,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message === "RECIPE_NAME_ALREADY_EXISTS"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Une autre recette porte déjà ce nom",
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

    if (error instanceof Error && error.message === "RECIPE_ITEM_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Un des éléments de la recette est introuvable",
        },
        {
          status: 404,
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
        message: "Impossible de mettre à jour la recette",
      },
      {
        status: 500,
      },
    );
  }
}

// ======================================================
// DELETE /api/v1/recipes/[id]
// ======================================================

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    // --------------------------------------------------
    // AUTORISATION
    // --------------------------------------------------

    await authorize(request, ALLOWED_ROLES);

    // --------------------------------------------------
    // PARAMÈTRE
    // --------------------------------------------------

    const { id } = await context.params;

    const idResult = recipeIdSchema.safeParse({
      id,
    });

    if (!idResult.success) {
      const message = idResult.error.issues
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
    // SUPPRESSION
    // --------------------------------------------------

    const recipe = await deleteRecipe(idResult.data.id);

    return NextResponse.json(
      {
        success: true,
        message: "Recette supprimée avec succès",
        data: {
          recipe,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("DELETE /api/v1/recipes/[id] error:", error);

    // --------------------------------------------------
    // AUTORISATION
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
    // RECETTE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "RECIPE_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Recette introuvable",
        },
        {
          status: 404,
        },
      );
    }

    if (error instanceof Error && error.message === "RECIPE_IN_USE") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Cette recette est utilisée par un ou plusieurs produits et ne peut pas être supprimée",
        },
        {
          status: 409,
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
        message: "Impossible de supprimer la recette",
      },
      {
        status: 500,
      },
    );
  }
}
