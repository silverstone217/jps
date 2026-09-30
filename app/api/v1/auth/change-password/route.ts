import { NextResponse } from "next/server";
import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";
import PasswordService from "@/lib/modules/password/password.service";
import { changePasswordSchema } from "@/lib/modules/password/password.schema";

const AUTHORIZED_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];

export async function POST(request: Request) {
  try {
    const payload = await authorize(request, AUTHORIZED_ROLES);

    const body = await request.json();

    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues
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

    await PasswordService.changePassword(payload.userId, parsed.data);

    return NextResponse.json(
      {
        success: true,
        message: "Votre mot de passe a été modifié avec succès.",
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

        case "USER_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Utilisateur introuvable",
            },
            { status: 404 },
          );

        case "ACCOUNT_INACTIVE":
          return NextResponse.json(
            {
              success: false,
              message: "Ce compte est désactivé.",
            },
            { status: 403 },
          );

        case "ACCOUNT_BANNED":
          return NextResponse.json(
            {
              success: false,
              message: "Ce compte est bloqué.",
            },
            { status: 403 },
          );

        case "INVALID_CURRENT_PASSWORD":
          return NextResponse.json(
            {
              success: false,
              message: "Le mot de passe actuel est incorrect.",
            },
            { status: 400 },
          );
      }
    }

    console.error("POST /api/v1/auth/change-password:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Une erreur interne est survenue.",
      },
      { status: 500 },
    );
  }
}
