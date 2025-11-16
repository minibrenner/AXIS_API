import { Router } from "express";
import { Prisma, ProcessedSaleStatus } from "@prisma/client";
import { z } from "zod";
import { jwtAuth } from "../auth/middleware";
import { prisma } from "../prisma/client";

const saleSchema = z.object({
  saleId: z.string(), // idempotência
  deviceId: z.string().optional(),
  createdAt: z.coerce.date().optional(),
  items: z.array(z.object({ productId: z.string(), locationId: z.string(), qty: z.coerce.number().positive() })),
});

type ConsolidatedItem = {
  productId: string;
  locationId: string;
  qty: Prisma.Decimal;
};

type TxClient = Omit<typeof prisma, "$extends" | "$connect" | "$disconnect" | "$on" | "$transaction">;

export const syncRouter = Router();
syncRouter.use(jwtAuth());

syncRouter.post("/sale", async (req, res) => {
  const { saleId, items, deviceId, createdAt } = saleSchema.parse(req.body);
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;

  // 1) Idempotência
  try {
    await prisma.processedSale.create({
      data: {
        tenantId,
        saleId,
        deviceId,
        clientCreatedAt: createdAt ?? null,
        status: ProcessedSaleStatus.PENDING
      }
    });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      const existing = await prisma.processedSale.findUnique({
        where: { tenantId_saleId: { tenantId, saleId } },
        select: { status: true }
      });
      return res.json({ ok: true, alreadyProcessed: true, status: existing?.status ?? ProcessedSaleStatus.DONE });
    }
    throw e;
  }

  // 2) Consolidação (igual)
  const consolidated = new Map<string, ConsolidatedItem>();
  for (const it of items) {
    const key = `${it.productId}::${it.locationId}`;
    const q = new Prisma.Decimal(it.qty);
    const prev = consolidated.get(key);
    consolidated.set(key, prev ? { ...prev, qty: prev.qty.plus(q) } : { productId: it.productId, locationId: it.locationId, qty: q });
  }
  const pack = Array.from(consolidated.values());

  // 3) Processa em transação (NÃO bloqueia oversell)
  try {
    const result = await prisma.$transaction(async (tx: TxClient) => {
      // trava linhas
      for (const it of pack) {
        await tx.$executeRawUnsafe(
          `SELECT id FROM "Inventory" WHERE "tenantId"=$1 AND "productId"=$2 AND "locationId"=$3 FOR UPDATE`,
          tenantId, it.productId, it.locationId
        );
      }

      // saldos atuais
      const invRows = await tx.inventory.findMany({
        where: {
          tenantId,
          OR: pack.map(p => ({ productId: p.productId, locationId: p.locationId }))
        },
        select: { id: true, productId: true, locationId: true, quantity: true }
      });

      // aplica updates SEM impedir negativo
      const deficits: Array<{
        productId: string;
        locationId: string;
        beforeQty: string;
        soldQty: string;
        afterQty: string;
      }> = [];

      for (const it of pack) {
        const inv = invRows.find(r => r.productId === it.productId && r.locationId === it.locationId);
        if (!inv) {
          // se não existir, pode optar por criar o inventário com 0 antes de debitar
          // ou considerar erro. Aqui vou criar para permitir a venda.
          const created = await tx.inventory.create({
            data: { tenantId, productId: it.productId, locationId: it.locationId, quantity: new Prisma.Decimal(0) },
            select: { id: true, quantity: true }
          });
          invRows.push({ id: created.id, productId: it.productId, locationId: it.locationId, quantity: created.quantity });
        }
      }

      for (const it of pack) {
        const inv = invRows.find(r => r.productId === it.productId && r.locationId === it.locationId)!;
        const before = new Prisma.Decimal(inv.quantity);
        const after  = before.minus(it.qty);

        // atualiza saldo (pode ficar negativo)
        await tx.inventory.update({ where: { id: inv.id }, data: { quantity: after } });

        // cria movimento (guarde before/after se tiver colunas)
        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: it.productId,
            locationId: it.locationId,
            type: "OUT",
            quantity: it.qty.toNumber(),      // se DECIMAL na tabela, pode usar toString()
            reason: "PDV",
            refId: saleId,
            createdBy: userId,
            // opcional: se seu modelo tiver estas colunas:
            // beforeQuantity: before.toString(),
            // afterQuantity:  after.toString(),
            // oversell: after.isNegative(),
          }
        });

        // se ficou negativo, registra um déficit para retorno e auditoria
        if (after.isNegative()) {
          deficits.push({
            productId: it.productId,
            locationId: it.locationId,
            beforeQty: before.toString(),
            soldQty: it.qty.toString(),
            afterQty: after.toString(),
          });

          // (opcional) registrar evento de auditoria
          // await tx.inventoryEvent.create({
          //   data: {
          //     tenantId, productId: it.productId, locationId: it.locationId,
          //     kind: "OVERSELL",
          //     beforeQuantity: before.toString(),
          //     changeQuantity: it.qty.toString(),
          //     afterQuantity: after.toString(),
          //     refId: saleId, createdBy: userId
          //   }
          // });
        }
      }

      // marca DONE
      await tx.processedSale.update({
        where: { tenantId_saleId: { tenantId, saleId } },
        data: { status: ProcessedSaleStatus.DONE }
      });

      return { deficits, itemsApplied: pack.length };
    });

    // responde sucesso SEM bloquear venda
    return res.json({ ok: true, alreadyProcessed: false, ...result });

  } catch (err: unknown) {
    // algo realmente inesperado (ex.: deadlock), marca ERROR (idempotência preservada)
    const message = err instanceof Error ? err.message : String(err);
    try {
      await prisma.processedSale.update({
        where: { tenantId_saleId: { tenantId, saleId } },
        data: { status: ProcessedSaleStatus.ERROR, errorMessage: message }
      });
    } catch (updateError) {
      console.error("Failed to mark processedSale as ERROR:", updateError);
    }
    return res.status(500).json({ ok: false, error: message });
  }
});
