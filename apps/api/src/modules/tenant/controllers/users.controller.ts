// apps/api/src/modules/tenant/controllers/users.controller.ts
// Controlador do CRUD de usuarios por tenant. Cada handler reforca o isolamento entre tenants,
// usa argon2 para hashing de senha e responde apenas com campos seguros.
import { Prisma } from "@prisma/client";
import { type Request, type Response } from "express";
import argon2 from "argon2";
import { prisma } from "../../../prisma/client";
import { ErrorCodes, respondWithError } from "../../../utils/httpErrors";
import type { CreateUserInput, UpdateUserInput } from "../validators/user.schemas";

/** Campos autorizados a sair na camada HTTP (passwordHash jamais e exposto). */
const userSelectSafe = {
  id: true,
  tenantId: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
  passwordUpdatedAt: true,
  pinSupervisor: true,
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof userSelectSafe }>;

const toHttpUser = (user: SelectedUser | null) => {
  if (!user) {
    return null;
  }

  const { pinSupervisor, ...rest } = user;
  return { ...rest, hasSupervisorPin: Boolean(pinSupervisor) };
};

async function normalizeSupervisorPin(input?: string | null) {
  if (input === undefined) {
    return undefined;
  }

  if (input === null) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  return argon2.hash(trimmed);
}

type AuthRole = "ADMIN" | "ATTENDANT" | "OWNER";
const ALLOWED_ROLES: ReadonlySet<AuthRole> = new Set(["ADMIN", "ATTENDANT", "OWNER"]);

/** Normaliza qualquer role vinda do body para um valor aceito pelo enum da aplicacao. */
function normalizeRole(role: unknown): AuthRole {
  const normalized = String(role ?? "").trim().toUpperCase() as AuthRole;
  return ALLOWED_ROLES.has(normalized) ? normalized : "ATTENDANT";
}

const ROLE_ASSIGNMENT: Record<AuthRole, ReadonlySet<AuthRole>> = {
  OWNER: new Set<AuthRole>(["OWNER", "ADMIN", "ATTENDANT"]),
  ADMIN: new Set<AuthRole>(["ADMIN", "ATTENDANT"]),
  ATTENDANT: new Set<AuthRole>(),
};

function canAssignRole(creator: AuthRole | undefined, target: AuthRole) {
  if (!creator) {
    return false;
  }
  const allowed = ROLE_ASSIGNMENT[creator];
  return allowed?.has(target) ?? false;
}

function ensureRoleAssignmentPermission(
  req: Request,
  res: Response,
  targetRole: AuthRole,
  isBootstrap: boolean
): targetRole is AuthRole {
  if (isBootstrap) {
    return true;
  }

  const creatorRole = req.user?.role;
  if (!canAssignRole(creatorRole, targetRole)) {
    respondWithError(res, {
      status: 403,
      code: ErrorCodes.FORBIDDEN,
      message: "Role alvo nao autorizada para o usuario autenticado.",
      details: { requesterRole: creatorRole ?? "UNKNOWN", targetRole },
    });
    return false;
  }

  return true;
}

/** Identifica erros conhecidos do Prisma (unicidade, etc.) para respostas amigaveis. */
function isPrismaKnownError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

/** Padroniza os logs de erro emitidos pelo controller. */
function toLog(error: unknown) {
  const output: Record<string, unknown> = {};
  if (error instanceof Error) {
    output.name = error.name;
    output.message = error.message;
    output.stack = error.stack;
  }
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    if (record.code) output.code = record.code;
    if (record.meta) output.meta = record.meta;
  }
  return output;
}

/** Interrompe o fluxo caso o tenantId nao esteja presente no contexto. */
function requireTenantId(req: Request, res: Response): string | undefined {
  const tenantId = req.tenantId;
  if (!tenantId) {
    respondWithError(res, {
      status: 400,
      code: ErrorCodes.TENANT_NOT_RESOLVED,
      message: "Tenant nao identificado no contexto da requisicao.",
    });
    return undefined;
  }
  return tenantId;
}

/**
 * POST /users - cria um usuario no tenant atual e armazena apenas o hash do refresh.
 */
