// apps/api/src/prisma/withTenantExtension.ts
import { TenantContext } from "../tenancy/tenant.context";

// tipo local de middleware (evita depender de Prisma.Middleware no editor)
type PrismaMiddleware = (params: any, next: (params: any) => Promise<any>) => Promise<any>;

const MODELS_COM_TENANT = new Set(["User", "Session", "AuditLog"]);

export const withTenantExtension = (): PrismaMiddleware => {
  return async (params, next) => {
    const tenantId = TenantContext.get();

    if (tenantId && params.model && MODELS_COM_TENANT.has(params.model)) {
      // leituras
      if (
        params.action?.startsWith?.("find") ||
        ["count", "aggregate", "groupBy"].includes(params.action)
      ) {
        params.args ??= {};
        params.args.where = { ...(params.args.where ?? {}), tenantId };
      }

      // escrita single
      if (["create", "update", "upsert"].includes(params.action)) {
        params.args ??= {};
        params.args.data = {
          ...(params.args.data ?? {}),
          tenantId: params.args?.data?.tenantId ?? tenantId,
        };
      }

      // escrita em massa
      if (["updateMany", "deleteMany"].includes(params.action)) {
        params.args ??= {};
        params.args.where = { ...(params.args.where ?? {}), tenantId };
      }

      // delete single → escopa
      if (params.action === "delete") {
        params.action = "deleteMany";
        params.args ??= {};
        params.args.where = { ...(params.args.where ?? {}), tenantId };
      }
    }

    return next(params);
  };
};
