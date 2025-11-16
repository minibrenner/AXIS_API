
import { z } from "zod";

export const discountInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("value"),
    valueCents: z.coerce.number().int().positive(),
  }),
  z.object({
    type: z.literal("percent"),
    percent: z.coerce.number().positive().max(99),
  }),
]);

export const saleItemSchema = z.object({
  productId: z.string().uuid(),
  sku: z.string().optional(),
  name: z.string().min(1),
  qty: z.coerce.number().positive(),
  unitPriceCents: z.coerce.number().int().nonnegative(),
  discount: discountInputSchema.optional(),
});

export const paymentSchema = z.object({
  method: z.enum(["cash", "debit", "credit", "pix", "vr", "va", "store_credit"]),
  amountCents: z.coerce.number().int().positive(),
  providerId: z.string().optional(),
});

export const saleSchema = z.object({
  cashSessionId: z.string(),
  locationId: z.string().cuid(),
  items: z.array(saleItemSchema).min(1),
  payments: z.array(paymentSchema).min(1),
  discount: discountInputSchema.optional(),
  fiscalMode: z.enum(["sat", "nfce", "none"]).default("none"),
  saleId: z.string().optional(),
});

export type DiscountInput = z.infer<typeof discountInputSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
