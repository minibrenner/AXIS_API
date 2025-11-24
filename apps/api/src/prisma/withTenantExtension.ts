import { Prisma } from "@prisma/client";
import { TenantContext } from "../tenancy/tenant.context";
import { ErrorCodes, HttpError } from "../utils/httpErrors";

/**
 * Lista dos modelos que precisam ser isolados por tenant.
 * Caso um modelo nao esteja aqui, ele sera ignorado pelo middleware.
 */
const DIRECT_TENANT_MODELS = new Set([
  "User",
  "Session",
  "AuditLog",
  "Supplier",
  "Product",
  "Category",
  "StockLocation",
  "Inventory",
  "StockMovement",
  "CashSession",
  "CashWithdrawal",
  "Sale",
  "ProcessedSale",
  "PrintJob",
  "FiscalDocument",
  "SaleCounter",
]);

const RELATIONAL_TENANT_MODELS: Record<string, { relation: string }> = {
  Payment: { relation: "sale" },
  SaleItem: { relation: "sale" },
};

/**
 * Garante que o valor recebido seja um objeto simples (record) antes de acessar suas chaves.
 */
const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Garante que exista um objeto dentro de `args` para uma chave especifica (`where` ou `data`).
 * Se a chave ainda nao existir, ela e criada na hora.
 */
const getOrCreateNestedRecord = (
  root: Record<string, unknown>,
  key: "where" | "data" | "create" | "update"
): Record<string, unknown> => {
  const existing = root[key];

  if (isPlainRecord(existing)) {
    return existing;
  }

  const nested: Record<string, unknown> = {};
  root[key] = nested;
  return nested;
};

const getOrCreateRelationRecord = (root: Record<string, unknown>, relation: string) => {
  const existing = root[relation];
  if (isPlainRecord(existing)) {
    return existing;
  }
  const nested: Record<string, unknown> = {};
  root[relation] = nested;
  return nested;
};

/**
 * Identifica todas as operacoes de leitura que devem ser filtradas por tenant.
 */
const isReadAction = (operation: string): boolean =>
  operation.startsWith("find") || operation === "count" || operation === "aggregate" || operation === "groupBy";

/**
 * Operacoes de escrita que trabalham com um unico registro e exigem `tenantId` dentro de `data`.
 */
const isSingleWriteAction = (operation: string): boolean =>
  operation === "create" || operation === "update" || operation === "upsert";

/**
 * Operacoes que atualizam ou removem varios registros ao mesmo tempo.
 * Elas tambem precisam ser filtradas para nao afetar dados de outro tenant.
 */
const isBulkWriteAction = (operation: string): boolean =>
  operation === "updateMany" || operation === "deleteMany";

/**
 * Extension multi-tenant do Prisma.
 * 1. Recupera o tenant atual via `TenantContext.get()`.
 * 2. Se o modelo estiver em `DIRECT_TENANT_MODELS`, injeta `tenantId` em `args.where`
 *    de qualquer operacao de leitura ou escrita em massa (find*, count, aggregate, groupBy, updateMany, deleteMany).
 * 3. Em operacoes de escrita simples (create, update, upsert) garante que `args.data.tenantId`
 *    esteja preenchido.
 * 4. Chama `query(args)` envolto em um try/catch para padronizar mensagens de erro inesperadas.
 */
export const withTenantExtension = () =>
  Prisma.defineExtension({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model) {
            throw new Error("Falha na resposta com o servidor");
          }

          const forwardSafely = async (finalArgs: unknown): Promise<unknown> => query(finalArgs as never);

          const relationScope = RELATIONAL_TENANT_MODELS[model];
          const hasDirectTenant = DIRECT_TENANT_MODELS.has(model);

          if (!hasDirectTenant && !relationScope) {
            return forwardSafely(args);
          }

          const tenantId = TenantContext.get();

          if (!tenantId) {
            throw new HttpError({
              status: 500,
              code: ErrorCodes.TENANT_NOT_RESOLVED,
              message:
                "Erro interno ao identificar a loja desta requisicao. Tente novamente ou faca login de novo.",
              details: { reason: "TENANT_CONTEXT_MISSING", model, operation },
            });
          }

          let nextArgs: unknown = args;

          const ensureArgsRecord = (): Record<string, unknown> => {
            if (isPlainRecord(nextArgs)) {
              return nextArgs;
            }

            const created: Record<string, unknown> = {};
            nextArgs = created;
            return created;
          };

          const addTenantToWhere = () => {
            const root = ensureArgsRecord();
            const where = getOrCreateNestedRecord(root, "where");

            if (hasDirectTenant) {
              if (where.tenantId !== tenantId) {
                where.tenantId = tenantId;
              }
              return;
            }

            if (relationScope) {
              const relationWhere = getOrCreateRelationRecord(where, relationScope.relation);
              if (relationWhere.tenantId !== tenantId) {
                relationWhere.tenantId = tenantId;
              }
            }
          };

          if (isReadAction(operation)) {
            addTenantToWhere();
          }

          if (isSingleWriteAction(operation) && hasDirectTenant) {
            const root = ensureArgsRecord();

            if (operation === "upsert") {
              const createData = getOrCreateNestedRecord(root, "create");
              if (createData.tenantId === undefined) {
                createData.tenantId = tenantId;
              }

              const updateData = getOrCreateNestedRecord(root, "update");
              if (updateData.tenantId === undefined) {
                updateData.tenantId = tenantId;
              }
            } else {
              const data = getOrCreateNestedRecord(root, "data");
              if (data.tenantId === undefined) {
                data.tenantId = tenantId;
              }
            }
          }

          if (isBulkWriteAction(operation)) {
            addTenantToWhere();
          }

          return forwardSafely(nextArgs);
        },
      },
    },
  });
