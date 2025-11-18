import { Router } from "express";
import { StatementPdfService } from "./statement.pdf.service";
import { LedgerService } from "./ledger.service";

export const statementPdfRouter = Router();
const pdf = new StatementPdfService();
const ledger = new LedgerService();

statementPdfRouter.get("/:id/ledger/statement.pdf", async (req, res) => {
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
