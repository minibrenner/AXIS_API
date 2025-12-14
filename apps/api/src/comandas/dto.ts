import { z } from "zod";

export const comandaStatusSchema = z.enum(["ABERTO", "PENDENTE", "ENCERRADO"]);
export const comandaCustomerStatusSchema = z.enum(["ATIVO", "DESATIVADO"]);

export const createComandaSchema = z.object({
  number: z.string().trim().min(1, "Numero da comanda e obrigatorio"),
  customerName: z.string().trim().min(2).max(120).optional(),
  customerPhone: z.string().trim().min(8).max(20).optional(),
  customerCpf: z.string().trim().min(11).max(14).optional(),
  status: comandaStatusSchema.default("ABERTO").optional(),
  customerStatus: comandaCustomerStatusSchema.default("ATIVO").optional(),
  notes: z.string().trim().max(280).optional(),
});

export const updateComandaSchema = createComandaSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Informe ao menos um campo para atualizar.",
);

export const listComandaQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: comandaStatusSchema.optional(),
  customerStatus: comandaCustomerStatusSchema.optional(),
});

export const comandaOrderItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().positive().finite(),
});

export const addComandaItemsSchema = z.object({
  items: z.array(comandaOrderItemSchema).min(1, "Informe ao menos um item."),
  tableNumber: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type CreateComandaInput = z.infer<typeof createComandaSchema>;
export type UpdateComandaInput = z.infer<typeof updateComandaSchema>;
export type ListComandaQuery = z.infer<typeof listComandaQuerySchema>;
export type AddComandaItemsInput = z.infer<typeof addComandaItemsSchema>;
