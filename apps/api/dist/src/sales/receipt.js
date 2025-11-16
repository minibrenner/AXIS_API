"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReceipt = buildReceipt;
const client_1 = require("../prisma/client");
const httpErrors_1 = require("../utils/httpErrors");
const LINE = "-".repeat(32);
const formatCurrency = (value) => (value / 100).toFixed(2);
async function buildReceipt(tenantId, saleId) {
    const sale = await client_1.prisma.sale.findFirst({
        where: { id: saleId, tenantId },
        include: { items: true, payments: true },
    });
    if (!sale) {
        throw new httpErrors_1.BadRequest("Venda n\u00e3o encontrada.");
    }
    const tenant = await client_1.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, cnpj: true },
    });
    const tenantName = tenant?.name ?? "Minha Loja";
    const tenantCnpj = tenant?.cnpj ?? undefined;
    const lines = [];
    lines.push(tenantName.toUpperCase());
    if (tenantCnpj) {
        lines.push(`CNPJ: ${tenantCnpj}`);
    }
    lines.push(LINE);
    sale.items.forEach((item) => {
        const qty = Number(item.qty);
        const unit = formatCurrency(item.unitPriceCents);
        const total = formatCurrency(item.totalCents);
        lines.push(`${qty}x ${item.name}`);
        lines.push(`@ R$ ${unit} = R$ ${total}`);
        if (item.discountCents > 0) {
            lines.push(`  Desc.: R$ ${formatCurrency(item.discountCents)}`);
        }
    });
    lines.push(LINE);
    lines.push(`Subtotal: R$ ${formatCurrency(sale.subtotalCents)}`);
    lines.push(`Desconto: R$ ${formatCurrency(sale.discountCents)}`);
    lines.push(`Total:    R$ ${formatCurrency(sale.totalCents)}`);
    lines.push(LINE);
    sale.payments.forEach((payment) => {
        lines.push(`${payment.method.toUpperCase()}: R$ ${formatCurrency(payment.amountCents)}`);
    });
    lines.push(`Troco:    R$ ${formatCurrency(sale.changeCents)}`);
    if (sale.fiscalKey) {
        lines.push(`Chave: ${sale.fiscalKey}`);
    }
    lines.push(LINE);
    lines.push(`Venda #${sale.number} - ${sale.createdAt.toLocaleString("pt-BR")}`);
    const receiptText = lines.join("\n");
    const escposPayload = `${receiptText}\n\n\u001dV\0`;
    const escposBase64 = Buffer.from(escposPayload, "utf8").toString("base64");
    return {
        saleId: sale.id,
        tenant: { name: tenantName, cnpj: tenantCnpj },
        items: sale.items.map((item) => ({
            id: item.id,
            name: item.name,
            qty: Number(item.qty),
            unitPriceCents: item.unitPriceCents,
            totalCents: item.totalCents,
            discountCents: item.discountCents,
        })),
        payments: sale.payments.map((payment) => ({
            id: payment.id,
            method: payment.method,
            amountCents: payment.amountCents,
            providerId: payment.providerId,
        })),
        subtotalCents: sale.subtotalCents,
        discountCents: sale.discountCents,
        totalCents: sale.totalCents,
        changeCents: sale.changeCents,
        fiscalKey: sale.fiscalKey ?? undefined,
        createdAt: sale.createdAt,
        receiptText,
        escposBase64,
    };
}
//# sourceMappingURL=receipt.js.map