import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";
import ShopService from "@/lib/modules/shop/shop.service";

const ALLOWED_ROLES: Role[] = ["MANAGER"];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ============================================================
// POST /api/v1/shop/image
// ============================================================

export async function POST(request: Request) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const formData = await request.formData();

    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "Aucune image fournie",
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
          message: "Format d'image non supporté",
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
          message: "L'image ne doit pas dépasser 5 Mo",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Upload de l'image vers le stockage.
     *
     * Ici on récupère l'URL publique de l'image.
     *
     * Exemple :
     *
     * const logoUrl = await uploadShopImage(
     *   image,
     *   payload.userId,
     * );
     */

    const logoUrl = "IMAGE_UPLOAD_URL";

    const shop = await ShopService.updateShopLogo(payload.userId, logoUrl);

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
    const payload = await authorize(request, ALLOWED_ROLES);

    const shop = await ShopService.removeShopLogo(payload.userId);

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
