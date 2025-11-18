import PdfPrinter from "pdfmake";
import type { Content, TableCell, TDocumentDefinitions, TFontDictionary } from "pdfmake/interfaces";

const baseFonts: TFontDictionary = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

export type StatementPdfItem = {
  createdAt: Date | string;
  type: string;
  description?: string | null;
  amount: number;
};

export type StatementPdfPayload = {
  customerName: string;
  items: StatementPdfItem[];
  balance: number;
  period?: string;
};

export class StatementPdfService {
  private printer = new PdfPrinter(baseFonts);

  buildDoc(data: StatementPdfPayload) {
    const rows: TableCell[][] = [
      [
        { text: "Data", bold: true },
        { text: "Tipo", bold: true },
        { text: "Descrição", bold: true },
        { text: "Valor", bold: true },
      ],
      ...data.items.map<TableCell[]>((item) => [
        new Date(item.createdAt).toLocaleString(),
        item.type,
        item.description ?? "",
        { text: (item.type === "CHARGE" ? "+" : "-") + item.amount.toFixed(2), alignment: "right" },
      ]),
    ];

    const sections: Content[] = [
      { text: "Extrato de Cliente", style: "h1" },
      { text: data.customerName, margin: [0, 0, 0, 10] },
    ];

    if (data.period) {
      sections.push({ text: data.period, margin: [0, 0, 0, 10] });
    }

    sections.push(
      { table: { headerRows: 1, widths: ["*", "auto", "*", "auto"], body: rows } },
      { text: `Saldo: R$ ${data.balance.toFixed(2)}`, alignment: "right", margin: [0, 10, 0, 0] },
    );

    const dd: TDocumentDefinitions = {
      content: sections,
      styles: { h1: { fontSize: 16, bold: true } },
      defaultStyle: { fontSize: 10, font: "Helvetica" },
    };
    return dd;
  }

  toBuffer(definition: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const pdfDoc = this.printer.createPdfKitDocument(definition);
      const chunks: Buffer[] = [];
      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", reject);
      pdfDoc.end();
    });
  }
}
