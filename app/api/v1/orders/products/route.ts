import { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import { getOrderProducts } from "@/lib/modules/orders/order.service";

import { getOrderProductsSchema } from "@/lib/modules/orders/order.schema";

// ============================================================
// GET
// Récupérer les produits disponibles pour la commande
// ============================================================

export async function GET(request: Request) {
  try {
    const user = await authorize(request, [Role.MANAGER, Role.EMPLOYEE]);

    const { searchParams } = new URL(request.url);

    const parsed = getOrderProductsSchema.safeParse({
      pointOfSaleId: searchParams.get("pointOfSaleId"),
    });

    if (!parsed.success) {
      return Response.json(
        {
          message: "Le point de vente est requis.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await getOrderProducts(
      {
        id: user.userId,
        role: user.role,
      },
      parsed.data,
    );

    return Response.json(result);
  } catch (error) {
    console.error("Erreur récupération produits commande :", error);

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        {
          message: "Non autorisé.",
        },
        {
          status: 401,
        },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return Response.json(
        {
          message: "Accès interdit.",
        },
        {
          status: 403,
        },
      );
    }

    if (error instanceof Error && error.message === "SHOP_NOT_FOUND") {
      return Response.json(
        {
          message: "Aucune boutique associée à cet utilisateur.",
        },
        {
          status: 404,
        },
      );
    }

    if (error instanceof Error && error.message === "POS_NOT_FOUND") {
      return Response.json(
        {
          message: "Le point de vente est introuvable ou inactif.",
        },
        {
          status: 404,
        },
      );
    }

    if (error instanceof Error && error.message === "POS_NOT_ASSIGNED") {
      return Response.json(
        {
          message: "Vous n'êtes pas assigné à ce point de vente.",
        },
        {
          status: 403,
        },
      );
    }

    return Response.json(
      {
        message: "Impossible de récupérer les produits disponibles.",
      },
      {
        status: 500,
      },
    );
  }
}
