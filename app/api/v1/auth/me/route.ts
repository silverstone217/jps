import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/modules/auth/authorize";

export async function GET(request: Request) {
  try {
    const payload = await authorize(request, ["MANAGER", "EMPLOYEE"]);

    const user = await prisma.user.findUnique({
      where: {
        id: payload.userId,
      },
      select: {
        id: true,
        name: true,
        telephone: true,
        email: true,
        image: true,
        role: true,
        isActive: true,
        isBanned: true,
        banExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Utilisateur introuvable",
        },
        { status: 401 },
      );
    }

    if (!user.isActive || user.isBanned) {
      return NextResponse.json(
        {
          success: false,
          message: "Ce compte est désactivé",
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Utilisateur récupéré",
        data: {
          user: {
            id: user.id,
            name: user.name,
            telephone: user.telephone,
            email: user.email,
            image: user.image,
            role: user.role,
          },
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
          {
            success: false,
            message: "Non autorisé",
          },
          { status: 401 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            success: false,
            message: "Accès interdit",
          },
          { status: 403 },
        );
      }
    }

    console.error("GET /api/v1/auth/me:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}
