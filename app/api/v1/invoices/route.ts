import { NextRequest, NextResponse } from "next/server";
import type { Role } from "@/app/generated/prisma/client";
import { authorize } from "@/lib/modules/auth/authorize";
import { getInvoices } from "@/lib/modules/invoice/invoice.service";

import { invoiceFilterSchema } from "@/lib/modules/invoice/invoice.schema";

// ======================================================
// RÔLES AUTORISÉS
// ======================================================

const ALLOWED_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];

// ======================================================
// GET /api/v1/invoices
// ======================================================

export async function GET(request: NextRequest) {
  // ====================================================
  // AUTORISATION
  // ====================================================

  try {
    await authorize(request, ALLOWED_ROLES);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          message: "Vous devez être authentifié.",
        },
        {
          status: 401,
        },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        {
          message: "Vous n'avez pas l'autorisation d'accéder aux factures.",
        },
        {
          status: 403,
        },
      );
    }

    console.error("Erreur autorisation factures :", error);

    return NextResponse.json(
      {
        message: "Erreur d'autorisation.",
      },
      {
        status: 500,
      },
    );
  }

  // ====================================================
  // QUERY PARAMS
  // ====================================================

  const searchParams = request.nextUrl.searchParams;

  const minAmount = searchParams.get("minAmount");

  const maxAmount = searchParams.get("maxAmount");

  const period = searchParams.get("period");

  const date = searchParams.get("date");

  // ====================================================
  // VALIDATION
  // ====================================================

  const parsed = invoiceFilterSchema.safeParse({
    ...(minAmount !== null
      ? {
          minAmount,
        }
      : {}),

    ...(maxAmount !== null
      ? {
          maxAmount,
        }
      : {}),

    ...(period !== null
      ? {
          period,
        }
      : {}),

    ...(date !== null
      ? {
          date,
        }
      : {}),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.issues.map((issue) => issue.message).join(" "),
      },
      {
        status: 400,
      },
    );
  }

  // ====================================================
  // RÉCUPÉRATION
  // ====================================================

  try {
    const invoices = await getInvoices(parsed.data);

    return NextResponse.json(
      {
        invoices,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("Erreur récupération factures :", error);

    // --------------------------------------------------
    // SHOP INTROUVABLE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "SHOP_NOT_FOUND") {
      return NextResponse.json(
        {
          message: "Boutique introuvable.",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------------------------
    // DATE INVALIDE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "INVALID_DATE") {
      return NextResponse.json(
        {
          message: "La date fournie est invalide.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // PÉRIODE INVALIDE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "INVALID_PERIOD") {
      return NextResponse.json(
        {
          message: "La période fournie est invalide.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // ERREUR SERVEUR
    // --------------------------------------------------

    return NextResponse.json(
      {
        message: "Impossible de récupérer les factures.",
      },
      {
        status: 500,
      },
    );
  }
}
