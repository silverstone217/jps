import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";
import { authorize } from "@/lib/modules/auth/authorize";

import {
  createProduct,
  getProducts,
} from "@/lib/modules/product/product.service";

import { createProductSchema } from "@/lib/modules/product/product.schema";

// ======================================================
// AUTORISATION
// ======================================================

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ======================================================
// GET /api/v1/products
// ======================================================

export async function GET(request: Request) {
  try {
    await authorize(request, ALLOWED_ROLES);

    const products = await getProducts();

    return NextResponse.json(
      {
        success: true,
        message: "Produits récupérés avec succès",
        data: {
          products,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("GET /api/v1/products error:", error);

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "Vous devez être authentifié pour accéder aux produits",
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
          message: "Vous n'avez pas l'autorisation d'accéder aux produits",
        },
        {
          status: 403,
        },
      );
    }

    if (error instanceof Error && error.message === "SHOP_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "La boutique principale est introuvable",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Impossible de récupérer les produits",
      },
      {
        status: 500,
      },
    );
  }
}

// ======================================================
// POST /api/v1/products
// ======================================================

export async function POST(request: Request) {
  try {
    await authorize(request, ALLOWED_ROLES);

    const body = await request.json();

    const result = createProductSchema.safeParse(body);

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

    const product = await createProduct(result.data);

    return NextResponse.json(
      {
        success: true,
        message: "Produit créé avec succès",
        data: {
          product,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("POST /api/v1/products error:", error);

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "Vous devez être authentifié pour créer un produit",
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
          message: "Vous n'avez pas l'autorisation de créer un produit",
        },
        {
          status: 403,
        },
      );
    }

    if (error instanceof Error && error.message === "SHOP_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "La boutique principale est introuvable",
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
          message: "Un produit portant ce nom existe déjà",
        },
        {
          status: 409,
        },
      );
    }

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
            "Un même emballage ne peut pas être utilisé deux fois pour le même produit",
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
          message: "Un produit ne peut avoir qu'une variante par format",
        },
        {
          status: 409,
        },
      );
    }

    if (error instanceof Error && error.message === "DUPLICATE_PRODUCT_SKU") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Les variantes d'un produit doivent avoir des SKU différents",
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
          message: "Ce SKU est déjà utilisé par un autre produit",
        },
        {
          status: 409,
        },
      );
    }

    if (error instanceof Error && error.message === "PACKAGING_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Un des emballages sélectionnés est introuvable",
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
          message: "Un des emballages sélectionnés est désactivé",
        },
        {
          status: 400,
        },
      );
    }

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

    return NextResponse.json(
      {
        success: false,
        message: "Impossible de créer le produit",
      },
      {
        status: 500,
      },
    );
  }
}
