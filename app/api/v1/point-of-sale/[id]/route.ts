import { NextResponse } from "next/server";
import type { Role } from "@/app/generated/prisma/client";
import { authorize } from "@/lib/modules/auth/authorize";
import {
  deletePointOfSale,
  getPointOfSale,
  updatePointOfSale,
} from "@/lib/modules/point-of-sale/point-of-sale.service";

import { updatePointOfSaleSchema } from "@/lib/modules/point-of-sale/point-of-sale.schema";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ============================================================
// TYPE DES PARAMÈTRES
// ============================================================

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// ============================================================
// GET /api/v1/point-of-sale/:id
// ============================================================

export async function GET(request: Request, context: RouteContext) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "L'identifiant du point de vente est requis",
        },
        {
          status: 400,
        },
      );
    }

    const pointOfSale = await getPointOfSale(payload.userId, id);

    return NextResponse.json(
      {
        success: true,
        pointOfSale,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        // ------------------------------------------------------
        // AUTHENTIFICATION
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // AUTORISATION
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // BOUTIQUE INTROUVABLE
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // POINT DE VENTE INTROUVABLE
        // ------------------------------------------------------

        case "POINT_OF_SALE_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Point de vente introuvable",
            },
            {
              status: 404,
            },
          );
      }
    }

    console.error("GET /api/v1/point-of-sale/[id]:", error);

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
// PATCH /api/v1/point-of-sale/:id
// ============================================================

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "L'identifiant du point de vente est requis",
        },
        {
          status: 400,
        },
      );
    }

    const body = await request.json();

    const result = updatePointOfSaleSchema.safeParse(body);

    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // MODIFICATION
    // ----------------------------------------------------------

    const pointOfSale = await updatePointOfSale(
      payload.userId,
      id,
      result.data,
    );

    return NextResponse.json(
      {
        success: true,
        message: "Point de vente modifié avec succès",
        pointOfSale,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        // ------------------------------------------------------
        // AUTHENTIFICATION
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // AUTORISATION
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // BOUTIQUE INTROUVABLE
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // POINT DE VENTE INTROUVABLE
        // ------------------------------------------------------

        case "POINT_OF_SALE_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Point de vente introuvable",
            },
            {
              status: 404,
            },
          );

        // ------------------------------------------------------
        // CODE DÉJÀ UTILISÉ
        // ------------------------------------------------------

        case "POINT_OF_SALE_CODE_ALREADY_EXISTS":
          return NextResponse.json(
            {
              success: false,
              message: "Ce code de point de vente est déjà utilisé",
            },
            {
              status: 409,
            },
          );

        // ------------------------------------------------------
        // MAGASIN PRINCIPAL
        // ------------------------------------------------------

        case "MAIN_STORE_CANNOT_BE_DEACTIVATED":
          return NextResponse.json(
            {
              success: false,
              message: "Le magasin principal ne peut pas être désactivé",
            },
            {
              status: 400,
            },
          );
      }
    }

    console.error("PATCH /api/v1/point-of-sale/[id]:", error);

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
// DELETE /api/v1/point-of-sale/:id
// ============================================================

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const payload = await authorize(request, ALLOWED_ROLES);

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "L'identifiant du point de vente est requis",
        },
        {
          status: 400,
        },
      );
    }

    // ----------------------------------------------------------
    // SUPPRESSION
    // ----------------------------------------------------------

    await deletePointOfSale(payload.userId, id);

    return NextResponse.json(
      {
        success: true,
        message: "Point de vente supprimé avec succès",
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        // ------------------------------------------------------
        // AUTHENTIFICATION
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // AUTORISATION
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // BOUTIQUE INTROUVABLE
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // POINT DE VENTE INTROUVABLE
        // ------------------------------------------------------

        case "POINT_OF_SALE_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Point de vente introuvable",
            },
            {
              status: 404,
            },
          );

        // ------------------------------------------------------
        // MAGASIN PRINCIPAL
        // ------------------------------------------------------

        case "MAIN_STORE_CANNOT_BE_DELETED":
          return NextResponse.json(
            {
              success: false,
              message: "Le magasin principal ne peut pas être supprimé",
            },
            {
              status: 400,
            },
          );

        // ------------------------------------------------------
        // DONNÉES ASSOCIÉES
        // ------------------------------------------------------

        case "POINT_OF_SALE_HAS_RELATED_DATA":
          return NextResponse.json(
            {
              success: false,
              message:
                "Ce point de vente contient des données associées et ne peut pas être supprimé",
            },
            {
              status: 409,
            },
          );
      }
    }

    console.error("DELETE /api/v1/point-of-sale/[id]:", error);

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
