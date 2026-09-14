import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import { getProductionById } from "@/lib/modules/production/production.service";

import { productionIdSchema } from "@/lib/modules/production/production.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ======================================================
// GET /api/v1/productions/[id]
// ======================================================

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    // ==================================================
    // AUTHENTIFICATION
    // ==================================================

    await authorize(request, ALLOWED_ROLES);

    // ==================================================
    // PARAMÈTRE ID
    // ==================================================

    const { id } = await context.params;

    const result = productionIdSchema.safeParse({
      id,
    });

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(", ");

      return NextResponse.json(
        {
          success: false,
          message,
        },
        {
          status: 400,
        },
      );
    }

    // ==================================================
    // RÉCUPÉRER LA PRODUCTION
    // ==================================================

    const production = await getProductionById(result.data.id);

    // ==================================================
    // RESPONSE
    // ==================================================

    return NextResponse.json(
      {
        success: true,
        production,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        // ==============================================
        // AUTH
        // ==============================================

        case "UNAUTHORIZED":
          return NextResponse.json(
            {
              success: false,
              message: "Non autorisé",
            },
            {
              status: 401,
            },
          );

        case "FORBIDDEN":
          return NextResponse.json(
            {
              success: false,
              message: "Accès interdit",
            },
            {
              status: 403,
            },
          );

        // ==============================================
        // PRODUCTION
        // ==============================================

        case "PRODUCTION_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Production introuvable",
            },
            {
              status: 404,
            },
          );
      }
    }

    console.error("GET /api/v1/productions/[id]:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Une erreur interne est survenue",
      },
      {
        status: 500,
      },
    );
  }
}
