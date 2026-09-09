import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";

import { assignEmployeeToPointOfSale } from "@/lib/modules/point-of-sale/point-of-sale.service";

import { assignEmployeeSchema } from "@/lib/modules/point-of-sale/point-of-sale.schema";

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
// PATCH /api/v1/point-of-sale/:id/staff
// AFFECTER UN EMPLOYÉ À UN POINT DE VENTE
// ============================================================

export async function PATCH(request: Request, context: RouteContext) {
  try {
    // ========================================================
    // AUTHENTIFICATION / AUTORISATION
    // ========================================================

    const payload = await authorize(request, ALLOWED_ROLES);

    // ========================================================
    // PARAMÈTRE POS
    // ========================================================

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

    // ========================================================
    // BODY
    // ========================================================

    const body = await request.json();

    // ========================================================
    // VALIDATION
    // ========================================================

    const result = assignEmployeeSchema.safeParse(body);

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

    // ========================================================
    // AFFECTATION
    // ========================================================

    const pointOfSale = await assignEmployeeToPointOfSale(
      payload.userId,
      id,
      result.data.employeeId,
    );

    // ========================================================
    // RÉPONSE
    // ========================================================

    return NextResponse.json(
      {
        success: true,
        message: "Employé affecté avec succès",
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

        case "POINT_OF_SALE_INACTIVE":
          return NextResponse.json(
            {
              success: false,
              message: "Le point de vente sélectionné est désactivé",
            },
            {
              status: 409,
            },
          );

        // ----------------------------------------------------
        // EMPLOYÉ
        // ----------------------------------------------------

        case "EMPLOYEE_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Employé introuvable ou non disponible",
            },
            {
              status: 404,
            },
          );

        case "EMPLOYEE_ALREADY_ASSIGNED":
          return NextResponse.json(
            {
              success: false,
              message: "Cet employé est déjà affecté à un autre point de vente",
            },
            {
              status: 409,
            },
          );

        case "EMPLOYEE_ALREADY_ASSIGNED_TO_THIS_POINT_OF_SALE":
          return NextResponse.json(
            {
              success: false,
              message: "Cet employé est déjà affecté à ce point de vente",
            },
            {
              status: 409,
            },
          );
      }
    }

    console.error("PATCH /api/v1/point-of-sale/[id]/staff:", error);

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
