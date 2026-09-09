import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";
import { authorize } from "@/lib/modules/auth/authorize";
import {
  createPackaging,
  getPackagings,
} from "@/lib/modules/packaging/packaging.service";

import { createPackagingSchema } from "@/lib/modules/packaging/packaging.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

export async function GET(request: Request) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const packagings = await getPackagings(payload.userId);

    return NextResponse.json(
      {
        success: true,
        packagings,
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

    console.error("GET /api/v1/packaging:", error);

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

export async function POST(request: Request) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const body = await request.json();

    const result = createPackagingSchema.safeParse(body);

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

    const packaging = await createPackaging(payload.userId, result.data);

    return NextResponse.json(
      {
        success: true,
        message: "Emballage créé avec succès",
        packaging,
      },
      {
        status: 201,
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

        case "PACKAGING_ALREADY_EXISTS":
          return NextResponse.json(
            {
              success: false,
              message: "Un emballage avec ce nom et cette taille existe déjà",
            },
            {
              status: 409,
            },
          );

        case "INVALID_PACKAGING_CAPACITY":
          return NextResponse.json(
            {
              success: false,
              message:
                "La capacité de l'emballage ne correspond pas à sa taille",
            },
            {
              status: 400,
            },
          );
      }
    }

    console.error("POST /api/v1/packaging:", error);

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
