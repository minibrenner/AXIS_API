import { DiscountMode, FiscalStatus, Prisma, Role } from "@prisma/client";
import { BadRequest } from "../utils/httpErrors";
import { prisma } from "../prisma/client";
import { DiscountInput, SaleInput, SaleItemInput, saleSchema } from "./dto";
import { nextSaleNumber } from "./number.service";
import { stockOut, cancelSale as stockCancel } from "../stock/service";
import { getFiscalAdapter } from "../fiscal/adapter";
import { trackFiscalAttempt } from "../fiscal/service";
import { requireSupervisorApproval } from "../security/supervisorAuth";

type SaleWithRelations = Prisma.SaleGetPayload<{ include: { items: true; payments: true } }>;

type CreateSaleOptions = {
  tenantId: string;
  userId: string;
  userRole: Role;
  body: unknown;
  idempotencyKey?: string;
  supervisorSecret?: string;
};

type CancelSaleOptions = {
  tenantId: string;
  userId: string;
  saleId: string;
  reason: string;
  approvalSecret?: string;
};

type ComputedItem = SaleItemInput & {
  baseTotal: number;
  netTotal: number;
  discountCents: number;
  discountMode: DiscountMode;
};

type CreateSaleResult = {
  sale: SaleWithRelations;
  fiscalStatus?: FiscalStatus;
  fiscalError?: string;
  stockWarnings?: Array<{ productId: string; locationId: string; balance: string }>;
};

export type CreateSaleResponse = CreateSaleResult | { duplicate: true };

const ZERO_DISCOUNT = { amount: 0, mode: DiscountMode.NONE } as const;

function computeLineTotal(qty: number, unitPriceCents: number): number {
  return Math.round(qty * unitPriceCents);
}

function resolveDiscount(baseCents: number, discount: DiscountInput | undefined, context: string) {
  if (!discount) {
    return ZERO_DISCOUNT;
  }

  if (baseCents <= 0) {
    throw new BadRequest(`${context}: valor base inv\u00e1lido.`);
  }

  if (discount.type === "value") {
    if (discount.valueCents >= baseCents) {
      throw new BadRequest(`${context}: desconto n\u00e3o pode ser igual ou maior que o valor.`);
    }
    return { amount: discount.valueCents, mode: DiscountMode.VALUE };
  }

  const computed = Math.round((baseCents * discount.percent) / 100);
  if (computed <= 0) {
    throw new BadRequest(`${context}: percentual informado n\u00e3o gera desconto v\u00e1lido.`);
  }
  if (computed >= baseCents) {
    throw new BadRequest(`${context}: percentual n\u00e3o pode atingir 100%.`);
  }
  return { amount: computed, mode: DiscountMode.PERCENT };
}

function normalizeItems(items: SaleItemInput[]): ComputedItem[] {
  return items.map((item) => {
    const baseTotal = computeLineTotal(item.qty, item.unitPriceCents);
    if (baseTotal <= 0) {
      throw new BadRequest(`Item "${item.name}" possui valor inv\u00e1lido.`);
    }

    const discountInfo = resolveDiscount(baseTotal, item.discount, `Item "${item.name}"`);
    const netTotal = baseTotal - discountInfo.amount;
    if (netTotal <= 0) {
      throw new BadRequest(`Item "${item.name}": desconto n\u00e3o pode zerar o valor.`);
    }

    return {
      ...item,
      baseTotal,
      netTotal,
      discountCents: discountInfo.amount,
      discountMode: discountInfo.mode,
    };
  });
}

