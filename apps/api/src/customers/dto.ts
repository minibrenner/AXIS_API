import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(3),
  document: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  allowCredit: z.boolean().default(false),
  creditLimit: z.string().optional(), // enviar "1500.00" (string)
  defaultDueDays: z.number().int().min(0).max(180).optional(),
  isActive: z.boolean().default(true),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
