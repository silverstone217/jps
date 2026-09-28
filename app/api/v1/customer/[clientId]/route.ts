import { NextResponse } from "next/server";
import type { Role } from "@/app/generated/prisma/client";
import { authorize } from "@/lib/modules/auth/authorize";
import { getCustomer } from "@/lib/modules/customer/customer.service";
import { getCustomerSchema } from "@/lib/modules/customer/customer.schema";

// ======================================================
// RÔLES AUTORISÉS
// ======================================================

const VIEW_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];

// ======================================================
// GET /api/v1/customer/[clientId]
// ======================================================

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      clientId: string;
    }>;
  },
) {
  try {
    // ====================================================
    // AUTHENTIFICATION / AUTORISATION
    // ====================================================

    const payload = await authorize(request, VIEW_ROLES);

    // ====================================================
    // PARAMÈTRES DE ROUTE
    // ====================================================

    const { clientId } = await context.params;

    // ====================================================
    // QUERY PARAMS
    // ====================================================

    const { searchParams } = new URL(request.url);

    const rawInput = {
      clientId,

      pointOfSaleId: searchParams.get("pointOfSaleId") ?? undefined,

      page: searchParams.get("page") ?? undefined,

      limit: searchParams.get("limit") ?? undefined,
    };

    // ====================================================
    // VALIDATION
    // ====================================================

    const parsed = getCustomerSchema.safeParse(rawInput);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Paramètres invalides",
          errors: parsed.error.flatten(),
        },
        {
          status: 400,
        },
      );
    }

    // ====================================================
    // SERVICE
    // ====================================================

    const result = await getCustomer(payload.userId, payload.role, parsed.data);

    // ====================================================
    // RESPONSE
    // ====================================================

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    // ====================================================
    // AUTHENTIFICATION
    // ====================================================

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "Authentification requise",
        },
        {
          status: 401,
        },
      );
    }

    // ====================================================
    // AUTORISATION
    // ====================================================

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          message: "Vous n'avez pas l'autorisation d'accéder aux clients",
        },
        {
          status: 403,
        },
      );
    }

    // ====================================================
    // BOUTIQUE
    // ====================================================

    if (error instanceof Error && error.message === "SHOP_NOT_FOUND") {
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

    // ====================================================
    // POS
    // ====================================================

    if (error instanceof Error && error.message === "POINT_OF_SALE_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Point de vente introuvable",
        },
        {
          status: 404,
        },
      );
    }

    if (error instanceof Error && error.message === "POINT_OF_SALE_INACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Ce point de vente est inactif",
        },
        {
          status: 409,
        },
      );
    }

    // ====================================================
    // EMPLOYÉ SANS POS
    // ====================================================

    if (
      error instanceof Error &&
      error.message === "POINT_OF_SALE_NOT_ASSIGNED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Aucun point de vente actif ne vous est attribué",
        },
        {
          status: 403,
        },
      );
    }

    // ====================================================
    // CLIENT
    // ====================================================

    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Client introuvable dans ce point de vente",
        },
        {
          status: 404,
        },
      );
    }

    // ====================================================
    // ERREUR INATTENDUE
    // ====================================================

    console.error("GET /api/v1/customer/[clientId] error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Une erreur est survenue lors de la récupération du client",
      },
      {
        status: 500,
      },
    );
  }
}
