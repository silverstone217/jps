import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";
import {
  removeProductImage,
  updateProductImage,
} from "@/lib/modules/product/product.service";

// ======================================================
// CONFIGURATION
// ======================================================

const ALLOWED_ROLES: Role[] = ["MANAGER"];

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// ======================================================
// POST /api/v1/products/[id]/image
// ======================================================

export async function POST(
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

    if (!id?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "L'identifiant du produit est requis",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // FORM DATA
    // --------------------------------------------------

    const formData = await request.formData();

    const image = formData.get("image");

    // --------------------------------------------------
    // VALIDATION FICHIER
    // --------------------------------------------------

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "Veuillez sélectionner une image",
        },
        {
          status: 400,
        },
      );
    }

    if (image.size <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Le fichier image est vide",
        },
        {
          status: 400,
        },
      );
    }

    if (image.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "L'image ne peut pas dépasser 2 Mo",
        },
        {
          status: 400,
        },
      );
    }

    if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Format d'image non supporté. Utilisez JPG, PNG ou WEBP",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // CONVERSION EN BUFFER
    // --------------------------------------------------

    const arrayBuffer = await image.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    // --------------------------------------------------
    // UPLOAD / REMPLACEMENT
    // --------------------------------------------------

    const product = await updateProductImage(id.trim(), buffer);

    return NextResponse.json(
      {
        success: true,
        message: "Image du produit mise à jour avec succès",
        data: {
          product,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("POST /api/v1/products/[id]/image error:", error);

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
    // CLOUDINARY
    // --------------------------------------------------

    if (
      error instanceof Error &&
      error.message === "CLOUDINARY_UPLOAD_FAILED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Impossible d'envoyer l'image",
        },
        {
          status: 500,
        },
      );
    }

    // --------------------------------------------------
    // ERREUR GÉNÉRIQUE
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: false,
        message: "Impossible de mettre à jour l'image du produit",
      },
      {
        status: 500,
      },
    );
  }
}

// ======================================================
// DELETE /api/v1/products/[id]/image
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

    if (!id?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "L'identifiant du produit est requis",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // SUPPRESSION
    // --------------------------------------------------

    const product = await removeProductImage(id.trim());

    return NextResponse.json(
      {
        success: true,
        message: "Image du produit supprimée avec succès",
        data: {
          product,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("DELETE /api/v1/products/[id]/image error:", error);

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
    // ERREUR GÉNÉRIQUE
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: false,
        message: "Impossible de supprimer l'image du produit",
      },
      {
        status: 500,
      },
    );
  }
}
