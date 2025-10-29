import { z } from "zod";

// helpers para normalizar números
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

const CnpjSchema = z
  .string()
  .transform(digits)
  .refine((v) => v.length === 0 || v.length === 14, { message: "CNPJ deve ter 14 dígitos" })
  .transform((v) => (v.length === 0 ? undefined : v));

const CpfSchema = z
  .string()
  .transform(digits)
  .refine((v) => v.length === 0 || v.length === 11, { message: "CPF deve ter 11 dígitos" })
  .transform((v) => (v.length === 0 ? undefined : v));

export const createTenantSchema = z.object({
  name: z.string().min(2, "name mínimo 2 caracteres"),
  email: z.string().email("email inválido"),
  cnpj: CnpjSchema.optional(),
  cpfResLoja: CpfSchema.optional(),
  // senha primária padrão, se ausente usaremos "1234" no controller
  password: z.string().min(4, "password mínimo 4 caracteres").optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  cnpj: CnpjSchema.optional(),
  cpfResLoja: CpfSchema.optional(),
  isActive: z.boolean().optional(),
  // permitir troca de senha no update
  password: z.string().min(4).optional(),
});
