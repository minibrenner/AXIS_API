// apps/api/src/fiscal/adapter.ts — abstração fiscal (stub)
import type { Sale } from "@prisma/client";

export interface FiscalAdapter {
  emitir(sale: Sale): Promise<{ chave: string }>;
  cancelar(chave: string, motivo: string): Promise<void>;
}

export class NoneAdapter implements FiscalAdapter {
  async emitir(sale: Sale) {
    return { chave: `NONE-${sale.id}` };
  }

  async cancelar(chave: string, motivo: string) {
    void chave;
    void motivo;
  }
}

const sharedNoneAdapter = new NoneAdapter();

export function getFiscalAdapter(mode: string): FiscalAdapter {
  const normalized = mode?.toLowerCase();

  switch (normalized) {
    case "sat":
    case "nfce":
    case "nfe":
    case "none":
    default:
      return sharedNoneAdapter;
  }
}
