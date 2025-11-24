# READMEPADRAO – Padrão de Rotas da AXIS API

Este documento define o **modelo oficial** para criar novas rotas na `apps/api`.  
Use-o como checklist sempre que criar um novo módulo (ex.: `orders`, `suppliers`, etc.).

---

## 1. Conceitos obrigatórios

- **Autenticação & tenant**
  - Toda rota “normal” do painel roda atrás de:
    - `jwtAuth(false)` → valida o `access token` e popula `req.user`.
    - `tenantMiddleware` → resolve o tenant e popula:
      - `req.tenantId`
      - `TenantContext` (usado pela extensão multi-tenant do Prisma).
  - Nunca confiar em `tenantId` vindo do body; sempre usar o do contexto.

- **Camadas**
  - **routes**: arquivos Express (`src/<modulo>/routes.ts` ou `.rotes.ts`).
    - Fazem:
      - parse de query/body (Zod ou `withZod`),
      - aplicação de guards (`allowRoles`),
      - extração de `tenantId` / `userId`,
      - chamada de serviços.
    - Podem usar `TenantContext.run` quando precisarem falar direto com o Prisma.
  - **services**: encapsulam a regra de negócio.
    - Recebem `tenantId` explicitamente ou usam `TenantContext.get()` (quando o módulo for chamado **sempre** de dentro de um `TenantContext.run`).

---

## 2. Registro da rota no router raiz

Arquivo: `apps/api/src/routes/index.ts`

Para um novo módulo (ex.: `ordersRouter`):

```ts
import ordersRouter from "../orders/routes";

const secureRoutes: Array<[string, Router]> = [
  // ...
  ["/orders", ordersRouter],
];

for (const [prefix, childRouter] of secureRoutes) {
  router.use(prefix, jwtAuth(false), tenantMiddleware, childRouter);
}
```

Regra: **não** chame `jwtAuth` nem `tenantMiddleware` dentro do módulo; use sempre esse padrão centralizado.

---

## 3. Modelo de arquivo de rotas

### 3.1 Importações recomendadas

```ts
import { Router } from "express";
import { z } from "zod";
import { allowRoles } from "../security/rbac";
import { withZod } from "../utils/zodMiddleware";
import { TenantContext } from "../tenancy/tenant.context";
import { ErrorCodes, HttpError } from "../utils/httpErrors";
import { listOrders, createOrder } from "./service";
```

### 3.2 Criação do router

```ts
export const ordersRouter = Router();
```

### 3.3 Schemas de validação

Use **Zod** sempre:

```ts
const listQuerySchema = z.object({
  q: z.string().optional(),
});

const createOrderSchema = z.object({
  customerId: z.string(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        qty: z.coerce.number().positive(),
      }),
    )
    .min(1),
});
```

### 3.4 Handlers – padrão geral

#### GET (lista/consulta)

```ts
ordersRouter.get("/", allowRoles("ADMIN", "ATTENDANT"), async (req, res) => {
  const tenantId = req.user!.tenantId;
  const query = listQuerySchema.parse(req.query);

  const items = await TenantContext.run(tenantId, () =>
    listOrders(tenantId, query.q),
  );

  res.json({ items });
});
```

#### POST (criação) com `withZod`

```ts
ordersRouter.post(
  "/",
  allowRoles("ADMIN", "ATTENDANT"),
  withZod(createOrderSchema),
  async (req, res, next) => {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    try {
      const created = await TenantContext.run(tenantId, () =>
        createOrder({
          tenantId,
          userId,
          body: req.body, // já validado pelo withZod
        }),
      );
      res.status(201).json(created);
    } catch (err) {
      next(err); // deixa o errorHandler global formatar a resposta
    }
  },
);
```

Regras importantes:

- Sempre capture `tenantId` e `userId` de `req.user`/`req.tenantId`, **nunca** do body.
- Qualquer acesso ao Prisma fora de serviços deve estar dentro de `TenantContext.run(tenantId, ...)`.
- Use `next(err)` para erros inesperados; erros conhecidos devem ser `HttpError`.

---

## 4. Padrão de uso do TenantContext

### 4.1 Quando usar `TenantContext.run`

- Sempre que:
  - o código chamar `prisma.*` diretamente dentro de rotas, **ou**
  - o serviço chamado usar `TenantContext.get()` internamente (ex.: `CustomersService`, `LedgerService`).

### 4.2 Padrões existentes como referência

- Produtos: `apps/api/src/products/rotes.ts`
- Categorias: `apps/api/src/categories/routes.ts`
- Stock: `apps/api/src/stock/routes.ts`
- Caixa: `apps/api/src/cash/routes.ts`
- Vendas: `apps/api/src/sales/routes.ts`
- Fiscal: `apps/api/src/fiscal/routes.ts`
- Clientes / Ledger / Extrato: diretório `apps/api/src/customers/*`

Sempre siga a mesma ideia:

```ts
const tenantId = req.user!.tenantId;

const result = await TenantContext.run(tenantId, async () => {
  // qualquer acesso prisma.* ou serviço que dependa de TenantContext.get()
});
```

---

## 5. Padrão de validação e erros

### 5.1 `withZod` + erros de validação

- Middleware `withZod` (`apps/api/src/utils/zodMiddleware.ts`) já:
  - chama `schema.safeParse(req.body)`;
  - em caso de erro, responde com:
    - `status: 400`,
    - `code: VALIDATION_ERROR`,
    - `message` amigável,
    - `errors: [{ field, message, code? }]`.

Use `withZod` sempre que possível em `POST`/`PATCH` de formulários.

### 5.2 `HttpError` e códigos

- Nunca jogue `Error` “cru” para erros de domínio; use `HttpError`:

```ts
throw new HttpError({
  status: 404,
  code: ErrorCodes.NOT_FOUND,
  message: "Recurso nao encontrado.",
  details: { resourceId },
});
```

- O error handler global (`apps/api/src/app.ts`) já transforma qualquer `HttpError` em:
  - JSON `{ error: { code, message, details?, errors? } }`
  - logando metadados úteis (método, path, tenantId, userId, stack etc.).

### 5.3 Prisma + erros conhecidos

Quando tratar erros de unicidade ou FK, use `PrismaClientKnownRequestError` e converta para `HttpError`/`ErrorCodes` (ver exemplos em:

- `stock/routes.ts` (P2002/P2003),
- `modules/tenant/controllers/users.controller.ts` (P2002).

---

## 6. Checklist para novas rotas

Antes de abrir PR, confirme:

1. [ ] Rota registrada em `src/routes/index.ts` dentro de `secureRoutes` com `jwtAuth(false)` + `tenantMiddleware`.
2. [ ] Handlers usam `allowRoles` de forma adequada.
3. [ ] Todo body é validado com **Zod** (`withZod` ou `.parse`/`.safeParse`).
4. [ ] Nenhum `tenantId` vem do body; sempre de `req.user` ou `req.tenantId`.
5. [ ] Qualquer acesso a `prisma.*` dentro da rota roda dentro de `TenantContext.run(tenantId, ...)`.
6. [ ] Erros de domínio usam `HttpError` / `ErrorCodes`; nada de `throw new Error("...")` para regras de negócio.
7. [ ] A resposta segue o padrão:
   - sucesso → `res.json(...)` ou `res.status(201).json(...)` / `204` sem body;
   - erro → deixado para o handler global via `next(err)` ou retornado com `respondWithError`.

Seguindo este READMEPADRAO, todas as rotas futuras ficarão coerentes com o restante da AXIS API, com multi-tenant seguro, erros padronizados e comportamento previsível para o front. 

