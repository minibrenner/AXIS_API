import { Prisma, PrintJobStatus, PrintJobType } from "@prisma/client";
import { prisma } from "../prisma/client";
import type { CashClosingSnapshot } from "../cash/routes";

type EnqueueCashClosingParams = {
  tenantId: string;
  userId: string;
  cashSessionId: string;
  snapshot: CashClosingSnapshot;
  source?: string;
};

export async function enqueueCashClosingPrintJob(params: EnqueueCashClosingParams) {
  return prisma.printJob.create({
    data: {
      tenantId: params.tenantId,
      type: PrintJobType.CASH_CLOSING,
      status: PrintJobStatus.PENDING,
      payload: params.snapshot as Prisma.JsonObject,
      source: params.source ?? "cash-close",
      requestedById: params.userId,
      cashSessionId: params.cashSessionId,
    },
  });
}