export async function createSale(options: CreateSaleOptions): Promise<CreateSaleResponse> {
  const parsed = saleSchema.safeParse(options.body);
  if (!parsed.success) {
    throw new BadRequest({
      message: "Dados da venda inv\u00e1lidos",
      details: parsed.error.flatten(),
    });
  }

  const { items, payments, cashSessionId, locationId, discount, fiscalMode, saleId } = parsed.data as SaleInput;

  if (items.length === 0) {
    throw new BadRequest("Venda sem itens.");
  }

  if (payments.length === 0) {
    throw new BadRequest("Venda sem pagamentos.");
  }

  const location = await prisma.stockLocation.findFirst({
    where: { id: locationId, tenantId: options.tenantId },
  });

  if (!location) {
    throw new BadRequest("Deposito informado nao foi encontrado.");
  }

  const normalizedItems = normalizeItems(items);
  const subtotal = normalizedItems.reduce((acc, item) => acc + item.netTotal, 0);
  const saleDiscount = resolveDiscount(subtotal, discount, "Desconto da venda");
  const total = subtotal - saleDiscount.amount;

  if (total <= 0) {
    throw new BadRequest("Desconto n\u00e3o pode ser igual ao total da venda.");
  }

  const paid = payments.reduce((acc, p) => acc + p.amountCents, 0);
  const change = Math.max(paid - total, 0);

  const attendantNeedsApproval =
    options.userRole === "ATTENDANT" &&
    (saleDiscount.mode !== DiscountMode.NONE || normalizedItems.some((item) => item.discountCents > 0));

  if (attendantNeedsApproval) {
    await requireSupervisorApproval(options.tenantId, options.supervisorSecret, "Aplicar desconto");
  }

  if (options.idempotencyKey) {
    const dup = await prisma.auditLog.findFirst({
      where: { tenantId: options.tenantId, hmac: options.idempotencyKey, action: "SALE_CREATE" },
    });

    if (dup) {
      return { duplicate: true };
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const cash = await tx.cashSession.findFirst({
      where: { id: cashSessionId, tenantId: options.tenantId, closedAt: null },
    });

    if (!cash) {
      throw new BadRequest("Sess\u00e3o de caixa inv\u00e1lida ou j\u00e1 encerrada.");
    }

    const number = await nextSaleNumber(options.tenantId, tx);

    const sale = await tx.sale.create({
      data: {
        tenantId: options.tenantId,
        userId: options.userId,
        cashSessionId,
        number,
        status: "FINALIZED",
        subtotalCents: subtotal,
        discountCents: saleDiscount.amount,
        discountMode: saleDiscount.mode,
        totalCents: total,
        changeCents: change,
        fiscalMode,
        items: {
          create: normalizedItems.map((item) => ({
            productId: item.productId,
            sku: item.sku ?? null,
            name: item.name,
            qty: String(item.qty),
            unitPriceCents: item.unitPriceCents,
            totalCents: item.netTotal,
            discountCents: item.discountCents,
            discountMode: item.discountMode,
          })),
        },
        payments: {
          create: payments.map((payment) => ({
            method: payment.method,
            amountCents: payment.amountCents,
            providerId: payment.providerId ?? null,
          })),
        },
      },
      include: { items: true, payments: true },
    });

    const stockWarnings: Array<{ productId: string; locationId: string; balance: string }> = [];

    await Promise.all(
      normalizedItems.map(async (item) => {
        const movement = await stockOut({
          tenantId: options.tenantId,
          userId: options.userId,
          productId: item.productId,
          locationId,
          qty: item.qty,
          reason: "Venda",
          saleId: saleId ?? sale.id,
        });

        if (movement.wentNegative) {
          stockWarnings.push({
            productId: item.productId,
            locationId,
            balance: movement.quantity.toString(),
          });
        }
      })
    );

    let fiscalStatus: FiscalStatus | undefined;
    let fiscalError: string | undefined;

    if (fiscalMode !== "none") {
      const adapter = getFiscalAdapter(fiscalMode);

      try {
        const { chave } = await adapter.emitir(sale);
        fiscalStatus = FiscalStatus.SUCCESS;
        await tx.sale.update({ where: { id: sale.id }, data: { fiscalKey: chave } });
        sale.fiscalKey = chave;
        await trackFiscalAttempt(tx, {
          tenantId: options.tenantId,
          saleId: sale.id,
          mode: fiscalMode,
          status: FiscalStatus.SUCCESS,
          fiscalKey: chave,
        });
      } catch (err) {
        fiscalStatus = FiscalStatus.FAILED;
        fiscalError = err instanceof Error ? err.message : "Falha ao emitir documento fiscal.";
        await trackFiscalAttempt(tx, {
          tenantId: options.tenantId,
          saleId: sale.id,
          mode: fiscalMode,
          status: FiscalStatus.FAILED,
          error: fiscalError,
        });
      }
    }

    return {
      sale,
      fiscalStatus,
      fiscalError,
      stockWarnings: stockWarnings.length ? stockWarnings : undefined,
    };
  });

  if (options.idempotencyKey && "sale" in result) {
    await prisma.auditLog.create({
      data: {
        tenantId: options.tenantId,
        action: "SALE_CREATE",
        entity: "Sale",
        entityId: result.sale.id,
        hmac: options.idempotencyKey,
      },
    });
  }

  return result;
}

export async function getSale(tenantId: string, id: string) {
  return prisma.sale.findFirst({
    where: { id, tenantId },
    include: { items: true, payments: true },
  });
}

export async function cancelSale(options: CancelSaleOptions) {
  await requireSupervisorApproval(options.tenantId, options.approvalSecret, "Cancelamento de venda");

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: options.saleId, tenantId: options.tenantId },
    });

    if (!sale) {
      throw new BadRequest("Venda n\u00e3o encontrada.");
    }

    if (sale.status === "CANCELED") {
      return sale;
    }

    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: { status: "CANCELED" },
    });

    if (sale.fiscalKey) {
      const adapter = getFiscalAdapter(sale.fiscalMode);
      await adapter.cancelar(sale.fiscalKey, options.reason);
    }

    await stockCancel({ tenantId: options.tenantId, saleId: sale.id, userId: options.userId });

    return updated;
  });
}
