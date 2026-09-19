import { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import {
  createOrderCustomer,
  getOrderCustomer,
} from "@/lib/modules/orders/order.service";

import {
  createOrderCustomerSchema,
  getOrderCustomerSchema,
} from "@/lib/modules/orders/order.schema";

// ============================================================
// GET
// Rechercher un client par numéro de téléphone
// ============================================================

export async function GET(request: Request) {
  try {
    const user = await authorize(request, [Role.MANAGER, Role.EMPLOYEE]);

    const { searchParams } = new URL(request.url);

    const parsed = getOrderCustomerSchema.safeParse({
      phone: searchParams.get("phone"),
    });

    if (!parsed.success) {
      return Response.json(
        {
          message: "Le numéro de téléphone est requis et doit être valide.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await getOrderCustomer(
      {
        id: user.userId,
        role: user.role,
      },
      parsed.data,
    );

    return Response.json(result);
  } catch (error) {
    console.error("Erreur recherche client commande :", error);

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

    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
      return Response.json(
        {
          message: "Aucun client ne correspond à ce numéro.",
        },
        {
          status: 404,
        },
      );
    }

    return Response.json(
      {
        message: "Impossible de rechercher le client.",
      },
      {
        status: 500,
      },
    );
  }
}

// ============================================================
// POST
// Créer un nouveau client
// ============================================================

export async function POST(request: Request) {
  try {
    const user = await authorize(request, [Role.MANAGER, Role.EMPLOYEE]);
    const body = await request.json();

    const parsed = createOrderCustomerSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          message:
            "Le nom et le numéro de téléphone sont requis et doivent être valides.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await createOrderCustomer(
      {
        id: user.userId,
        role: user.role,
      },
      parsed.data,
    );

    return Response.json(
      {
        message: "Client enregistré avec succès.",
        ...result,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Erreur création client commande :", error);

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

    if (error instanceof Error && error.message === "CUSTOMER_ALREADY_EXISTS") {
      return Response.json(
        {
          message: "Un client existe déjà avec ce numéro de téléphone.",
        },
        {
          status: 409,
        },
      );
    }

    return Response.json(
      {
        message: "Impossible d'enregistrer le client.",
      },
      {
        status: 500,
      },
    );
  }
}
