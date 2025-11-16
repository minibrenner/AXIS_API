"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTenantExtension = void 0;
const client_1 = require("@prisma/client");
const tenant_context_1 = require("../tenancy/tenant.context");
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
const RELATIONAL_TENANT_MODELS = {
    Payment: { relation: "sale" },
    SaleItem: { relation: "sale" },
};
/**
 * Garante que o valor recebido seja um objeto simples (record) antes de acessar suas chaves.
 */
const isPlainRecord = (value) => typeof value === "object" && value !== null;
/**
 * Garante que exista um objeto dentro de `args` para uma chave especifica (`where` ou `data`).
 * Se a chave ainda nao existir, ela e criada na hora.
 */
const getOrCreateNestedRecord = (root, key) => {
    const existing = root[key];
    if (isPlainRecord(existing)) {
        return existing;
    }
    const nested = {};
    root[key] = nested;
    return nested;
};
const getOrCreateRelationRecord = (root, relation) => {
    const existing = root[relation];
    if (isPlainRecord(existing)) {
        return existing;
    }
    const nested = {};
    root[relation] = nested;
    return nested;
};
/**
 * Identifica todas as operacoes de leitura que devem ser filtradas por tenant.
 */
const isReadAction = (operation) => operation.startsWith("find") || operation === "count" || operation === "aggregate" || operation === "groupBy";
/**
 * Operacoes de escrita que trabalham com um unico registro e exigem `tenantId` dentro de `data`.
 */
const isSingleWriteAction = (operation) => operation === "create" || operation === "update" || operation === "upsert";
/**
 * Operacoes que atualizam ou removem varios registros ao mesmo tempo.
 * Elas tambem precisam ser filtradas para nao afetar dados de outro tenant.
 */
const isBulkWriteAction = (operation) => operation === "updateMany" || operation === "deleteMany";
/**
 * Extension multi-tenant do Prisma.
 * 1. Recupera o tenant atual via `TenantContext.get()`.
 * 2. Se o modelo estiver em `DIRECT_TENANT_MODELS`, injeta `tenantId` em `args.where`
 *    de qualquer operacao de leitura ou escrita em massa (find*, count, aggregate, groupBy, updateMany, deleteMany).
 * 3. Em operacoes de escrita simples (create, update, upsert) garante que `args.data.tenantId`
 *    esteja preenchido.
 * 4. Chama `query(args)` envolto em um try/catch para padronizar mensagens de erro inesperadas.
 */
const withTenantExtension = () => client_1.Prisma.defineExtension({
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                if (!model) {
                    throw new Error("Falha na resposta com o servidor");
                }
                const forwardSafely = async (finalArgs) => {
                    try {
                        return await query(finalArgs);
                    }
                    catch {
                        throw new Error("Falha na resposta com o servidor");
                    }
                };
                const relationScope = RELATIONAL_TENANT_MODELS[model];
                const hasDirectTenant = DIRECT_TENANT_MODELS.has(model);
                if (!hasDirectTenant && !relationScope) {
                    return forwardSafely(args);
                }
                const tenantId = tenant_context_1.TenantContext.get();
                if (!tenantId) {
                    throw new Error("Tenant solicitado ainda nao existe");
                }
                let nextArgs = args;
                const ensureArgsRecord = () => {
                    if (isPlainRecord(nextArgs)) {
                        return nextArgs;
                    }
                    const created = {};
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
exports.withTenantExtension = withTenantExtension;
//# sourceMappingURL=withTenantExtension.js.map