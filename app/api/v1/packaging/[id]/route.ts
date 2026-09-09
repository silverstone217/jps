import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import {
  deletePackaging,
  getPackaging,
  //   setPackagingActive,
  updatePackaging,
} from "@/lib/modules/packaging/packaging.service";

import {
  deletePackagingSchema,
  updatePackagingSchema,
} from "@/lib/modules/packaging/packaging.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const { id } = await context.params;

    const packaging = await getPackaging(payload.userId, id);

    return NextResponse.json(
      {
        success: true,
        packaging,
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

        case "PACKAGING_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Emballage introuvable",
            },
            {
              status: 404,
            },
          );
      }
    }

    console.error("GET /api/v1/packaging/[id]:", error);

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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const { id } = await context.params;

    const body = await request.json();

    const result = updatePackagingSchema.safeParse(body);

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

    const packaging = await updatePackaging(payload.userId, id, result.data);

    return NextResponse.json(
      {
        success: true,
        message: "Emballage modifié avec succès",
        packaging,
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

        case "PACKAGING_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Emballage introuvable",
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

    console.error("PATCH /api/v1/packaging/[id]:", error);

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

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const { id } = await context.params;

    const result = deletePackagingSchema.safeParse({
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

    await deletePackaging(payload.userId, result.data.id);

    return NextResponse.json(
      {
        success: true,
        message: "Emballage supprimé avec succès",
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

        case "PACKAGING_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Emballage introuvable",
            },
            {
              status: 404,
            },
          );

        case "PACKAGING_HAS_HISTORY":
          return NextResponse.json(
            {
              success: false,
              message:
                "Cet emballage ne peut pas être supprimé car il est déjà utilisé dans l'historique.",
            },
            {
              status: 409,
            },
          );

        case "PACKAGING_HAS_STOCK":
          return NextResponse.json(
            {
              success: false,
              message:
                "Cet emballage ne peut pas être supprimé car son stock est encore supérieur à zéro.",
            },
            {
              status: 409,
            },
          );
      }
    }

    console.error("DELETE /api/v1/packaging/[id]:", error);

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
