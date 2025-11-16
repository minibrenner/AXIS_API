import type { FC } from "react";

type SaleReceipt = {
  tenant: {
    name: string;
    cnpj?: string | null;
  };
  items: Array<{
    id: string;
    name: string;
    qty: number;
    unitPriceCents: number;
    totalCents: number;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amountCents: number;
  }>;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  changeCents: number;
  fiscalKey?: string | null;
};

type ReceiptProps = {
  sale: SaleReceipt;
};

const formatCurrency = (value: number) => (value / 100).toFixed(2);

export const Receipt: FC<ReceiptProps> = ({ sale }) => (
  <div style={{ fontFamily: "monospace", width: 280 }}>
    <h3>{sale.tenant.name}</h3>
    {sale.tenant.cnpj && <h4>CNPJ: {sale.tenant.cnpj}</h4>}
    <hr />
    {sale.items.map((item) => (
      <div key={item.id} style={{ marginBottom: 4 }}>
        <div>
          {item.qty}x {item.name}
        </div>
        <div>
          @ R$ {formatCurrency(item.unitPriceCents)} = R$ {formatCurrency(item.totalCents)}
        </div>
      </div>
    ))}
    <hr />
    <div>Subtotal: R$ {formatCurrency(sale.subtotalCents)}</div>
    <div>Desconto: R$ {formatCurrency(sale.discountCents)}</div>
    <strong>Total: R$ {formatCurrency(sale.totalCents)}</strong>
    <hr />
    {sale.payments.map((payment) => (
      <div key={payment.id}>
        {payment.method.toUpperCase()}: R$ {formatCurrency(payment.amountCents)}
      </div>
    ))}
    <div>Troco: R$ {formatCurrency(sale.changeCents)}</div>
    {sale.fiscalKey && <div>Chave: {sale.fiscalKey}</div>}
  </div>
);

export default Receipt;
