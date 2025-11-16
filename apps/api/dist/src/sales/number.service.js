"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextSaleNumber = nextSaleNumber;
const client_1 = require("../prisma/client");
async function nextSaleNumber(tenantId, tx) {
    if (!tx) {
        return client_1.prisma.$transaction((trx) => nextSaleNumber(tenantId, trx));
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
//# sourceMappingURL=number.service.js.map