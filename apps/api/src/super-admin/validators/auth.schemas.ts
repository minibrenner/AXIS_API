import { z } from "zod";

export const superAdminLoginSchema = z.object({
  email: z.string().email("email invalido"),
  password: z.string().min(6, "password minimo 6 caracteres"),
});

export type SuperAdminLoginInput = z.infer<typeof superAdminLoginSchema>;
