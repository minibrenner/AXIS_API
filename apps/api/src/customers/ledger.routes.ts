import { Router } from "express";
import { LedgerService } from "./ledger.service";
import { allowRoles } from "../security/rbac";
import { z } from "zod";
import { TenantContext } from "../tenancy/tenant.context";

export const ledgerRouter = Router();
const service = new LedgerService();

const chargeSchema = z.object({
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  saleId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.string().min(2),
  description: z.string().optional(),
});

ledgerRouter.post("/:id/ledger/charge", allowRoles("ADMIN", "ATTENDANT"), async (req, res) => {
  const dto = chargeSchema.parse(req.body);
  const tenantId = req.user!.tenantId;
  const r = await TenantContext.run(tenantId, () =>
    service.charge({
      customerId: req.params.id,
      amount: dto.amount,
      description: dto.description,
      saleId: dto.saleId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      idempotencyKey: req.header("Idempotency-Key") ?? undefined,
      createdBy: req.user!.userId,
    }),
  );
  res.status(201).json(r);
});

ledgerRouter.post("/:id/ledger/payment", allowRoles("ADMIN"), async (req, res) => {
  const dto = paymentSchema.parse(req.body);
  const tenantId = req.user!.tenantId;
  const r = await TenantContext.run(tenantId, () =>
    service.payment({
      customerId: req.params.id,
      amount: dto.amount,
      method: dto.method,
      description: dto.description,
      idempotencyKey: req.header("Idempotency-Key") ?? undefined,
      createdBy: req.user!.userId,
    }),
  );
  res.status(201).json(r);
});

ledgerRouter.get("/:id/ledger/statement", async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const tenantId = req.user!.tenantId;
  const out = await TenantContext.run(tenantId, () =>
    service.statement(req.params.id, from, to),
  );
  res.json(out);
});
