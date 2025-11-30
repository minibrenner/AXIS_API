import { Prisma, PrintJobStatus, PrintJobType } from "@prisma/client";
import { prisma } from "../prisma/client";
import type { CashClosingSnapshot } from "../cash/routes";
import type { ReceiptPayload } from "../sales/receipt";

type EnqueueCashClosingParams = {
  tenantId: string;
  userId: string;
  cashSessionId: string;
  snapshot: CashClosingSnapshot;
  source?: string;
};

type EnqueueSaleReceiptParams = {
  tenantId: string;
  userId: string;
  saleId: string;
  receipt: ReceiptPayload;
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

export async function enqueueSaleReceiptPrintJob(params: EnqueueSaleReceiptParams) {
  return prisma.printJob.create({
    data: {
      tenantId: params.tenantId,
      type: PrintJobType.SALE_RECEIPT,
      status: PrintJobStatus.PENDING,
      payload: params.receipt as unknown as Prisma.JsonObject,
      source: params.source ?? "sale-pos",
      requestedById: params.userId,
      saleId: params.saleId,
    },
  });
}
