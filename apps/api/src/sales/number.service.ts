import { prisma } from "../prisma/client";

export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function nextSaleNumber(tenantId: string, tx?: TxClient): Promise<number> {
  if (!tx) {
    return prisma.$transaction((trx) => nextSaleNumber(tenantId, trx));
  }

  const row = await tx.saleCounter.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, next: 1 }
  });

  const current = row.next;

  await tx.saleCounter.update({
    where: { tenantId },
    data: { next: { increment: 1 } }
  });

  return current;
}