export const createUser = async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;

  const { email, password, name, role, isActive, mustChangePassword, pinSupervisor } = req.body as CreateUserInput;
  const isBootstrap = req.isBootstrapOwnerCreation === true;

  try {
    const passwordHash = await argon2.hash(password);
    const normalizedRole = normalizeRole(isBootstrap ? "OWNER" : role);

    if (!ensureRoleAssignmentPermission(req, res, normalizedRole, isBootstrap)) {
      return;
    }

    const activeFlag = isBootstrap ? true : isActive ?? true;
    const mustChangePasswordFlag = isBootstrap ? false : mustChangePassword ?? false;
    const supervisorPin = await normalizeSupervisorPin(pinSupervisor);

    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        name,
        role: normalizedRole,
        isActive: activeFlag,
        mustChangePassword: mustChangePasswordFlag,
        ...(supervisorPin !== undefined ? { pinSupervisor: supervisorPin } : {}),
      },
      select: userSelectSafe,
    });

    if (isBootstrap && user.role === "OWNER") {
      await prisma.tenant
        .update({
          where: { id: tenantId },
          data: { ownerUserId: user.id },
        })
        .catch((error: unknown) => {
          console.error("Falha ao vincular owner ao tenant:", toLog(error));
        });
    }

    return res.status(201).json(toHttpUser(user));
  } catch (error: unknown) {
    console.error("Falha ao criar usuario [details]:", toLog(error));
    if (isPrismaKnownError(error) && error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ");
      return respondWithError(res, {
        status: 409,
        code: ErrorCodes.USER_CONFLICT,
        message: "Ja existe um usuario com os dados fornecidos.",
        ...(target ? { details: { target } } : {}),
      });
    }
    return respondWithError(res, {
      status: 500,
      code: ErrorCodes.INTERNAL,
      message: "Falha ao criar usuario.",
    });
  }
};

/**
 * GET /users - lista usuarios do tenant com pagina simples (sem filtros adicionais).
 */
export const listUsers = async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;

  const users = await prisma.user.findMany({
    where: { tenantId },
    select: userSelectSafe,
  });

  return res.json(users.map((user) => toHttpUser(user)!));
};

/**
 * GET /users/:id - recupera apenas usuarios pertencentes ao tenant corrente.
 */
export const getUser = async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;

  const { id } = req.params;

  const user = await prisma.user.findFirst({
    where: { id, tenantId },
    select: userSelectSafe,
  });

  if (!user) {
    return respondWithError(res, {
      status: 404,
      code: ErrorCodes.USER_NOT_FOUND,
      message: "Usuario nao encontrado.",
    });
  }

  return res.json(toHttpUser(user));
};

/**
 * PUT /users/:id - atualiza dados do usuario garantindo isolamento multi-tenant.
 * Se uma nova senha vier, o hash e atualizado e passwordUpdatedAt e avancado.
 */
export const updateUser = async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;

  const { id } = req.params;
  const { email, password, name, role, isActive, mustChangePassword, pinSupervisor } = req.body as UpdateUserInput;

  const data: Record<string, unknown> = {};
  if (email !== undefined) data.email = email;
  if (name !== undefined) data.name = name;
  if (role !== undefined) {
    const normalizedRole = normalizeRole(role);
    if (!ensureRoleAssignmentPermission(req, res, normalizedRole, false)) {
      return;
    }
    data.role = normalizedRole;
  }
  if (isActive !== undefined) data.isActive = isActive;
  if (mustChangePassword !== undefined) data.mustChangePassword = mustChangePassword;

  if (password) {
    data.passwordHash = await argon2.hash(password);
    data.passwordUpdatedAt = new Date();
    if (mustChangePassword === undefined) {
      data.mustChangePassword = false;
    }
  }

  const supervisorPin = await normalizeSupervisorPin(pinSupervisor ?? undefined);
  if (supervisorPin !== undefined) {
    data.pinSupervisor = supervisorPin;
  }

  try {
    const result = await prisma.user.updateMany({
      where: { id, tenantId },
      data,
    });

    if (result.count === 0) {
      return respondWithError(res, {
        status: 404,
        code: ErrorCodes.USER_NOT_FOUND,
        message: "Usuario nao encontrado.",
      });
    }

    const updated = await prisma.user.findFirst({
      where: { id, tenantId },
      select: userSelectSafe,
    });

    return res.json(toHttpUser(updated));
  } catch (error: unknown) {
    console.error("Falha ao atualizar usuario [details]:", toLog(error));
    if (isPrismaKnownError(error) && error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ");
      return respondWithError(res, {
        status: 409,
        code: ErrorCodes.USER_CONFLICT,
        message: "Ja existe um usuario com os dados fornecidos.",
        ...(target ? { details: { target } } : {}),
      });
    }
    return respondWithError(res, {
      status: 500,
      code: ErrorCodes.INTERNAL,
      message: "Falha ao atualizar usuario.",
    });
  }
};

/**
 * DELETE /users/:id - remove usuario do tenant sem afetar dados de outros tenants.
 */
export const deleteUser = async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;

  const { id } = req.params;

  try {
    const result = await prisma.user.deleteMany({
      where: { id, tenantId },
    });

    if (result.count === 0) {
      return respondWithError(res, {
        status: 404,
        code: ErrorCodes.USER_NOT_FOUND,
        message: "Usuario nao encontrado.",
      });
    }

    return res.status(204).send();
  } catch (error: unknown) {
    console.error("Falha ao deletar usuario [details]:", toLog(error));
    return respondWithError(res, {
      status: 500,
      code: ErrorCodes.INTERNAL,
      message: "Falha ao deletar usuario.",
    });
  }
};

export default { createUser, listUsers, getUser, updateUser, deleteUser };
