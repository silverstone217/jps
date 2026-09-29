import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";
import { generateReport } from "@/lib/modules/report/report.service";
import { reportQuerySchema } from "@/lib/modules/report/report.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ============================================================
// GET
// ============================================================

export async function GET(request: Request) {
  try {
    // ========================================================
    // AUTHORIZATION
    // ========================================================

    const user = await authorize(request, ALLOWED_ROLES);

    // ========================================================
    // QUERY PARAMS
    // ========================================================

    const searchParams = new URL(request.url).searchParams;

    const type = searchParams.get("type")?.trim();
    const dateFrom = searchParams.get("dateFrom")?.trim();
    const dateTo = searchParams.get("dateTo")?.trim();
    const pointOfSaleId = searchParams.get("pointOfSaleId")?.trim();

    // ========================================================
    // BUILD QUERY
    // ========================================================

    const query = {
      type,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(pointOfSaleId ? { pointOfSaleId } : {}),
    };

    // ========================================================
    // VALIDATION
    // ========================================================

    const parsed = reportQuerySchema.safeParse(query);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Paramètres du rapport invalides.",
          errors: parsed.error.issues,
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // GENERATE REPORT
    // ========================================================

    const report = await generateReport(user.userId, parsed.data);

    return NextResponse.json(
      {
        success: true,
        data: report,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("GET /api/v1/report error:", error);

    // ========================================================
    // AUTHORIZATION
    // ========================================================

    if (error instanceof Error) {
      switch (error.message) {
        case "UNAUTHORIZED":
          return NextResponse.json(
            {
              success: false,
              message: "Non autorisé.",
            },
            {
              status: 401,
            },
          );

        case "FORBIDDEN":
          return NextResponse.json(
            {
              success: false,
              message: "Accès interdit.",
            },
            {
              status: 403,
            },
          );
      }
    }

    // ========================================================
    // ERROR CODE
    // ========================================================

    const code =
      "code" in (error as object)
        ? (error as { code?: string }).code
        : undefined;

    // ========================================================
    // BUSINESS ERRORS
    // ========================================================

    switch (code) {
      case "USER_NOT_FOUND":
        return NextResponse.json(
          {
            success: false,
            message: "Utilisateur introuvable.",
            code,
          },
          {
            status: 404,
          },
        );

      case "USER_INACTIVE":
        return NextResponse.json(
          {
            success: false,
            message: "Ce compte utilisateur est inactif.",
            code,
          },
          {
            status: 403,
          },
        );

      case "USER_BANNED":
        return NextResponse.json(
          {
            success: false,
            message: "Ce compte utilisateur est temporairement bloqué.",
            code,
          },
          {
            status: 403,
          },
        );

      case "SHOP_NOT_FOUND":
        return NextResponse.json(
          {
            success: false,
            message: "Boutique introuvable.",
            code,
          },
          {
            status: 404,
          },
        );

      case "POINT_OF_SALE_NOT_FOUND":
        return NextResponse.json(
          {
            success: false,
            message: "Point de vente introuvable.",
            code,
          },
          {
            status: 404,
          },
        );

      case "INVALID_DATE_RANGE":
        return NextResponse.json(
          {
            success: false,
            message:
              error instanceof Error && error.message
                ? error.message
                : "La période sélectionnée est invalide.",
            code,
          },
          {
            status: 400,
          },
        );

      default:
        return NextResponse.json(
          {
            success: false,
            message:
              error instanceof Error && error.message
                ? error.message
                : "Impossible de générer le rapport.",
            code,
          },
          {
            status: 500,
          },
        );
    }
  }
}
