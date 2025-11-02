import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../../prisma/client";
import { jwtAuth, requireRole } from "../../../auth/middleware";
import { ErrorCodes, respondWithError } from "../../../utils/httpErrors";

const authenticatedGuard = jwtAuth(true);
const roleGuard = requireRole("ADMIN", "OWNER");

/**
 * Permite criar o primeiro OWNER de um tenant sem token.
 * - Se houver Authorization, delega para jwtAuth + requireRole normalmente.
 * - Sem Authorization, valida que o tenant existe e não possui usuários/owner.
 */
export const bootstrapOwnerGuard = async (req: Request, res: Response, next: NextFunction) => {
  const hasAuthorization = Boolean(req.headers.authorization);

  if (hasAuthorization) {
    return authenticatedGuard(req, res, (authError?: unknown) => {
      if (authError) {
        return next(authError);
      }
      return roleGuard(req, res, next);
    });
  }

  const tenantId = req.tenantId;
  if (!tenantId) {
    return respondWithError(res, {
      status: 400,
      code: ErrorCodes.TENANT_NOT_RESOLVED,
      message: "Tenant nao identificado.",
    });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { ownerUserId: true },
    });

    if (!tenant) {
      return respondWithError(res, {
        status: 404,
        code: ErrorCodes.TENANT_NOT_FOUND,
        message: "Tenant nao encontrado.",
        details: { tenantId },
      });
    }

    if (tenant.ownerUserId) {
      return respondWithError(res, {
        status: 401,
        code: ErrorCodes.BOOTSTRAP_LOCKED,
        message: "Bootstrap de owner nao esta mais disponivel para este tenant.",
      });
    }

    const userCount = await prisma.user.count({ where: { tenantId } });
    if (userCount > 0) {
      return respondWithError(res, {
        status: 401,
        code: ErrorCodes.BOOTSTRAP_LOCKED,
        message: "Bootstrap de owner ja foi utilizado. Realize login para criar novos usuarios.",
      });
    }

    req.isBootstrapOwnerCreation = true;
    return next();
  } catch (error) {
    console.error("Falha ao validar bootstrap de owner:", error);
    return respondWithError(res, {
      status: 500,
      code: ErrorCodes.INTERNAL,
      message: "Falha ao validar tenant.",
    });
  }
};
