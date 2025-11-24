import { Router } from "express";
import { z } from "zod";
import { allowRoles } from "../security/rbac";
import { saleSchema } from "./dto";
import { cancelSale, createSale } from "./sales.service";
import { buildReceipt } from "./receipt";
import { TenantContext } from "../tenancy/tenant.context";

const createSaleSchema = z.object({
  sale: saleSchema,
  supervisorSecret: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

const cancelSchema = z.object({
  reason: z.string().min(3).max(280),
  supervisorSecret: z.string().optional(),
});

export const salesRouter = Router();

salesRouter.post("/", allowRoles("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
  const { sale, supervisorSecret, idempotencyKey } = createSaleSchema.parse(req.body);
  const headerSecret = req.header("x-supervisor-secret") ?? undefined;
  const headerIdempotency = req.header("x-idempotency-key") ?? undefined;

  const tenantId = req.user!.tenantId;
  const response = await TenantContext.run(tenantId, () =>
    createSale({
      tenantId,
      userId: req.user!.userId,
      userRole: req.user!.role,
      body: sale,
      supervisorSecret: supervisorSecret ?? headerSecret,
      idempotencyKey: idempotencyKey ?? headerIdempotency,
    }),
  );

  if ("duplicate" in response) {
    return res.status(200).json(response);
  }

  return res.status(201).json(response);
});

salesRouter.post("/:saleId/cancel", allowRoles("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
  const { saleId } = req.params;
  const body = cancelSchema.parse(req.body ?? {});
  const supervisorSecret = body.supervisorSecret ?? req.header("x-supervisor-secret") ?? undefined;

  const tenantId = req.user!.tenantId;
  const sale = await TenantContext.run(tenantId, () =>
    cancelSale({
      tenantId,
      userId: req.user!.userId,
      saleId,
      reason: body.reason,
      approvalSecret: supervisorSecret,
    }),
  );

  return res.json(sale);
});

salesRouter.get("/:saleId/receipt", allowRoles("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
  const tenantId = req.user!.tenantId;
  const payload = await TenantContext.run(tenantId, () =>
    buildReceipt(tenantId, req.params.saleId),
  );
  return res.json(payload);
});

export default salesRouter;
