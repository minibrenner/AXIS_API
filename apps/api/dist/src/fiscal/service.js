"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackFiscalAttempt = trackFiscalAttempt;
exports.listFiscalDocuments = listFiscalDocuments;
exports.retryFiscalDocuments = retryFiscalDocuments;
const client_1 = require("@prisma/client");
const client_2 = require("../prisma/client");
const httpErrors_1 = require("../utils/httpErrors");
const adapter_1 = require("./adapter");
async function trackFiscalAttempt(tx, params) {
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
async function listFiscalDocuments(tenantId, status) {
    return client_2.prisma.fiscalDocument.findMany({
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
async function retryFiscalDocuments(tenantId, saleIds) {
    if (!saleIds.length) {
        throw new httpErrors_1.BadRequest("Nenhuma venda selecionada para reenviar.");
    }
    const results = [];
    for (const saleId of saleIds) {
        const outcome = await client_2.prisma
            .$transaction(async (tx) => {
            const sale = await tx.sale.findFirst({
                where: { id: saleId, tenantId },
                include: { items: true, payments: true },
            });
            if (!sale) {
                throw new httpErrors_1.BadRequest(`Venda ${saleId} n\u00e3o encontrada no tenant.`);
            }
            if (sale.fiscalMode === "none") {
                throw new httpErrors_1.BadRequest("Venda n\u00e3o requer emiss\u00e3o fiscal.");
            }
            const adapter = (0, adapter_1.getFiscalAdapter)(sale.fiscalMode);
            let status = client_1.FiscalStatus.SUCCESS;
            let error;
            let fiscalKey;
            try {
                const response = await adapter.emitir(sale);
                fiscalKey = response.chave;
                await tx.sale.update({ where: { id: sale.id }, data: { fiscalKey } });
            }
            catch (err) {
                status = client_1.FiscalStatus.FAILED;
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
            return { saleId, status: client_1.FiscalStatus.FAILED, error: message };
        });
        results.push(outcome);
    }
    return results;
}
//# sourceMappingURL=service.js.map