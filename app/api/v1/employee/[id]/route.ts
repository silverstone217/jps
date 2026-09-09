import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";
import {
  deleteEmployee,
  getEmployee,
  updateEmployee,
} from "@/lib/modules/employee/employee.service";
import { updateEmployeeSchema } from "@/lib/modules/employee/employee.schema";

const VIEW_ROLES: Role[] = ["MANAGER"];

const EDIT_ROLES: Role[] = ["MANAGER"];

// ============================================================
// GET /api/v1/employee/[id]
// ============================================================

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const payload = await authorize(request, VIEW_ROLES);

    const { id } = await context.params;

    const employee = await getEmployee(payload.userId, id);

    return NextResponse.json(
      {
        success: true,
        employee,
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

        case "EMPLOYEE_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Employé introuvable",
            },
            {
              status: 404,
            },
          );
      }
    }

    console.error("GET /api/v1/employee/[id]:", error);

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
// PATCH /api/v1/employee/[id]
// ============================================================

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const payload = await authorize(request, EDIT_ROLES);

    const { id } = await context.params;

    const body = await request.json();

    const result = updateEmployeeSchema.safeParse(body);

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

    const employee = await updateEmployee(payload.userId, id, result.data);

    return NextResponse.json(
      {
        success: true,
        message: "Employé modifié avec succès",
        employee,
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

        case "EMPLOYEE_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Employé introuvable",
            },
            {
              status: 404,
            },
          );

        case "EMPLOYEE_TELEPHONE_ALREADY_EXISTS":
          return NextResponse.json(
            {
              success: false,
              message: "Ce numéro de téléphone est déjà utilisé",
            },
            {
              status: 409,
            },
          );

        case "EMPLOYEE_EMAIL_ALREADY_EXISTS":
          return NextResponse.json(
            {
              success: false,
              message: "Cette adresse email est déjà utilisée",
            },
            {
              status: 409,
            },
          );

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
      }
    }

    console.error("PATCH /api/v1/employee/[id]:", error);

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
// DELETE /api/v1/employee/[id]
// ============================================================

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const payload = await authorize(request, EDIT_ROLES);

    const { id } = await context.params;

    await deleteEmployee(payload.userId, id);

    return NextResponse.json(
      {
        success: true,
        message: "Employé supprimé avec succès",
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

        case "EMPLOYEE_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message: "Employé introuvable",
            },
            {
              status: 404,
            },
          );

        case "EMPLOYEE_HAS_RELATED_DATA":
          return NextResponse.json(
            {
              success: false,
              message:
                "Cet employé possède déjà un historique d'activité et ne peut pas être supprimé.",
            },
            {
              status: 409,
            },
          );
      }
    }

    console.error("DELETE /api/v1/employee/[id]:", error);

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
