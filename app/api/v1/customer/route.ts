import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";
import { getCustomers } from "@/lib/modules/customer/customer.service";
import { getCustomersSchema } from "@/lib/modules/customer/customer.schema";

// ======================================================
// RÔLES AUTORISÉS
// ======================================================

const VIEW_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];

// ======================================================
// GET /api/v1/customer
// ======================================================

export async function GET(request: Request) {
  try {
    // ====================================================
    // AUTHENTIFICATION / AUTORISATION
    // ====================================================

    const payload = await authorize(request, VIEW_ROLES);

    // ====================================================
    // QUERY PARAMS
    // ====================================================

    const { searchParams } = new URL(request.url);

    const rawInput = {
      search: searchParams.get("search") ?? undefined,
      pointOfSaleId: searchParams.get("pointOfSaleId") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      updatedSince: searchParams.get("updatedSince") ?? undefined,
    };

    // ====================================================
    // VALIDATION
    // ====================================================

    const parsed = getCustomersSchema.safeParse(rawInput);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues.map((issue) => issue.message).join(", "),
        },
        {
          status: 400,
        },
      );
    }

    // ====================================================
    // SERVICE
    // ====================================================

    const result = await getCustomers(
      payload.userId,
      payload.role,
      parsed.data,
    );

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
    // ERREURS D'AUTHENTIFICATION
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
    // ERREURS D'AUTORISATION
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
    // EMPLOYÉ SANS AFFECTATION
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
    // ERREUR INATTENDUE
    // ====================================================

    console.error("GET /api/v1/customer error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Une erreur est survenue lors de la récupération des clients",
      },
      {
        status: 500,
      },
    );
  }
}
