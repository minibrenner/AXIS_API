// Schemas Zod responsaveis por validar entradas do CRUD de usuarios dentro do tenant.
// Convertemos roles para maiusculas, garantimos enum valido e expomos tipos para uso no controller.
import { z } from "zod";

// Enum base utilizado tanto para validar os inputs quanto para tipar o retorno.
const roleEnum = z.enum(["ADMIN", "ATTENDANT", "OWNER"]);

// Aceita role em diversos formatos (string livre) e transforma em um valor do enum.
const roleInput = z
  .union([
    roleEnum,
    z.string().trim().transform((value) => value.toUpperCase() as z.infer<typeof roleEnum>),
  ])
  .pipe(roleEnum);

const pinSchema = z
  .string()
  .trim()
  .min(4, "pinSupervisor minimo 4 caracteres")
  .max(32, "pinSupervisor maximo 32 caracteres");

// Payload aceito na criacao de usuarios: campos obrigatorios + flags opcionais.
export const createUserSchema = z.object({
  email: z.string().email("email invalido"),
  password: z.string().min(6, "password minimo 6 caracteres"),
  name: z.string().min(2).optional(),
  role: roleInput.optional(),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
  pinSupervisor: pinSchema.optional(),
});

// Payload aceito em atualizacoes: todos os campos opcionais para PATCH-like.
export const updateUserSchema = z.object({
  email: z.string().email("email invalido").optional(),
  password: z.string().min(6, "password minimo 6 caracteres").optional(),
  name: z.string().min(2).optional(),
  role: roleInput.optional(),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
  pinSupervisor: pinSchema.optional().nullable(),
});

// Tipos inferidos para evitar repeticao de definitions no controller.
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
