import { Router } from "express";
import { withZod } from "../utils/zodMiddleware";
import { createCustomerSchema, updateCustomerSchema } from "./dto";
import { CustomersService } from "./customers.service";
import { allowRoles } from "../security/rbac";
import { z } from "zod";

const service = new CustomersService();
export const customersRouter = Router();

const searchSchema = z.object({ q: z.string().optional(), active: z.coerce.boolean().optional() });

customersRouter.post("/", allowRoles("ADMIN"), withZod(createCustomerSchema), async (req, res) => {
  const created = await service.create(req.body);
  res.status(201).json(created);
});

customersRouter.get("/", async (req, res) => {
  const q = searchSchema.parse(req.query);
  const list = await service.list(q);
  res.json(list);
});

customersRouter.get("/:id", async (req, res) => {
  const c = await service.get(req.params.id);
  res.json(c);
});

customersRouter.patch("/:id", allowRoles("ADMIN"), withZod(updateCustomerSchema), async (req, res) => {
  const up = await service.update(req.params.id, req.body);
  res.json(up);
});
