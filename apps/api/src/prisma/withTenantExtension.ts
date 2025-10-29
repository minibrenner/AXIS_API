import { Prisma } from "@prisma/client";
import { TenantContext } from "../tenancy/tenant.context";

/**
 * Lista dos modelos que precisam ser isolados por tenant.
 * Caso um modelo nao esteja aqui, ele sera ignorado pelo middleware.
 */
const TENANT_SCOPED_MODELS = new Set(["User", "Session", "AuditLog", "Supplier", "Product"]);

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
  key: "where" | "data"
): Record<string, unknown> => {
  const existing = root[key];

  if (isPlainRecord(existing)) {
    return existing;
  }

  const nested: Record<string, unknown> = {};
  root[key] = nested;
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
 * 2. Se o modelo estiver em `TENANT_SCOPED_MODELS`, injeta `tenantId` em `args.where`
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

          const forwardSafely = async (finalArgs: unknown): Promise<unknown> => {
            try {
              return await query(finalArgs as never);
            } catch {
              throw new Error("Falha na resposta com o servidor");
            }
          };

          if (!TENANT_SCOPED_MODELS.has(model)) {
            return forwardSafely(args);
          }

          const tenantId = TenantContext.get();

          if (!tenantId) {
            throw new Error("Tenant solicitado ainda nao existe");
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

            if (where.tenantId !== tenantId) {
              where.tenantId = tenantId;
            }
          };

          if (isReadAction(operation)) {
            addTenantToWhere();
          }

          if (isSingleWriteAction(operation)) {
            const root = ensureArgsRecord();
            const data = getOrCreateNestedRecord(root, "data");

            if (data.tenantId === undefined) {
              data.tenantId = tenantId;
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
