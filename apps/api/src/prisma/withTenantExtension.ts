// apps/api/src/prisma/withTenantExtension.ts
import { TenantContext } from "../tenancy/tenant.context";

export interface PrismaMiddlewareParams {
  model?: string;
  action: string;
  args?: Record<string, unknown>;
}

export type PrismaMiddlewareNext = (params: PrismaMiddlewareParams) => Promise<unknown>;

export type PrismaMiddleware = (
  params: PrismaMiddlewareParams,
  next: PrismaMiddlewareNext
) => Promise<unknown>;

const MODELS_WITH_TENANT = new Set(["User", "Session", "AuditLog", "Supplier", "Product"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const ensureArgs = (params: PrismaMiddlewareParams): Record<string, unknown> => {
  if (isRecord(params.args)) {
    return params.args;
  }

  const args: Record<string, unknown> = {};
  params.args = args;
  return args;
};

const ensureNestedRecord = (
  root: Record<string, unknown>,
  key: "where" | "data"
): Record<string, unknown> => {
  const existing = root[key];

  if (isRecord(existing)) {
    return existing;
  }

  const nested: Record<string, unknown> = {};
  root[key] = nested;
  return nested;
};

const isReadAction = (action: string): boolean =>
  action.startsWith("find") || action === "count" || action === "aggregate" || action === "groupBy";

const isSingleWriteAction = (action: string): boolean =>
  action === "create" || action === "update" || action === "upsert";

const isBulkWriteAction = (action: string): boolean =>
  action === "updateMany" || action === "deleteMany";

export const withTenantExtension = (): PrismaMiddleware => {
  return async (params, next) => {
    const tenantId = TenantContext.get();

    if (!tenantId || !params.model || !MODELS_WITH_TENANT.has(params.model)) {
      return next(params);
    }

    const addTenantToWhere = () => {
      const args = ensureArgs(params);
      const where = ensureNestedRecord(args, "where");
      if (where.tenantId !== tenantId) {
        where.tenantId = tenantId;
      }
    };

    if (isReadAction(params.action)) {
      addTenantToWhere();
    }

    if (isSingleWriteAction(params.action)) {
      const args = ensureArgs(params);
      const data = ensureNestedRecord(args, "data");
      if (data.tenantId === undefined) {
        data.tenantId = tenantId;
      }
    }

    if (isBulkWriteAction(params.action)) {
      addTenantToWhere();
    }

    if (params.action === "delete") {
      params.action = "deleteMany";
      addTenantToWhere();
    }

    return next(params);
  };
};
