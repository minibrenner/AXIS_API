import type { NextFunction, Request, Response } from "express";
import { TenantContext } from "./tenant.context";
import { ErrorCodes, HttpError } from "../utils/httpErrors";

/**
 * Middleware que garante que o tenant ativo seja sempre derivado do JWT.
 * Depois que `jwtAuth` valida o token e popula `req.user`, usamos as claims
 * para preencher `req.tenantId` e propagar o contexto para o Prisma.
 * Opcionalmente, se um header `x-tenant-id` for enviado, validamos que ele
 * coincide com o tenant do token para evitar misturas acidentais.
 */
export function tenantFromUserMiddleware(req: Request, _res: Response, next: NextFunction) {
  const userTenant = req.user?.tenantId ?? req.user?.tid;
  if (!userTenant) {
    return next(
      new HttpError({
        status: 400,
        code: ErrorCodes.TENANT_NOT_RESOLVED,
        message: "Tenant nao encontrado no token.",
      })
    );
  }

  const headerTenant = req.header("x-tenant-id");
  if (headerTenant && headerTenant !== userTenant) {
    return next(
      new HttpError({
        status: 403,
        code: ErrorCodes.FORBIDDEN,
        message: "Tenant do header nao corresponde ao token.",
      })
    );
  }

  req.tenantId = userTenant;
  TenantContext.run(userTenant, () => next());
}

