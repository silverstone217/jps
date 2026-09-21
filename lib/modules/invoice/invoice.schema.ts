import type {
  BottleSize,
  Currency,
  InvoiceDeliveryMethod,
  InvoiceStatus,
} from "@/app/generated/prisma/client";

import { z } from "zod";

// ============================================================
// VALIDATION ID
// ============================================================

export const invoiceIdSchema = z.object({
  id: z.string().trim().min(1, "L'identifiant de la facture est requis."),
});

export type InvoiceIdInput = z.infer<typeof invoiceIdSchema>;

// ============================================================
// FILTRES
// ============================================================

export const invoiceFilterSchema = z
  .object({
    minAmount: z.coerce
      .number()
      .min(0, "Le montant minimum doit être positif.")
      .optional(),

    maxAmount: z.coerce
      .number()
      .min(0, "Le montant maximum doit être positif.")
      .optional(),

    period: z.enum(["year", "month", "week", "day"]).optional(),

    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "La date doit être au format YYYY-MM-DD.")
      .optional(),
  })
  .refine(
    (data) =>
      data.minAmount === undefined ||
      data.maxAmount === undefined ||
      data.minAmount <= data.maxAmount,
    {
      message:
        "Le montant minimum ne peut pas être supérieur au montant maximum.",
      path: ["maxAmount"],
    },
  )
  .refine((data) => data.period === undefined || data.date !== undefined, {
    message: "Une date est requise lorsqu'une période est sélectionnée.",
    path: ["date"],
  });

export type InvoiceFilterInput = z.infer<typeof invoiceFilterSchema>;

// ============================================================
// DATA
// ============================================================

export interface InvoiceData {
  id: string;
  saleId: string;

  invoiceNumber: string;
  status: InvoiceStatus;

  deliveryMethod: InvoiceDeliveryMethod | null;
  whatsappSentAt: string | null;
  printedAt: string | null;

  shop: {
    name: string;
  };

  pointOfSale: {
    name: string;
    address: string | null;
    telephone: string | null;
  };

  seller: {
    name: string;
  };

  currency: Currency;

  subtotal: number;
  discountAmount: number;
  totalAmount: number;

  loyalty: {
    pointsEarned: number;
    pointsUsed: number;
  };

  customer: {
    name: string | null;
    phone: string | null;
  };

  createdAt: string;

  items: InvoiceItemData[];
}

export interface InvoiceItemData {
  id: string;
  invoiceId: string;

  productName: string;
  size: BottleSize;

  quantity: number;

  unitPrice: number;
  subtotal: number;

  currency: Currency;
}
