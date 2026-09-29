import { NextResponse } from "next/server";

import { authorize } from "@/lib/modules/auth/authorize";
import {
  ReportService,
  ReportServiceError,
} from "@/lib/modules/report/report.service";

export async function GET(request: Request) {
  try {
    const user = await authorize(request, ["MANAGER"]);

    const pointOfSales = await ReportService.getPointOfSales(user.userId);

    return NextResponse.json({
      success: true,
      data: pointOfSales,
    });
  } catch (error) {
    if (error instanceof ReportServiceError) {
      switch (error.code) {
        case "UNAUTHORIZED":
          return NextResponse.json(
            {
              success: false,
              message: "Non authentifié.",
            },
            { status: 401 },
          );

        case "FORBIDDEN":
          return NextResponse.json(
            {
              success: false,
              message: "Accès interdit.",
            },
            { status: 403 },
          );

        case "SHOP_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Boutique principale introuvable.",
            },
            { status: 404 },
          );

        default:
          return NextResponse.json(
            {
              success: false,
              message: "Impossible de récupérer les points de vente.",
            },
            { status: 500 },
          );
      }
    }

    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
          {
            success: false,
            message: "Non authentifié.",
          },
          { status: 401 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            success: false,
            message: "Accès interdit.",
          },
          { status: 403 },
        );
      }
    }

    console.error("Erreur GET /api/v1/report/point-of-sales :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Impossible de récupérer les points de vente.",
      },
      { status: 500 },
    );
  }
}
