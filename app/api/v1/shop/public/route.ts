import { NextResponse } from "next/server";
import ShopService from "@/lib/modules/shop/shop.service";
import { authorize } from "@/lib/modules/auth/authorize";

const VIEW_ROLES = ["MANAGER", "EMPLOYEE"] as const;

export async function GET(request: Request) {
  try {
    await authorize(request, [...VIEW_ROLES]);

    const shop = await ShopService.getPublicShop();

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

    console.error("GET /api/v1/shop/public:", error);

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
