import { Router } from "express";
import { z } from "zod";
import { PrintJobStatus, PrintJobType } from "@prisma/client";
import { prisma } from "../prisma/client";
import { allowRoles } from "../security/rbac";
import { HttpError } from "../utils/httpErrors";

const listSchema = z.object({
  status: z.nativeEnum(PrintJobStatus).optional(),
  type: z.nativeEnum(PrintJobType).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const updateSchema = z.object({
  status: z.nativeEnum(PrintJobStatus),
  errorMessage: z.string().trim().max(500).optional(),
});

export const printingRouter = Router();

printingRouter.get("/", allowRoles("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
  const { status, type, limit } = listSchema.parse(req.query);
  const tenantId = req.tenantId!;

  const jobs = await prisma.printJob.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  res.json({ jobs });
});

printingRouter.patch("/:jobId", allowRoles("ADMIN", "OWNER", "ATTENDANT"), async (req, res) => {
  const { jobId } = req.params;
  const body = updateSchema.parse(req.body);
  const tenantId = req.tenantId!;

  const existing = await prisma.printJob.findFirst({ where: { id: jobId, tenantId } });
  if (!existing) {
    throw new HttpError({ status: 404, message: "Print job nao encontrado." });
  }

  const updated = await prisma.printJob.update({
    where: { id: jobId },
    data: { status: body.status, lastError: body.errorMessage ?? null },
  });

  res.json(updated);
});
