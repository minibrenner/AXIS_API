import { FiscalStatus, Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { BadRequest } from "../utils/httpErrors";
import { getFiscalAdapter } from "./adapter";
import { TxClient } from "../sales/number.service";

type TrackParams = {
  tenantId: string;
  saleId: string;
  mode: string;
  status: FiscalStatus;
  fiscalKey?: string | null;
  error?: string;
};

export async function trackFiscalAttempt(tx: TxClient, params: TrackParams) {
  const now = new Date();

  await tx.fiscalDocument.upsert({
    where: { saleId: params.saleId },
    update: {
      status: params.status,
      fiscalKey: params.fiscalKey ?? null,
      lastError: params.error,
      lastAttemptAt: now,
      attempts: { increment: 1 },
    },
    create: {
      tenantId: params.tenantId,
      saleId: params.saleId,
      mode: params.mode,
      status: params.status,
      fiscalKey: params.fiscalKey ?? null,
      lastError: params.error,
      lastAttemptAt: now,
      attempts: 1,
    },
  });
}

export async function listFiscalDocuments(tenantId: string, status?: FiscalStatus) {
  return prisma.fiscalDocument.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
    },
    include: {
      sale: {
        select: {
          id: true,
          number: true,
          totalCents: true,
          subtotalCents: true,
          discountCents: true,
          fiscalKey: true,
          createdAt: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export type FiscalRetryResult = {
  saleId: string;
  status: FiscalStatus;
  error?: string;
};

export async function retryFiscalDocuments(tenantId: string, saleIds: string[]): Promise<FiscalRetryResult[]> {
  if (!saleIds.length) {
    throw new BadRequest("Nenhuma venda selecionada para reenviar.");
  }

  const results: FiscalRetryResult[] = [];

  for (const saleId of saleIds) {
    const outcome = await prisma
      .$transaction(async (tx) => {
        const sale = await tx.sale.findFirst({
          where: { id: saleId, tenantId },
          include: { items: true, payments: true },
        });

        if (!sale) {
          throw new BadRequest(`Venda ${saleId} n\u00e3o encontrada no tenant.`);
        }

        if (sale.fiscalMode === "none") {
          throw new BadRequest("Venda n\u00e3o requer emiss\u00e3o fiscal.");
        }

        const adapter = getFiscalAdapter(sale.fiscalMode);
        let status: FiscalStatus = FiscalStatus.SUCCESS;
        let error: string | undefined;
        let fiscalKey: string | undefined;

        try {
          const response = await adapter.emitir(sale as Prisma.SaleGetPayload<{ include: { items: true; payments: true } }>);
          fiscalKey = response.chave;
          await tx.sale.update({ where: { id: sale.id }, data: { fiscalKey } });
        } catch (err) {
          status = FiscalStatus.FAILED;
          error = err instanceof Error ? err.message : "Falha ao reenviar documento fiscal.";
        }

        await trackFiscalAttempt(tx, {
          tenantId,
          saleId: sale.id,
          mode: sale.fiscalMode,
          status,
          fiscalKey,
          error,
        });

        return { saleId: sale.id, status, error };
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Falha desconhecida.";
        return { saleId, status: FiscalStatus.FAILED, error: message };
      });

    results.push(outcome);
  }

  return results;
}
