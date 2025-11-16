import { Router } from "express";
import { z } from "zod";
import { FiscalStatus } from "@prisma/client";
import { allowRoles } from "../security/rbac";
import { listFiscalDocuments, retryFiscalDocuments } from "./service";

const listQuerySchema = z.object({
  status: z.nativeEnum(FiscalStatus).optional(),
});

const resendSchema = z.object({
  saleIds: z.array(z.string()).min(1),
});

export const fiscalRouter = Router();

fiscalRouter.get("/documents", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const items = await listFiscalDocuments(req.user!.tenantId, query.status);
  res.json({ items });
});

fiscalRouter.post("/documents/resend", allowRoles("ADMIN", "OWNER"), async (req, res) => {
  const body = resendSchema.parse(req.body);
  const result = await retryFiscalDocuments(req.user!.tenantId, body.saleIds);
  res.json({ items: result });
});

export default fiscalRouter;
