import { Prisma, Role } from "@prisma/client";
import argon2 from "argon2";
import { type Request, type Response } from "express";
import { prisma } from "../../prisma/client";
import { ErrorCodes, respondWithError } from "../../utils/httpErrors";
import { buildTenantWhereCandidates } from "./tenants.controller";

type CreateTenantUserBody = {
  tenantIdentifier: string;
  email: string;
  password: string;
  name?: string;
  role?: Role;
  pinSupervisor?: string | null;
};

const sanitizeRole = (role?: Role): Role => {
  if (!role) {
    return "ADMIN";
  }
  if (role === "ADMIN" || role === "OWNER") {
    return role;
  }
  return "ADMIN";
};

function formatTarget(target: unknown): string | undefined {
  if (Array.isArray(target)) {
    return target.join(",");
  }
  if (typeof target === "string") {
    return target;
  }
  return undefined;
}

export async function createTenantUser(req: Request, res: Response) {
  const { tenantIdentifier, email, password, name, role, pinSupervisor } = req.body as CreateTenantUserBody;

  if (!tenantIdentifier || !email || !password) {
    return respondWithError(res, {
      status: 400,
      code: ErrorCodes.BAD_REQUEST,
      message: "Campos tenantIdentifier, email e password sao obrigatorios.",
    });
  }

  const candidates = buildTenantWhereCandidates(tenantIdentifier);
  let tenantId: string | undefined;

  for (const where of candidates) {
    const tenant = await prisma.tenant.findUnique({ where, select: { id: true } });
    if (tenant) {
      tenantId = tenant.id;
      break;
    }
  }

  if (!tenantId) {
    return respondWithError(res, {
      status: 404,
      code: ErrorCodes.TENANT_NOT_FOUND,
      message: "Tenant nao encontrado.",
      details: { tenantIdentifier },
    });
  }

  try {
    const passwordHash = await argon2.hash(password);
    const supervisorPin =
      pinSupervisor && pinSupervisor.trim().length > 0 ? await argon2.hash(pinSupervisor.trim()) : undefined;

    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        name,
        role: sanitizeRole(role),
        isActive: true,
        mustChangePassword: false,
        ...(supervisorPin ? { pinSupervisor: supervisorPin } : {}),
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.status(201).json(user);
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return respondWithError(res, {
        status: 409,
        code: ErrorCodes.USER_CONFLICT,
        message: "Email ja utilizado neste tenant.",
        details: { target: formatTarget(error.meta?.target) },
      });
    }

    return respondWithError(res, {
      status: 500,
      code: ErrorCodes.INTERNAL,
      message: "Falha ao criar usuario.",
    });
  }
}
