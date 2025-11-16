"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueCashClosingPrintJob = enqueueCashClosingPrintJob;
const client_1 = require("@prisma/client");
const client_2 = require("../prisma/client");
async function enqueueCashClosingPrintJob(params) {
    return client_2.prisma.printJob.create({
        data: {
            tenantId: params.tenantId,
            type: client_1.PrintJobType.CASH_CLOSING,
            status: client_1.PrintJobStatus.PENDING,
            payload: params.snapshot,
            source: params.source ?? "cash-close",
            requestedById: params.userId,
            cashSessionId: params.cashSessionId,
        },
    });
}
//# sourceMappingURL=service.js.map