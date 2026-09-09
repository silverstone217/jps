import { NextResponse } from "next/server";
import type { Role } from "@/app/generated/prisma/client";
import { authorize } from "@/lib/modules/auth/authorize";
import { changePassword } from "@/lib/modules/security/security.service";
import { changePasswordSchema } from "@/lib/modules/security/security.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];

// ============================================================
// PATCH /api/v1/security/password
// ============================================================

export async function PATCH(request: Request) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const body = await request.json();

    const result = changePasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Données invalides",
          errors: result.error.issues,
        },
        {
          status: 400,
        },
      );
    }

    await changePassword(
      payload.userId,
      result.data.currentPassword,
      result.data.newPassword,
    );

    return NextResponse.json(
      {
        success: true,
        message: "Mot de passe modifié avec succès",
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

        case "INVALID_CURRENT_PASSWORD":
          return NextResponse.json(
            {
              success: false,
              message: "L'ancien mot de passe est incorrect",
            },
            {
              status: 400,
            },
          );

        case "PASSWORD_SAME_AS_CURRENT":
          return NextResponse.json(
            {
              success: false,
              message:
                "Le nouveau mot de passe doit être différent de l'ancien",
            },
            {
              status: 400,
            },
          );

        case "INVALID_NEW_PASSWORD":
          return NextResponse.json(
            {
              success: false,
              message:
                "Le nouveau mot de passe doit contenir entre 6 et 12 caractères",
            },
            {
              status: 400,
            },
          );
      }
    }

    console.error("PATCH /api/v1/security/password:", error);

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
