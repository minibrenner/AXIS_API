"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatementPdfService = void 0;
const pdfmake_1 = __importDefault(require("pdfmake"));
const baseFonts = {
    Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
    },
};
class StatementPdfService {
    printer = new pdfmake_1.default(baseFonts);
    buildDoc(data) {
        const rows = [
            [
                { text: "Data", bold: true },
                { text: "Tipo", bold: true },
                { text: "Descrição", bold: true },
                { text: "Valor", bold: true },
            ],
            ...data.items.map((item) => [
                new Date(item.createdAt).toLocaleString(),
                item.type,
                item.description ?? "",
                { text: (item.type === "CHARGE" ? "+" : "-") + item.amount.toFixed(2), alignment: "right" },
            ]),
        ];
        const sections = [
            { text: "Extrato de Cliente", style: "h1" },
            { text: data.customerName, margin: [0, 0, 0, 10] },
        ];
        if (data.period) {
            sections.push({ text: data.period, margin: [0, 0, 0, 10] });
        }
        sections.push({ table: { headerRows: 1, widths: ["*", "auto", "*", "auto"], body: rows } }, { text: `Saldo: R$ ${data.balance.toFixed(2)}`, alignment: "right", margin: [0, 10, 0, 0] });
        const dd = {
            content: sections,
            styles: { h1: { fontSize: 16, bold: true } },
            defaultStyle: { fontSize: 10, font: "Helvetica" },
        };
        return dd;
    }
    toBuffer(definition) {
        return new Promise((resolve, reject) => {
            const pdfDoc = this.printer.createPdfKitDocument(definition);
            const chunks = [];
            pdfDoc.on("data", (chunk) => chunks.push(chunk));
            pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
            pdfDoc.on("error", reject);
            pdfDoc.end();
        });
    }
}
exports.StatementPdfService = StatementPdfService;
//# sourceMappingURL=statement.pdf.service.js.map