import { NextResponse } from "next/server";

import type { Role } from "@/app/generated/prisma/client";

import { authorize } from "@/lib/modules/auth/authorize";
import {
  createEmployee,
  getEmployees,
} from "@/lib/modules/employee/employee.service";
import { createEmployeeSchema } from "@/lib/modules/employee/employee.schema";

const VIEW_ROLES: Role[] = ["MANAGER"];

const EDIT_ROLES: Role[] = ["MANAGER"];

// ============================================================
// GET /api/v1/employee
// ============================================================

export async function GET(request: Request) {
  try {
    const payload = await authorize(request, VIEW_ROLES);

    const employees = await getEmployees(payload.userId);

    return NextResponse.json(
      {
        success: true,
        employees,
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
      }
    }

    console.error("GET /api/v1/employee:", error);

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
// POST /api/v1/employee
// ============================================================

export async function POST(request: Request) {
  try {
    const payload = await authorize(request, EDIT_ROLES);

    const body = await request.json();

    const result = createEmployeeSchema.safeParse(body);

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

    const employee = await createEmployee(payload.userId, result.data);

    return NextResponse.json(
      {
        success: true,
        message: "Employé créé avec succès",
        employee,
      },
      {
        status: 201,
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

    console.error("POST /api/v1/employee:", error);

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
