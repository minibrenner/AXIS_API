import { z } from "zod";

export const createTenantUserSchema = z.object({
  tenantIdentifier: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).optional(),
  role: z.enum(["ADMIN", "OWNER"]).optional(),
  pinSupervisor: z.string().trim().min(4).max(32).optional().nullable(),
});

export type CreateTenantUserInput = z.infer<typeof createTenantUserSchema>;
