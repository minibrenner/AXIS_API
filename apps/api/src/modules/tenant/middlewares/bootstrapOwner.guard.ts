import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../../prisma/client";
import { jwtAuth, requireRole } from "../../../auth/middleware";

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
    return res.status(400).json({ error: "Tenant nao identificado" });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { ownerUserId: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant nao encontrado" });
    }

    if (tenant.ownerUserId) {
      return res.status(401).json({ error: "Token ausente" });
    }

    const userCount = await prisma.user.count({ where: { tenantId } });
    if (userCount > 0) {
      return res.status(401).json({ error: "Token ausente" });
    }

    req.isBootstrapOwnerCreation = true;
    return next();
  } catch (error) {
    console.error("Falha ao validar bootstrap de owner:", error);
    return res.status(500).json({ error: "Falha ao validar tenant." });
  }
};
