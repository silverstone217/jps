import { NextResponse } from "next/server";
import type { Role } from "@/app/generated/prisma/client";
import { authorize } from "@/lib/modules/auth/authorize";
import { removeEmployeeFromPointOfSale } from "@/lib/modules/point-of-sale/point-of-sale.service";

const ALLOWED_ROLES: Role[] = ["MANAGER"];

// ============================================================
// TYPE DES PARAMÈTRES
// ============================================================

interface RouteContext {
  params: Promise<{
    id: string;
    employeeId: string;
  }>;
}

// ============================================================
// DELETE /api/v1/point-of-sale/:id/staff/:employeeId
// RETIRER UN EMPLOYÉ D'UN POINT DE VENTE
// ============================================================

export async function DELETE(request: Request, context: RouteContext) {
  try {
    // ========================================================
    // AUTHENTIFICATION / AUTORISATION
    // ========================================================

    const payload = await authorize(request, ALLOWED_ROLES);

    // ========================================================
    // PARAMÈTRES
    // ========================================================

    const { id, employeeId } = await context.params;

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

    if (!employeeId) {
      return NextResponse.json(
        {
          success: false,
          message: "L'identifiant de l'employé est requis",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // RETIRER L'AFFECTATION
    // ========================================================

    const pointOfSale = await removeEmployeeFromPointOfSale(
      payload.userId,
      id,
      employeeId,
    );

    // ========================================================
    // RÉPONSE
    // ========================================================

    return NextResponse.json(
      {
        success: true,
        message: "Employé retiré avec succès",
        pointOfSale,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        // ----------------------------------------------------
        // AUTHENTIFICATION
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // AUTORISATION
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // BOUTIQUE
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // POINT DE VENTE
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // AFFECTATION
        // ----------------------------------------------------

        case "EMPLOYEE_ASSIGNMENT_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Cet employé n'est pas affecté à ce point de vente",
            },
            {
              status: 404,
            },
          );
      }
    }

    console.error(
      "DELETE /api/v1/point-of-sale/[id]/staff/[employeeId]:",
      error,
    );

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
