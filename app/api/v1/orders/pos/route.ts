import { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";
import {
  assignOrderPos,
  getOrderPos,
} from "@/lib/modules/orders/order.service";
import { assignOrderPosSchema } from "@/lib/modules/orders/order.schema";

// ============================================================
// GET
// Récupérer les POS disponibles pour la commande
// ============================================================

export async function GET(request: Request) {
  try {
    const user = await authorize(request, [Role.MANAGER, Role.EMPLOYEE]);

    const pointOfSales = await getOrderPos({
      id: user.userId,
      role: user.role,
    });

    return Response.json({
      pointOfSales,
    });
  } catch (error) {
    console.error("Erreur récupération POS commande :", error);

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

    return Response.json(
      {
        message: "Impossible de récupérer les points de vente.",
      },
      {
        status: 500,
      },
    );
  }
}

// ============================================================
// POST
// Auto-assigner l'utilisateur à un POS
// ============================================================

export async function POST(request: Request) {
  try {
    const user = await authorize(request, [Role.MANAGER, Role.EMPLOYEE]);

    const body = await request.json();

    const parsed = assignOrderPosSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          message: "Données invalides.",
          errors: parsed.error.flatten().fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    const result = await assignOrderPos(
      {
        id: user.userId,
        role: user.role,
      },
      parsed.data,
    );

    return Response.json({
      message: "Point de vente sélectionné avec succès.",
      ...result,
    });
  } catch (error) {
    console.error("Erreur auto-assignation POS commande :", error);

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
          message: "Le point de vente demandé est introuvable ou inactif.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message === "EMPLOYEE_CANNOT_ASSIGN_MAIN_STORE"
    ) {
      return Response.json(
        {
          message:
            "Un employé ne peut pas s'assigner à la boutique principale.",
        },
        {
          status: 403,
        },
      );
    }

    return Response.json(
      {
        message: "Impossible de sélectionner le point de vente.",
      },
      {
        status: 500,
      },
    );
  }
}
