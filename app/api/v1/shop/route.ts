import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import ShopService from "@/lib/modules/shop/shop.service";
import { updateShopSchema } from "@/lib/modules/shop/shop.schema";
import { authorize } from "@/lib/modules/auth/authorize";

const VIEW_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];
const EDIT_ROLES: Role[] = ["MANAGER"];

// ============================================================
// GET /api/v1/shop
// ============================================================

export async function GET(request: Request) {
  try {
    const payload = await authorize(request, VIEW_ROLES);

    const shop = await ShopService.getShop(payload.userId);

    return NextResponse.json(
      {
        success: true,
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

    console.error("GET /api/v1/shop:", error);

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
// PATCH /api/v1/shop
// ============================================================

export async function PATCH(request: Request) {
  try {
    const payload = await authorize(request, EDIT_ROLES);

    const body = await request.json();

    const result = updateShopSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Données invalides",
          errors: result.error.issues,
        },
        {
          status: 400,
        },
      );
    }

    const shop = await ShopService.updateShop(payload.userId, result.data);

    return NextResponse.json(
      {
        success: true,
        message: "Boutique modifiée avec succès",
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

    console.error("PATCH /api/v1/shop:", error);

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
