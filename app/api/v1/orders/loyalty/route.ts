import { Role } from "@/app/generated/prisma/client";
import { authorize } from "@/lib/modules/auth/authorize";
import { getOrderLoyalty } from "@/lib/modules/orders/order.service";
import { getOrderLoyaltySchema } from "@/lib/modules/orders/order.schema";

export async function GET(request: Request) {
  try {
    const user = await authorize(request, [Role.MANAGER, Role.EMPLOYEE]);
    const { searchParams } = new URL(request.url);
    const itemsParam = searchParams.get("items");

    let items: unknown;

    try {
      items = itemsParam ? JSON.parse(itemsParam) : undefined;
    } catch {
      return Response.json(
        {
          message: "Les produits de la commande sont invalides.",
        },
        { status: 400 },
      );
    }

    const parsed = getOrderLoyaltySchema.safeParse({
      pointOfSaleId: searchParams.get("pointOfSaleId"),
      customerId: searchParams.get("customerId"),
      items,
    });

    if (!parsed.success) {
      return Response.json(
        {
          message: "Les informations de fidélité sont invalides.",
        },
        { status: 400 },
      );
    }

    const result = await getOrderLoyalty(
      {
        id: user.userId,
        role: user.role,
      },
      parsed.data,
    );

    return Response.json(result);
  } catch (error) {
    console.error("Erreur récupération fidélité commande :", error);

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        {
          message: "Non autorisé.",
        },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return Response.json(
        {
          message: "Accès interdit.",
        },
        { status: 403 },
      );
    }

    if (error instanceof Error && error.message === "SHOP_NOT_FOUND") {
      return Response.json(
        {
          message: "Aucune boutique associée à cet utilisateur.",
        },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === "POS_NOT_FOUND") {
      return Response.json(
        {
          message: "Le point de vente est introuvable ou inactif.",
        },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === "POS_NOT_ASSIGNED") {
      return Response.json(
        {
          message: "Vous n'êtes pas assigné à ce point de vente.",
        },
        { status: 403 },
      );
    }

    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
      return Response.json(
        {
          message: "Le client est introuvable.",
        },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return Response.json(
        {
          message: "Un ou plusieurs produits de la commande sont introuvables.",
        },
        { status: 404 },
      );
    }

    return Response.json(
      {
        message: "Impossible de récupérer les informations de fidélité.",
      },
      { status: 500 },
    );
  }
}
