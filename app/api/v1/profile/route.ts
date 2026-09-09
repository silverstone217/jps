import { NextResponse } from "next/server";
import type { Role } from "@/app/generated/prisma/client";
import {
  getProfile,
  updateProfile,
} from "@/lib/modules/profile/profile.service";
import { updateProfileSchema } from "@/lib/modules/profile/profile.schema";
import { authorize } from "@/lib/modules/auth/authorize";

const ALLOWED_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];

// ============================================================
// GET /api/v1/profile
// ============================================================

export async function GET(request: Request) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const user = await getProfile(payload.userId);

    return NextResponse.json(
      {
        success: true,
        user,
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

        case "USER_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Utilisateur introuvable",
            },
            {
              status: 404,
            },
          );
      }
    }

    console.error("GET /api/v1/profile:", error);

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

// ============================================================
// PATCH /api/v1/profile
// ============================================================

export async function PATCH(request: Request) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const body = await request.json();

    const result = updateProfileSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Données invalides",
          errors: result.error.flatten().fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    const user = await updateProfile(payload.userId, result.data);

    return NextResponse.json(
      {
        success: true,
        message: "Profil modifié avec succès",
        user,
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

        case "USER_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Utilisateur introuvable",
            },
            {
              status: 404,
            },
          );

        case "EMAIL_ALREADY_EXISTS":
          return NextResponse.json(
            {
              success: false,
              message: "Cette adresse email est déjà utilisée",
            },
            {
              status: 409,
            },
          );

        case "TELEPHONE_ALREADY_EXISTS":
          return NextResponse.json(
            {
              success: false,
              message: "Ce numéro de téléphone est déjà utilisé",
            },
            {
              status: 409,
            },
          );
      }
    }

    console.error("PATCH /api/v1/profile:", error);

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
