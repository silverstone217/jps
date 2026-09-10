import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";
import {
  deleteProduct,
  getProductById,
  updateProduct,
} from "@/lib/modules/product/product.service";
import {
  productIdSchema,
  updateProductSchema,
} from "@/lib/modules/product/product.schema";

// ======================================================
// CONFIGURATION
// ======================================================

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ======================================================
// GET /api/v1/products/[id]
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

    const idResult = productIdSchema.safeParse({
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

    const product = await getProductById(idResult.data.id);

    return NextResponse.json(
      {
        success: true,
        message: "Produit récupéré avec succès",
        data: {
          product,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("GET /api/v1/products/[id] error:", error);

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
    // ERREURS MÉTIER
    // --------------------------------------------------

    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Produit introuvable",
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
        message: "Impossible de récupérer le produit",
      },
      {
        status: 500,
      },
    );
  }
}

// ======================================================
// PATCH /api/v1/products/[id]
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

    const idResult = productIdSchema.safeParse({
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

    const result = updateProductSchema.safeParse(body);

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

    const product = await updateProduct(idResult.data.id, result.data);

    return NextResponse.json(
      {
        success: true,
        message: "Produit mis à jour avec succès",
        data: {
          product,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("PATCH /api/v1/products/[id] error:", error);

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
    // PRODUIT
    // --------------------------------------------------

    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Produit introuvable",
        },
        {
          status: 404,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message === "PRODUCT_NAME_ALREADY_EXISTS"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Un autre produit porte déjà ce nom",
        },
        {
          status: 409,
        },
      );
    }

    // --------------------------------------------------
    // VARIANTES
    // --------------------------------------------------

    if (
      error instanceof Error &&
      error.message === "PRODUCT_VARIANT_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Le produit doit avoir au moins une variante",
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message === "TOO_MANY_PRODUCT_VARIANTS"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Un produit ne peut avoir que deux variantes",
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message === "DUPLICATE_PRODUCT_PACKAGING"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Un même emballage ne peut pas être utilisé deux fois pour ce produit",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message === "DUPLICATE_PRODUCT_VARIANT_SIZE"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Un même format ne peut pas être utilisé deux fois pour ce produit",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message === "DUPLICATE_PRODUCT_VARIANT_SKU"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Les SKU des variantes doivent être différents",
        },
        {
          status: 409,
        },
      );
    }

    if (error instanceof Error && error.message === "SKU_ALREADY_EXISTS") {
      return NextResponse.json(
        {
          success: false,
          message: "Un des SKU est déjà utilisé par un autre produit",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message === "PRODUCT_VARIANT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Une des variantes indiquées est introuvable",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------------------------
    // EMBALLAGE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "PACKAGING_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Un des emballages indiqués est introuvable",
        },
        {
          status: 404,
        },
      );
    }

    if (error instanceof Error && error.message === "PACKAGING_INACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Un des emballages sélectionnés est inactif",
        },
        {
          status: 400,
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
          message: "La recette sélectionnée est introuvable",
        },
        {
          status: 404,
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
        message: "Impossible de mettre à jour le produit",
      },
      {
        status: 500,
      },
    );
  }
}

// ======================================================
// DELETE /api/v1/products/[id]
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

    const idResult = productIdSchema.safeParse({
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
    // SUPPRESSION / DÉSACTIVATION
    // --------------------------------------------------

    const result = await deleteProduct(idResult.data.id);

    return NextResponse.json(
      {
        success: true,
        message: result.deactivated
          ? "Produit désactivé car il possède un historique"
          : "Produit supprimé avec succès",
        data: {
          product: result.product,
          deactivated: result.deactivated,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("DELETE /api/v1/products/[id] error:", error);

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
    // PRODUIT
    // --------------------------------------------------

    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Produit introuvable",
        },
        {
          status: 404,
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
        message: "Impossible de supprimer le produit",
      },
      {
        status: 500,
      },
    );
  }
}
