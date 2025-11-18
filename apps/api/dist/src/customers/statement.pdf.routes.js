"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statementPdfRouter = void 0;
const express_1 = require("express");
const statement_pdf_service_1 = require("./statement.pdf.service");
const ledger_service_1 = require("./ledger.service");
exports.statementPdfRouter = (0, express_1.Router)();
const pdf = new statement_pdf_service_1.StatementPdfService();
const ledger = new ledger_service_1.LedgerService();
exports.statementPdfRouter.get("/:id/ledger/statement.pdf", async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const data = await ledger.statement(req.params.id, from, to);
    const items = data.items.map((item) => ({
        createdAt: item.createdAt,
        type: item.type,
        description: item.description,
        amount: Number(item.amount),
    }));
    const dd = pdf.buildDoc({ customerName: req.params.id, items, balance: data.balance });
    const buf = await pdf.toBuffer(dd);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=extrato.pdf");
    res.send(buf);
});
//# sourceMappingURL=statement.pdf.routes.js.map