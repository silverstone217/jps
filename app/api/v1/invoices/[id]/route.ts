import { NextRequest, NextResponse } from "next/server";
import type { Role } from "@/app/generated/prisma/client";
import { authorize } from "@/lib/modules/auth/authorize";
import { getInvoiceById } from "@/lib/modules/invoice/invoice.service";
import { invoiceIdSchema } from "@/lib/modules/invoice/invoice.schema";

// ======================================================
// RÔLES AUTORISÉS
// ======================================================

const ALLOWED_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];

// ======================================================
// GET /api/v1/invoices/[id]
// ======================================================

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
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

    console.error("Erreur autorisation facture :", error);

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
  // PARAMÈTRES
  // ====================================================

  const { id } = await context.params;

  // ====================================================
  // VALIDATION ID
  // ====================================================

  const parsed = invoiceIdSchema.safeParse({
    id,
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
    const invoice = await getInvoiceById(parsed.data.id);

    return NextResponse.json(
      {
        invoice,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("Erreur récupération facture :", error);

    // --------------------------------------------------
    // FACTURE INTROUVABLE
    // --------------------------------------------------

    if (error instanceof Error && error.message === "INVOICE_NOT_FOUND") {
      return NextResponse.json(
        {
          message: "Facture introuvable.",
        },
        {
          status: 404,
        },
      );
    }

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
    // ERREUR SERVEUR
    // --------------------------------------------------

    return NextResponse.json(
      {
        message: "Impossible de récupérer la facture.",
      },
      {
        status: 500,
      },
    );
  }
}
