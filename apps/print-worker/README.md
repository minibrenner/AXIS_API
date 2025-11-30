# Axis Print Worker (Standalone)

Worker simples para puxar jobs de impressão de cupom de venda (`SALE_RECEIPT`) do backend e enviar para a impressora térmica.

## Estrutura
- `src/index.ts`: poller que busca jobs em `/api/printing/jobs` e marca `DONE/FAILED`.
- `src/printer.ts`: envia `escposBase64` via TCP (porta 9100) para a impressora.
- `src/config.ts`: lê variáveis de ambiente.

## Configuração
```bash
cd apps/print-worker
pnpm install   # ou npm install
```

Crie um `.env` (ou exporte as variáveis):
```
AXIS_API_BASE=http://localhost:3000/api
AXIS_PRINT_TOKEN=<Bearer do usuário da loja>
POLL_INTERVAL_MS=3000
PRINT_JOB_TYPE=SALE_RECEIPT
PRINT_JOB_STATUS=PENDING
PRINTER_HOST=192.168.0.50
PRINTER_PORT=9100
```

## Uso
- Desenvolvimento: `pnpm dev` (usa ts-node).
- Produção: `pnpm build && pnpm start` (compila para `dist/` e executa).
- Execute como serviço (systemd/pm2) na máquina com a impressora.

## Fluxo
1. Backend cria `PrintJob` `SALE_RECEIPT` com `payload.escposBase64`.
2. Worker faz polling (`GET /printing/jobs?status=PENDING&type=SALE_RECEIPT&limit=10`).
3. Para cada job:
   - Envia `escposBase64` para a impressora térmica (TCP 9100 por padrão).
   - Marca o job com `PATCH /printing/jobs/:id` para `DONE` ou `FAILED` (com `errorMessage`).
