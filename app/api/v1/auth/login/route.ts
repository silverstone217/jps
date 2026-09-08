import { NextResponse } from "next/server";

import { loginSchema } from "@/lib/modules/auth/auth.schema";
import { login } from "@/lib/modules/auth/auth.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = loginSchema.safeParse(body);

    if (!result.success) {
      const errors = result.error.issues
        .map((issue) => issue.message)
        .join(", ");

      return NextResponse.json(
        {
          success: false,
          message: errors,
        },
        { status: 400 },
      );
    }

    const data = await login(result.data);

    return NextResponse.json(
      {
        success: true,
        message: "Connexion réussie",
        data,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_CREDENTIALS") {
        return NextResponse.json(
          {
            success: false,
            message: "Téléphone ou mot de passe incorrect",
          },
          { status: 401 },
        );
      }

      if (error.message === "ACCOUNT_DISABLED") {
        return NextResponse.json(
          {
            success: false,
            message: "Ce compte est désactivé",
          },
          { status: 403 },
        );
      }
    }

    console.error("POST /api/v1/auth/login:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}
