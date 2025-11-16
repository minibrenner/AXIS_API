"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSale = createSale;
exports.getSale = getSale;
exports.cancelSale = cancelSale;
const client_1 = require("@prisma/client");
const httpErrors_1 = require("../utils/httpErrors");
const client_2 = require("../prisma/client");
const dto_1 = require("./dto");
const number_service_1 = require("./number.service");
const service_1 = require("../stock/service");
const adapter_1 = require("../fiscal/adapter");
const service_2 = require("../fiscal/service");
const supervisorAuth_1 = require("../security/supervisorAuth");
const ZERO_DISCOUNT = { amount: 0, mode: client_1.DiscountMode.NONE };
function computeLineTotal(qty, unitPriceCents) {
    return Math.round(qty * unitPriceCents);
}
function resolveDiscount(baseCents, discount, context) {
    if (!discount) {
        return ZERO_DISCOUNT;
    }
    if (baseCents <= 0) {
        throw new httpErrors_1.BadRequest(`${context}: valor base inv\u00e1lido.`);
    }
    if (discount.type === "value") {
        if (discount.valueCents >= baseCents) {
            throw new httpErrors_1.BadRequest(`${context}: desconto n\u00e3o pode ser igual ou maior que o valor.`);
        }
        return { amount: discount.valueCents, mode: client_1.DiscountMode.VALUE };
    }
    const computed = Math.round((baseCents * discount.percent) / 100);
    if (computed <= 0) {
        throw new httpErrors_1.BadRequest(`${context}: percentual informado n\u00e3o gera desconto v\u00e1lido.`);
    }
    if (computed >= baseCents) {
        throw new httpErrors_1.BadRequest(`${context}: percentual n\u00e3o pode atingir 100%.`);
    }
    return { amount: computed, mode: client_1.DiscountMode.PERCENT };
}
function normalizeItems(items) {
    return items.map((item) => {
        const baseTotal = computeLineTotal(item.qty, item.unitPriceCents);
        if (baseTotal <= 0) {
            throw new httpErrors_1.BadRequest(`Item "${item.name}" possui valor inv\u00e1lido.`);
        }
        const discountInfo = resolveDiscount(baseTotal, item.discount, `Item "${item.name}"`);
        const netTotal = baseTotal - discountInfo.amount;
        if (netTotal <= 0) {
            throw new httpErrors_1.BadRequest(`Item "${item.name}": desconto n\u00e3o pode zerar o valor.`);
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
async function createSale(options) {
    const parsed = dto_1.saleSchema.safeParse(options.body);
    if (!parsed.success) {
        throw new httpErrors_1.BadRequest({
            message: "Dados da venda inv\u00e1lidos",
            details: parsed.error.flatten(),
        });
    }
    const { items, payments, cashSessionId, locationId, discount, fiscalMode, saleId } = parsed.data;
    if (items.length === 0) {
        throw new httpErrors_1.BadRequest("Venda sem itens.");
    }
    if (payments.length === 0) {
        throw new httpErrors_1.BadRequest("Venda sem pagamentos.");
    }
    const location = await client_2.prisma.stockLocation.findFirst({
        where: { id: locationId, tenantId: options.tenantId },
    });
    if (!location) {
        throw new httpErrors_1.BadRequest("Deposito informado nao foi encontrado.");
    }
    const normalizedItems = normalizeItems(items);
    const subtotal = normalizedItems.reduce((acc, item) => acc + item.netTotal, 0);
    const saleDiscount = resolveDiscount(subtotal, discount, "Desconto da venda");
    const total = subtotal - saleDiscount.amount;
    if (total <= 0) {
        throw new httpErrors_1.BadRequest("Desconto n\u00e3o pode ser igual ao total da venda.");
    }
    const paid = payments.reduce((acc, p) => acc + p.amountCents, 0);
    const change = Math.max(paid - total, 0);
    const attendantNeedsApproval = options.userRole === "ATTENDANT" &&
        (saleDiscount.mode !== client_1.DiscountMode.NONE || normalizedItems.some((item) => item.discountCents > 0));
    if (attendantNeedsApproval) {
        await (0, supervisorAuth_1.requireSupervisorApproval)(options.tenantId, options.supervisorSecret, "Aplicar desconto");
    }
    if (options.idempotencyKey) {
        const dup = await client_2.prisma.auditLog.findFirst({
            where: { tenantId: options.tenantId, hmac: options.idempotencyKey, action: "SALE_CREATE" },
        });
        if (dup) {
            return { duplicate: true };
        }
    }
    const result = await client_2.prisma.$transaction(async (tx) => {
        const cash = await tx.cashSession.findFirst({
            where: { id: cashSessionId, tenantId: options.tenantId, closedAt: null },
        });
        if (!cash) {
            throw new httpErrors_1.BadRequest("Sess\u00e3o de caixa inv\u00e1lida ou j\u00e1 encerrada.");
        }
        const number = await (0, number_service_1.nextSaleNumber)(options.tenantId, tx);
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
        const stockWarnings = [];
        await Promise.all(normalizedItems.map(async (item) => {
            const movement = await (0, service_1.stockOut)({
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
        }));
        let fiscalStatus;
        let fiscalError;
        if (fiscalMode !== "none") {
            const adapter = (0, adapter_1.getFiscalAdapter)(fiscalMode);
            try {
                const { chave } = await adapter.emitir(sale);
                fiscalStatus = client_1.FiscalStatus.SUCCESS;
                await tx.sale.update({ where: { id: sale.id }, data: { fiscalKey: chave } });
                sale.fiscalKey = chave;
                await (0, service_2.trackFiscalAttempt)(tx, {
                    tenantId: options.tenantId,
                    saleId: sale.id,
                    mode: fiscalMode,
                    status: client_1.FiscalStatus.SUCCESS,
                    fiscalKey: chave,
                });
            }
            catch (err) {
                fiscalStatus = client_1.FiscalStatus.FAILED;
                fiscalError = err instanceof Error ? err.message : "Falha ao emitir documento fiscal.";
                await (0, service_2.trackFiscalAttempt)(tx, {
                    tenantId: options.tenantId,
                    saleId: sale.id,
                    mode: fiscalMode,
                    status: client_1.FiscalStatus.FAILED,
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
        await client_2.prisma.auditLog.create({
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
async function getSale(tenantId, id) {
    return client_2.prisma.sale.findFirst({
        where: { id, tenantId },
        include: { items: true, payments: true },
    });
}
async function cancelSale(options) {
    await (0, supervisorAuth_1.requireSupervisorApproval)(options.tenantId, options.approvalSecret, "Cancelamento de venda");
    return client_2.prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findFirst({
            where: { id: options.saleId, tenantId: options.tenantId },
        });
        if (!sale) {
            throw new httpErrors_1.BadRequest("Venda n\u00e3o encontrada.");
        }
        if (sale.status === "CANCELED") {
            return sale;
        }
        const updated = await tx.sale.update({
            where: { id: sale.id },
            data: { status: "CANCELED" },
        });
        if (sale.fiscalKey) {
            const adapter = (0, adapter_1.getFiscalAdapter)(sale.fiscalMode);
            await adapter.cancelar(sale.fiscalKey, options.reason);
        }
        await (0, service_1.cancelSale)({ tenantId: options.tenantId, saleId: sale.id, userId: options.userId });
        return updated;
    });
}
//# sourceMappingURL=sales.service.js.map