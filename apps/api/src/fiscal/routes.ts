import { Router } from "express";
import { z } from "zod";
import { FiscalStatus } from "@prisma/client";
import { allowRoles } from "../security/rbac";
import { listFiscalDocuments, retryFiscalDocuments } from "./service";
import { TenantContext } from "../tenancy/tenant.context";

const listQuerySchema = z.object({
  status: z.nativeEnum(FiscalStatus).optional(),
});

const resendSchema = z.object({
  saleIds: z.array(z.string()).min(1),
});

export const fiscalRouter = Router();

fiscalRouter.get("/documents", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const tenantId = req.user!.tenantId;
  const items = await TenantContext.run(tenantId, () =>
    listFiscalDocuments(tenantId, query.status),
  );
  res.json({ items });
});

fiscalRouter.post("/documents/resend", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const body = resendSchema.parse(req.body);
  const tenantId = req.user!.tenantId;
  const result = await TenantContext.run(tenantId, () =>
    retryFiscalDocuments(tenantId, body.saleIds),
  );
  res.json({ items: result });
});

export default fiscalRouter;
