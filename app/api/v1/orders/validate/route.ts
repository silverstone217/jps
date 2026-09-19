import { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";
import { validateOrder } from "@/lib/modules/orders/order.service";
import { validateOrderSchema } from "@/lib/modules/orders/order.schema";

export async function POST(request: Request) {
  try {
    // ==========================================================
    // AUTHENTIFICATION
    // ==========================================================

    const user = await authorize(request, [Role.MANAGER, Role.EMPLOYEE]);

    // ==========================================================
    // BODY
    // ==========================================================

    const body = await request.json();

    const parsed = validateOrderSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          message: "Les informations de la commande sont invalides.",
        },
        { status: 400 },
      );
    }

    // ==========================================================
    // VALIDATION DE LA COMMANDE
    // ==========================================================

    const result = await validateOrder(
      {
        id: user.userId,
        role: user.role,
      },
      parsed.data,
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("Erreur validation commande :", error);

    // ==========================================================
    // AUTHENTIFICATION
    // ==========================================================

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        {
          message: "Non autorisé.",
        },
        { status: 401 },
      );
    }

    // ==========================================================
    // AUTORISATION
    // ==========================================================

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return Response.json(
        {
          message: "Accès interdit.",
        },
        { status: 403 },
      );
    }

    // ==========================================================
    // BOUTIQUE
    // ==========================================================

    if (error instanceof Error && error.message === "SHOP_NOT_FOUND") {
      return Response.json(
        {
          message: "Aucune boutique associée à cet utilisateur.",
        },
        { status: 404 },
      );
    }

    // ==========================================================
    // POS
    // ==========================================================

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

    // ==========================================================
    // UTILISATEUR
    // ==========================================================

    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return Response.json(
        {
          message: "Le vendeur est introuvable.",
        },
        { status: 404 },
      );
    }

    // ==========================================================
    // PRODUITS
    // ==========================================================

    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return Response.json(
        {
          message:
            "Un ou plusieurs produits de la commande sont introuvables ou indisponibles.",
        },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === "DUPLICATE_PRODUCT") {
      return Response.json(
        {
          message:
            "Un même produit ne peut apparaître qu'une seule fois dans la commande.",
        },
        { status: 400 },
      );
    }

    // ==========================================================
    // STOCK
    // ==========================================================

    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return Response.json(
        {
          message: "La quantité demandée dépasse le stock disponible.",
        },
        { status: 409 },
      );
    }

    // ==========================================================
    // CLIENT
    // ==========================================================

    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
      return Response.json(
        {
          message: "Le client est introuvable.",
        },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "CUSTOMER_REQUIRED_FOR_LOYALTY"
    ) {
      return Response.json(
        {
          message:
            "Un client est nécessaire pour utiliser les points fidélité.",
        },
        { status: 400 },
      );
    }

    // ==========================================================
    // FIDÉLITÉ
    // ==========================================================

    if (
      error instanceof Error &&
      error.message === "LOYALTY_REDEMPTION_NOT_AVAILABLE"
    ) {
      return Response.json(
        {
          message:
            "La remise fidélité n'est pas disponible pour cette boutique.",
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "INVALID_LOYALTY_POINTS") {
      return Response.json(
        {
          message: "Le nombre de points utilisés n'est pas valide.",
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "INSUFFICIENT_LOYALTY_POINTS"
    ) {
      return Response.json(
        {
          message: "Le client ne possède pas suffisamment de points fidélité.",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "LOYALTY_DISCOUNT_TOO_HIGH"
    ) {
      return Response.json(
        {
          message:
            "Le nombre de points utilisés dépasse la remise maximale autorisée pour cette commande.",
        },
        { status: 400 },
      );
    }

    // ==========================================================
    // ERREUR GÉNÉRALE
    // ==========================================================

    return Response.json(
      {
        message: "Impossible d'enregistrer la commande.",
      },
      { status: 500 },
    );
  }
}
