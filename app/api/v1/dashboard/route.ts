import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";
import DashboardService from "@/lib/modules/dashboard/dashboard.service";
import { authorize } from "@/lib/modules/auth/authorize";

const VIEW_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];

// ============================================================
// GET /api/v1/dashboard
// ============================================================

export async function GET(request: Request) {
  try {
    const payload = await authorize(request, VIEW_ROLES);

    const dashboard = await DashboardService.getDashboard(
      payload.userId,
      payload.role,
    );

    return NextResponse.json(
      {
        success: true,
        dashboard,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
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

        case "SHOP_NOT_FOUND":
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
    }

    console.error("GET /api/v1/dashboard:", error);

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
