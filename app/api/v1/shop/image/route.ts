import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import ShopService from "@/lib/modules/shop/shop.service";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ============================================================
// POST /api/v1/shop/image
// ============================================================

export async function POST(request: Request) {
  try {
    // ==========================================================
    // AUTHENTIFICATION
    // ==========================================================

    const payload = await authorize(request, ALLOWED_ROLES);

    // ==========================================================
    // RÉCUPÉRER LE FORM DATA
    // ==========================================================

    const formData = await request.formData();

    const file = formData.get("image");

    // ==========================================================
    // VÉRIFIER LE FICHIER
    // ==========================================================

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "Aucune image n'a été fournie",
        },
        {
          status: 400,
        },
      );
    }

    // ==========================================================
    // VÉRIFIER LE TYPE
    // ==========================================================

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Format d'image non supporté. Utilisez JPG, PNG ou WEBP.",
        },
        {
          status: 400,
        },
      );
    }

    // ==========================================================
    // VÉRIFIER LA TAILLE
    // ==========================================================

    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "L'image ne doit pas dépasser 2 Mo.",
        },
        {
          status: 400,
        },
      );
    }

    // ==========================================================
    // CONVERTIR EN BUFFER
    // ==========================================================

    const arrayBuffer = await file.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    // ==========================================================
    // UPLOAD + MODIFICATION DE LA BOUTIQUE
    // ==========================================================

    const shop = await ShopService.updateShopLogo(payload.userId, buffer);

    // ==========================================================
    // RÉPONSE
    // ==========================================================

    return NextResponse.json(
      {
        success: true,
        message: "Logo de la boutique modifié avec succès",
        shop,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
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

        case "CLOUDINARY_UPLOAD_FAILED":
          return NextResponse.json(
            {
              success: false,
              message: "Impossible de télécharger l'image.",
            },
            {
              status: 500,
            },
          );
      }
    }

    console.error("POST /api/v1/shop/image:", error);

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
// DELETE /api/v1/shop/image
// ============================================================

export async function DELETE(request: Request) {
  try {
    // ==========================================================
    // AUTHENTIFICATION
    // ==========================================================

    const payload = await authorize(request, ALLOWED_ROLES);

    // ==========================================================
    // SUPPRIMER L'IMAGE
    // ==========================================================

    const shop = await ShopService.removeShopLogo(payload.userId);

    // ==========================================================
    // RÉPONSE
    // ==========================================================

    return NextResponse.json(
      {
        success: true,
        message: "Logo de la boutique supprimé avec succès",
        shop,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
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

    console.error("DELETE /api/v1/shop/image:", error);

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
