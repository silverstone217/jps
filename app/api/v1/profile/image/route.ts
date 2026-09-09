import { NextResponse } from "next/server";
import type { Role } from "@/app/generated/prisma/client";
import { authorize } from "@/lib/modules/auth/authorize";
import {
  removeProfileImage,
  updateProfileImage,
} from "@/lib/modules/profile/profile.service";

const ALLOWED_ROLES: Role[] = ["MANAGER", "EMPLOYEE"];

// ============================================================
// POST /api/v1/profile/image
// ============================================================

export async function POST(request: Request) {
  try {
    // ==========================================================
    // AUTHENTIFICATION
    // ==========================================================

    const payload = await authorize(request, ALLOWED_ROLES);

    // ==========================================================
    // RÉCUPÉRER LE FORM DATA
    // ==========================================================

    const formData = await request.formData();

    const file = formData.get("image");

    // ==========================================================
    // VÉRIFIER LE FICHIER
    // ==========================================================

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "Aucune image n'a été fournie",
        },
        {
          status: 400,
        },
      );
    }

    // ==========================================================
    // VÉRIFIER LE TYPE
    // ==========================================================

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Format d'image non supporté. Utilisez JPG, PNG ou WEBP.",
        },
        {
          status: 400,
        },
      );
    }

    // ==========================================================
    // VÉRIFIER LA TAILLE
    // ==========================================================

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "L'image ne doit pas dépasser 5 Mo.",
        },
        {
          status: 400,
        },
      );
    }

    // ==========================================================
    // CONVERTIR EN BUFFER
    // ==========================================================

    const arrayBuffer = await file.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    // ==========================================================
    // UPLOAD + MODIFICATION DU PROFIL
    // ==========================================================

    const user = await updateProfileImage(payload.userId, buffer);

    // ==========================================================
    // RÉPONSE
    // ==========================================================

    return NextResponse.json(
      {
        success: true,
        message: "Photo de profil modifiée avec succès",
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

        case "CLOUDINARY_UPLOAD_FAILED":
          return NextResponse.json(
            {
              success: false,
              message: "Impossible de télécharger l'image.",
            },
            {
              status: 500,
            },
          );
      }
    }

    console.error("POST /api/v1/profile/image:", error);

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
// DELETE /api/v1/profile/image
// ============================================================

export async function DELETE(request: Request) {
  try {
    // ==========================================================
    // AUTHENTIFICATION
    // ==========================================================

    const payload = await authorize(request, ALLOWED_ROLES);

    // ==========================================================
    // SUPPRIMER L'IMAGE
    // ==========================================================

    const user = await removeProfileImage(payload.userId);

    // ==========================================================
    // RÉPONSE
    // ==========================================================

    return NextResponse.json(
      {
        success: true,
        message: "Photo de profil supprimée avec succès",
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

    console.error("DELETE /api/v1/profile/image:", error);

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
