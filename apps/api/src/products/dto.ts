import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional().default(""),
  barcode: z.string().optional(),
  unit: z.enum(["UN","CX","KG","LT","GR","ML","PC"]).default("UN"),
  price: z.string().regex(/^\d+([.,]\d{1,2})?$/,"use string decimal com . ou ,"),
  cost: z.string().regex(/^\d+([.,]\d{1,2})?$/).optional(),
  categoryId: z.string().optional(),
  minStock: z.string().regex(/^\d+([.,]\d{1,3})?$/).optional(),
  ncm: z.string().optional(),
  cest: z.string().optional(),
  csosn: z.string().optional(),
  cfop: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial();
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
