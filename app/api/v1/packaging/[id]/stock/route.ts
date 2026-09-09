import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import { adjustPackagingStock } from "@/lib/modules/packaging/packaging.service";

import { adjustPackagingStockSchema } from "@/lib/modules/packaging/packaging.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const { id } = await params;

    const body = await request.json();

    const result = adjustPackagingStockSchema.safeParse(body);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(", ");

      return NextResponse.json(
        {
          success: false,
          message,
        },
        { status: 400 },
      );
    }

    const packaging = await adjustPackagingStock(
      payload.userId,
      id,
      result.data,
    );

    return NextResponse.json(
      {
        success: true,
        message: "Stock de l'emballage ajusté avec succès",
        packaging,
      },
      { status: 200 },
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
            { status: 401 },
          );

        case "FORBIDDEN":
          return NextResponse.json(
            {
              success: false,
              message: "Accès interdit",
            },
            { status: 403 },
          );

        case "SHOP_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Boutique introuvable",
            },
            { status: 404 },
          );

        case "PACKAGING_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Emballage introuvable",
            },
            { status: 404 },
          );

        case "INSUFFICIENT_PACKAGING_STOCK":
          return NextResponse.json(
            {
              success: false,
              message:
                "Stock d'emballage insuffisant pour effectuer cet ajustement.",
            },
            { status: 409 },
          );
      }
    }

    console.error("PATCH /api/v1/packaging/[id]/stock:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}
