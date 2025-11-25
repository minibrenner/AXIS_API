import { Router } from "express";
import { withZod } from "../utils/zodMiddleware";
import { createCustomerSchema, updateCustomerSchema } from "./dto";
import { CustomersService } from "./customers.service";
import { allowRoles } from "../security/rbac";
import { z } from "zod";
import { TenantContext } from "../tenancy/tenant.context";

const service = new CustomersService();
export const customersRouter = Router();

const searchSchema = z.object({ q: z.string().optional(), active: z.coerce.boolean().optional() });

customersRouter.post("/", allowRoles("ADMIN"), withZod(createCustomerSchema), async (req, res) => {
  const tenantId = req.user!.tenantId;
  const created = await TenantContext.run(tenantId, () => service.create(req.body));
  res.status(201).json(created);
});

customersRouter.get("/", async (req, res) => {
  const q = searchSchema.parse(req.query);
  const tenantId = req.user!.tenantId;
  const list = await TenantContext.run(tenantId, () => service.list(q));
  res.json(list);
});

customersRouter.get("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const c = await TenantContext.run(tenantId, () => service.get(req.params.id));
  res.json(c);
});

customersRouter.patch("/:id", allowRoles("ADMIN"), withZod(updateCustomerSchema), async (req, res) => {
  const tenantId = req.user!.tenantId;
  const up = await TenantContext.run(tenantId, () => service.update(req.params.id, req.body));
  res.json(up);
});

customersRouter.delete("/:id", allowRoles("ADMIN"), async (req, res) => {
  const tenantId = req.user!.tenantId;
  await TenantContext.run(tenantId, () => service.delete(req.params.id));
  res.status(204).send();
});
