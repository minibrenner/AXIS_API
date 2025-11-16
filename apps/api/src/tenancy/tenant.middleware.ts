import { Request, Response, NextFunction } from "express";
import { TenantContext } from "./tenant.context";
import { ErrorCodes, HttpError } from "../utils/httpErrors";

function resolveTenant(req: Request) {
  const tenantFromUser = (req.user && (req.user.tid || req.user.tenantId)) as string | undefined;
  const tenantFromHeader = req.headers["x-tenant-id"] as string | undefined;
  const tenantFromParams = req.params?.tenantId as string | undefined;

  return tenantFromUser || tenantFromHeader || tenantFromParams;
}

function enterTenantScope(tenantId: string, next: NextFunction) {
  if (TenantContext.get() === tenantId) {
    next();
    return;
  }

  TenantContext.run(tenantId, () => next());
}

/**
 * Middleware responsavel por descobrir o tenant atual e salva-lo em:
 * - `req.tenantId`, facilitando o uso nas rotas/controllers.
 * - `TenantContext`, que alimenta o middleware do Prisma.
 *
 * Ele procura o tenant em `req.user` (quando autenticacao estiver ativa) ou no
 * header `x-tenant-id` (util para ambientes de desenvolvimento e testes).
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  const tenantId = resolveTenant(req);

  if (!tenantId) {
    return next(
      new HttpError({
        status: 400,
        code: ErrorCodes.TENANT_NOT_RESOLVED,
        message: "Tenant nao identificado.",
      })
    );
  }

  req.tenantId = tenantId;
  enterTenantScope(tenantId, next);
}
