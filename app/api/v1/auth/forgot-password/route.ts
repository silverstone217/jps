import { NextResponse } from "next/server";

import PasswordService from "@/lib/modules/password/password.service";
import { forgotPasswordSchema } from "@/lib/modules/password/password.schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = forgotPasswordSchema.safeParse(body);

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

    const result = await PasswordService.forgotPassword(parsed.data);

    return NextResponse.json(
      {
        success: true,
        message:
          "Un nouveau mot de passe temporaire a été envoyé à votre adresse email.",
        email: result.email,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "INVALID_CREDENTIALS":
          return NextResponse.json(
            {
              success: false,
              message:
                "Les informations fournies ne correspondent à aucun compte.",
            },
            { status: 400 },
          );

        case "EMAIL_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Aucune adresse email n'est associée à ce compte.",
            },
            { status: 400 },
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

        case "EMAIL_SEND_FAILED":
          return NextResponse.json(
            {
              success: false,
              message:
                "Impossible d'envoyer l'email pour le moment. Veuillez réessayer.",
            },
            { status: 500 },
          );
      }
    }

    console.error("POST /api/v1/auth/forgot-password:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Une erreur interne est survenue.",
      },
      { status: 500 },
    );
  }
}
