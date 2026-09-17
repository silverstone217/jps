import { z } from "zod";

const stockTransferItemSchema = z.object({
  variantId: z.string().trim().min(1, "L'identifiant du produit est requis"),

  quantity: z
    .number()
    .int("La quantité doit être un nombre entier")
    .min(1, "La quantité doit être supérieure ou égale à 1"),
});

export const createDistributionSchema = z
  .object({
    fromPosId: z
      .string()
      .trim()
      .min(1, "L'identifiant du point de départ est invalide")
      .nullable(),

    toPosId: z
      .string()
      .trim()
      .min(1, "L'identifiant du point d'arrivée est invalide")
      .nullable(),

    items: z
      .array(stockTransferItemSchema)
      .min(1, "La distribution doit contenir au moins un produit"),
  })
  .superRefine((data, ctx) => {
    // MAIN -> MAIN est interdit
    if (data.fromPosId === null && data.toPosId === null) {
      ctx.addIssue({
        code: "custom",
        path: ["toPosId"],
        message:
          "Une distribution doit avoir un point de départ ou une destination.",
      });
    }

    // POS -> même POS interdit
    if (
      data.fromPosId !== null &&
      data.toPosId !== null &&
      data.fromPosId === data.toPosId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["toPosId"],
        message:
          "Le point de départ et le point d'arrivée doivent être différents.",
      });
    }

    // Un même produit ne doit apparaître qu'une fois
    const variantIds = data.items.map((item) => item.variantId);

    if (new Set(variantIds).size !== variantIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message:
          "Un même produit ne peut apparaître qu'une seule fois dans une distribution.",
      });
    }
  });

export type CreateDistributionInput = z.infer<typeof createDistributionSchema>;
