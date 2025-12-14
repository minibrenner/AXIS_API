# IMPRESSAO

Guia rapido de como funciona e como configurar impressoras por praca/caixa no AXIS.

## Visao geral
- Jobs de impressao ficam em PrintJob (persistente, com status PENDING/SENDING/DONE/FAILED, retries, erro).
- Pracas (PrinterLocation) sao livres (ex.: Bar, Cozinha, Caixa 1, Caixa 2). Uma pode ser marcada como padrao de recibo (isReceiptDefault).
- Impressoras (PrinterDevice) sao vinculadas a uma praca e podem ter workstationId (identificador da maquina/caixa, ex.: caixa1-asus). Pode-se ter varias impressoras por praca.
- Produtos tem printerLocationId para roteamento de pedidos por praca.
- Vendas/Comandas tem receiptPrinterLocationId opcional para definir onde imprimir recibo/nota.
- Tipos de job: ORDER_TICKET (pedido por praca), SALE_RECEIPT (cupom), CASH_CLOSING, TEST_PRINT.

## Modelo (Prisma)
- PrinterLocation: name, isReceiptDefault, relaciona com produtos, vendas, comandas e jobs.
- PrinterDevice: type (NETWORK/USB/WINDOWS), interface (TCP/USB/WINDOWS_DRIVER), host/port, locationId, isActive, lastSeenAt, workstationId (identifica a maquina/caixa).
- Product: printerLocationId para direcionar pedidos.
- Sale e Comanda: receiptPrinterLocationId para direcionar recibo/nota.
- PrintJob: inclui locationId, printerDeviceId, idempotencyKey, retries, errorMessage.

## Como configurar na loja
1) Criar pracas: Bar, Cozinha, Caixa 1, Caixa 2 etc. (marque uma como padrao de recibo se quiser).
2) Cadastrar impressoras: host/port (ou USB/Windows), vincular a praca; opcional workstationId (ex.: caixa1-asus).
3) Produtos: escolher a praca de impressao (printerLocationId). Ex.: Batata -> Cozinha; Coca -> Bar.
4) Worker local: rodar na maquina onde a(s) impressora(s) estao. Configurar API_URL, TENANT_ID, token, e opcional WORKSTATION_ID para filtrar jobs destinados aquela maquina. Enviar ESC/POS para impressora termica.
5) Teste: usar endpoint/botao de "Imprimir teste" para cada impressora/praca.
6) Operacao: pedidos geram ORDER_TICKET por praca; vendas geram SALE_RECEIPT na praca/estacao de recibo; fechamento de caixa gera CASH_CLOSING.
7) Fila de impressao: monitorar PENDING/FAILED; reimprimir ou redirecionar se falhar.

## Roteamento por estacao/caixa
- Use workstationId no PrinterDevice para amarrar uma impressora a um caixa especifico (ex.: Caixa 1 Asus -> IP A; Caixa 2 Samsung -> IP B).
- No front/caixa, ao enfileirar recibo, envie o workstationId (ou printerDeviceId explicito). O servico pode resolver:
  1) printerDeviceId explicito (se enviado),
  2) senao, encontrar PrinterDevice ativo com o workstationId informado,
  3) senao, usar a praca padrao de recibo.
- O worker pode rodar com WORKSTATION_ID para buscar apenas jobs destinados aquela maquina/impressora.
- Opcional: em ambiente local, o worker pode autenticar via header x-print-token (valor PRINTING_WORKER_TOKEN do .env) + x-tenant-id, sem JWT. Caso nao use token, segue o JWT normal.

## Endpoints (ja implementados)
- /printing/locations: CRUD de pracas (marcar padrao de recibo).
- /printing/devices: CRUD de impressoras; teste de impressao; ativar/desativar; workstationId opcional.
- /printing/jobs: listar (filtros status/type/locationId/device/workstation/limit), atualizar status (SENDING/DONE/FAILED, erro, device usado), reimprimir (/jobs/reprint/:id), teste (/devices/:id/test).

## Helpers e em que fluxo chamar
- enqueueOrderTicketPrintJobs: agrupa itens por printerLocationId (produto) e cria ORDER_TICKET. Chamado apos registrar itens da comanda (POST /comandas/:id/items).
- enqueueSaleReceiptPrintJob: cria SALE_RECEIPT usando receiptPrinterLocationId da venda ou a praca padrao; resolve impressora por printerDeviceId ou workstationId. Chamado apos criar a venda/recibo.
- enqueueCashClosingPrintJob: cria CASH_CLOSING usando a praca padrao (ou informada) e pode direcionar por printerDeviceId ou workstationId. Chamado ao fechar o caixa.
- enqueueTestPrint: cria job TEST_PRINT para validar a impressora/praca (POST /printing/devices/:id/test).

## Boas praticas de confiabilidade
- Jobs persistidos com retries e erro legivel.
- Idempotencia em jobs criticos (usar idempotencyKey).
- Worker com timeout e fallback de impressora (se uma falhar, tentar outra da mesma praca).
- Fila exibindo PENDING/FAILED para reprocessar manualmente.
