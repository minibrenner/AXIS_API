// apps/api/src/prisma/withTenantExtension.ts
import { TenantContext } from "../tenancy/tenant.context";

/**
 * Representa os dados que o Prisma passa ao middleware antes de executar uma operacao.
 * - `model`: nome da tabela/entidade que esta sendo acessada.
 * - `action`: nome da operacao (findMany, create, delete, etc).
 * - `args`: filtros e dados usados na operacao.
 */
export interface PrismaMiddlewareParams {
  model?: string;
  action: string;
  args?: Record<string, unknown>;
}

/**
 * Funcao que o Prisma chama para prosseguir com o request depois que o middleware termina.
 * Recebe os parametros (possivelmente modificados) e retorna a Promise original do Prisma.
 */
export type PrismaMiddlewareNext = (params: PrismaMiddlewareParams) => Promise<unknown>;

/**
 * Assinatura padrao de um middleware do Prisma: ele decide se altera os parametros
 * e entao chama `next` para seguir o fluxo.
 */
export type PrismaMiddleware = (
  params: PrismaMiddlewareParams,
  next: PrismaMiddlewareNext
) => Promise<unknown>;

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
 * Cria `params.args` quando ele estiver indefinido.
 * Trabalhar com esse objeto evita `if` espalhados pelo codigo.
 */
const getOrCreateArgs = (params: PrismaMiddlewareParams): Record<string, unknown> => {
  if (isPlainRecord(params.args)) {
    return params.args;
  }

  const args: Record<string, unknown> = {};
  params.args = args;
  return args;
};

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
const isReadAction = (action: string): boolean =>
  action.startsWith("find") || action === "count" || action === "aggregate" || action === "groupBy";

/**
 * Operacoes de escrita que trabalham com um unico registro e exigem `tenantId` dentro de `data`.
 */
const isSingleWriteAction = (action: string): boolean =>
  action === "create" || action === "update" || action === "upsert";

/**
 * Operacoes que atualizam ou removem varios registros ao mesmo tempo.
 * Elas tambem precisam ser filtradas para nao afetar dados de outro tenant.
 */
const isBulkWriteAction = (action: string): boolean =>
  action === "updateMany" || action === "deleteMany";

/**
 * Middleware que adiciona automaticamente o filtro `tenantId` em todas as consultas
 * e grava o `tenantId` em criacoes/atualizacoes. Dessa forma os dados ficam isolados
 * por tenant sem depender de cada parte da aplicacao lembrar de fazer isso manualmente.
 */
export const withTenantExtension = (): PrismaMiddleware => {
  return async (params, next) => {
    // Recupera o tenant atual do contexto de requisicao.
    const tenantId = TenantContext.get();

    // Se o tenant nao esta definido, nao conseguimos continuar a operacao de forma segura.
    if (!tenantId) {
      throw new Error("Tenant solicitado ainda nao existe");
    }

    // Se o Prisma nao informou o modelo, consideramos que houve uma falha interna.
    if (!params.model) {
      throw new Error("Falha na resposta com o servidor");
    }

    /**
     * Encapsula a chamada ao Prisma e padroniza o erro para o caso de falha inesperada.
     * Manter esse handler unico evita duplicacao de try/catch em cada caminho de retorno.
     */
    const forwardSafely = async (): Promise<unknown> => {
      try {
        return await next(params);
      } catch {
        throw new Error("Falha na resposta com o servidor");
      }
    };

    // Se o modelo nao exige isolamento por tenant, apenas seguimos o fluxo padronizado.
    if (!TENANT_SCOPED_MODELS.has(params.model)) {
      return forwardSafely();
    }

    /**
     * Sempre que precisamos filtrar uma consulta, criamos/ajustamos `args.where`
     * para garantir que o Prisma so trabalhe com registros do tenant atual.
     */
    const addTenantToWhere = () => {
      const args = getOrCreateArgs(params);
      const where = getOrCreateNestedRecord(args, "where");

      if (where.tenantId !== tenantId) {
        where.tenantId = tenantId;
      }
    };

    // Toda consulta de leitura precisa ser filtrada pelo tenant.
    if (isReadAction(params.action)) {
      addTenantToWhere();
    }

    // Criacoes/atualizacoes single devem adicionar o tenant ao `data`.
    if (isSingleWriteAction(params.action)) {
      const args = getOrCreateArgs(params);
      const data = getOrCreateNestedRecord(args, "data");

      if (data.tenantId === undefined) {
        data.tenantId = tenantId;
      }
    }

    // Atualizacoes ou delecoes em massa tambem precisam do filtro de tenant.
    if (isBulkWriteAction(params.action)) {
      addTenantToWhere();
    }

    // A operacao `delete` do Prisma nao aceita `where.tenantId`, entao transformamos
    // em `deleteMany` (que aceita) e aplicamos o filtro em seguida.
    if (params.action === "delete") {
      params.action = "deleteMany";
      addTenantToWhere();
    }

    // Continua a execucao original do Prisma com os parametros ajustados.
    return forwardSafely();
  };
};
/**
 * Middleware multi-tenant do Prisma.
 * 1. Recupera o tenant atual via `TenantContext.get()`.
 * 2. Se o modelo estiver em `TENANT_SCOPED_MODELS`, injeta `tenantId` em `args.where`
 *    de qualquer operacao de leitura ou escrita em massa (find*, count, aggregate, groupBy, updateMany, deleteMany).
 * 3. Em operacoes de escrita simples (create, update, upsert) garante que `args.data.tenantId`
 *    esteja preenchido.
 * 4. Converte `delete` em `deleteMany` para poder aplicar o filtro de tenant antes de seguir.
 * 5. Chama `next(params)` para continuar a execucao com os parametros ajustados.
 */
