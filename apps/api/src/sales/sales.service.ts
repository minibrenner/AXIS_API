import { DiscountMode, FiscalStatus, Prisma, Role, PrintJobStatus } from "@prisma/client";
import { BadRequest } from "../utils/httpErrors";
import { prisma } from "../prisma/client";
import { DiscountInput, SaleInput, SaleItemInput, saleSchema } from "./dto";
import { nextSaleNumber } from "./number.service";
import { cancelSale as stockCancel, selectInventoryForSale, stockOut } from "../stock/service";
import { getFiscalAdapter } from "../fiscal/adapter";
import { trackFiscalAttempt } from "../fiscal/service";
import { requireSupervisorApproval } from "../security/supervisorAuth";
import { buildReceipt } from "./receipt";
import { enqueueSaleReceiptPrintJob } from "../printing/service";

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
  stockWarnings?: StockWarning[];
  stockErrors?: StockError[];
  printJobId?: string;
  printJobStatus?: PrintJobStatus;
};

export type CreateSaleResponse = CreateSaleResult | { duplicate: true };

const ZERO_DISCOUNT = { amount: 0, mode: DiscountMode.NONE } as const;

type StockWarning = { productId: string; locationId: string; balance: string };
type StockError = { productId: string; locationId?: string; message: string };

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

async function handleSaleStockMovements({
  tenantId,
  userId,
  items,
  saleId,
  preferredLocationId,
}: {
  tenantId: string;
  userId: string;
  items: ComputedItem[];
  saleId: string;
  preferredLocationId?: string;
}): Promise<{ stockWarnings?: StockWarning[]; stockErrors?: StockError[] }> {
  const stockWarnings: StockWarning[] = [];
  const stockErrors: StockError[] = [];

  for (const item of items) {
    const selection = await selectInventoryForSale(tenantId, item.productId, preferredLocationId);

    if (!selection) {
      stockErrors.push({
        productId: item.productId,
        message: "Nenhum inventario encontrado para debito de venda.",
      });
      continue;
    }

    try {
      const movement = await stockOut({
        tenantId,
        userId,
        productId: item.productId,
        locationId: selection.locationId,
        qty: item.qty,
        reason: "Venda",
        saleId,
      });

      if (movement.wentNegative) {
        stockWarnings.push({
          productId: item.productId,
          locationId: selection.locationId,
          balance: movement.quantity.toString(),
        });
      }
    } catch (err: unknown) {
      stockErrors.push({
        productId: item.productId,
        locationId: selection.locationId,
        message: err instanceof Error ? err.message : "Falha ao debitar estoque.",
      });
    }
  }

  return {
    stockWarnings: stockWarnings.length ? stockWarnings : undefined,
    stockErrors: stockErrors.length ? stockErrors : undefined,
  };
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
  if (paid < total) {
    throw new BadRequest("Valor pago \u00e9 menor que o total da venda.");
  }

  let remaining = total;
  for (const payment of payments) {
    const effectiveRemaining = Math.max(remaining, 0);
    if (payment.method !== "cash" && payment.amountCents > effectiveRemaining) {
      throw new BadRequest("Pagamentos n\u00e3o podem exceder o valor restante (apenas dinheiro pode gerar troco).");
    }
    remaining -= payment.amountCents;
  }

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

  const txResult = await prisma.$transaction(async (tx) => {
    const cash = await tx.cashSession.findFirst({
      where: { id: cashSessionId, tenantId: options.tenantId, closedAt: null },
    });

    if (!cash) {
      throw new BadRequest("Sess\u00e3o de caixa inv\u00e1lida ou j\u00e1 encerrada.");
    }

    if (cash.userId !== options.userId) {
      throw new BadRequest("Caixa pertence a outro operador. Use o seu caixa aberto.");
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
    };
  });

  let stockWarnings: StockWarning[] | undefined;
  let stockErrors: StockError[] | undefined;

  try {
    ({ stockWarnings, stockErrors } = await handleSaleStockMovements({
      tenantId: options.tenantId,
      userId: options.userId,
      items: normalizedItems,
      saleId: saleId ?? txResult.sale.id,
      preferredLocationId: locationId,
    }));
  } catch (err: unknown) {
    stockErrors = [
      {
        productId: "*",
        message: err instanceof Error ? err.message : "Falha inesperada ao debitar estoque.",
      },
    ];
  }

  const result: CreateSaleResult = {
    ...txResult,
    ...(stockWarnings ? { stockWarnings } : {}),
    ...(stockErrors ? { stockErrors } : {}),
  };

  try {
    const receipt = await buildReceipt(options.tenantId, txResult.sale.id);
    const printJob = await enqueueSaleReceiptPrintJob({
      tenantId: options.tenantId,
      userId: options.userId,
      saleId: txResult.sale.id,
      receipt,
      source: "pos-web",
    });
    result.printJobId = printJob.id;
    result.printJobStatus = printJob.status;
  } catch (err) {
    // Impressão não deve quebrar a venda; logar e seguir
    console.error("Falha ao enfileirar recibo de venda:", err);
  }

  if (options.idempotencyKey && "sale" in txResult) {
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
