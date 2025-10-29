import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("email inválido"),
  password: z.string().min(6, "password mínimo 6 caracteres"),
  name: z.string().min(2).optional(),
  role: z.enum(["ATTENDANT", "ADMIN"]).optional(),
  isActive: z.boolean().optional()
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  name: z.string().min(2).optional(),
  role: z.enum(["ATTENDANT", "ADMIN"]).optional(),
  isActive: z.boolean().optional()
});
