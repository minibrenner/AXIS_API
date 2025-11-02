// apps/api/src/modules/tenant/controllers/users.controller.ts
// Controlador do CRUD de usuarios por tenant. Cada handler reforca o isolamento entre tenants,
// usa argon2 para hashing de senha e responde apenas com campos seguros.
import { Prisma } from "@prisma/client";
import { type Request, type Response } from "express";
import argon2 from "argon2";
import { prisma } from "../../../prisma/client";
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
} satisfies Prisma.UserSelect;

type AuthRole = "ADMIN" | "ATTENDANT" | "OWNER";
const ALLOWED_ROLES: ReadonlySet<AuthRole> = new Set(["ADMIN", "ATTENDANT", "OWNER"]);

/** Normaliza qualquer role vinda do body para um valor aceito pelo enum da aplicacao. */
function normalizeRole(role: unknown): AuthRole {
  const normalized = String(role ?? "").trim().toUpperCase() as AuthRole;
  return ALLOWED_ROLES.has(normalized) ? normalized : "ATTENDANT";
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
    res.status(400).json({ error: "Tenant nao identificado (tenantId ausente no contexto)." });
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

  const { email, password, name, role, isActive, mustChangePassword } = req.body as CreateUserInput;
  const isBootstrap = req.isBootstrapOwnerCreation === true;

  try {
    const passwordHash = await argon2.hash(password);
    const normalizedRole = normalizeRole(isBootstrap ? "OWNER" : role);
    const activeFlag = isBootstrap ? true : isActive ?? true;
    const mustChangePasswordFlag = isBootstrap ? false : mustChangePassword ?? false;

    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        name,
        role: normalizedRole,
        isActive: activeFlag,
        mustChangePassword: mustChangePasswordFlag,
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

    return res.status(201).json(user);
  } catch (error: unknown) {
    console.error("Falha ao criar usuario [details]:", toLog(error));
    if (isPrismaKnownError(error) && error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ");
      return res.status(409).json({ error: `Conflito de unicidade nos campos: ${target ?? "dados"}` });
    }
    return res.status(500).json({ error: "Falha ao criar usuario." });
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

  return res.json(users);
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
    return res.status(404).json({ error: "Usuario nao encontrado." });
  }

  return res.json(user);
};

/**
 * PUT /users/:id - atualiza dados do usuario garantindo isolamento multi-tenant.
 * Se uma nova senha vier, o hash e atualizado e passwordUpdatedAt e avançado.
 */
export const updateUser = async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;

  const { id } = req.params;
  const { email, password, name, role, isActive, mustChangePassword } = req.body as UpdateUserInput;

  const data: Record<string, unknown> = {};
  if (email !== undefined) data.email = email;
  if (name !== undefined) data.name = name;
  if (role !== undefined) data.role = normalizeRole(role);
  if (isActive !== undefined) data.isActive = isActive;
  if (mustChangePassword !== undefined) data.mustChangePassword = mustChangePassword;

  if (password) {
    data.passwordHash = await argon2.hash(password);
    data.passwordUpdatedAt = new Date();
    if (mustChangePassword === undefined) {
      data.mustChangePassword = false;
    }
  }

  try {
    const result = await prisma.user.updateMany({
      where: { id, tenantId },
      data,
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Usuario nao encontrado." });
    }

    const updated = await prisma.user.findFirst({
      where: { id, tenantId },
      select: userSelectSafe,
    });

    return res.json(updated);
  } catch (error: unknown) {
    console.error("Falha ao atualizar usuario [details]:", toLog(error));
    if (isPrismaKnownError(error) && error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ");
      return res.status(409).json({ error: `Conflito de unicidade nos campos: ${target ?? "dados"}` });
    }
    return res.status(500).json({ error: "Falha ao atualizar usuario." });
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
      return res.status(404).json({ error: "Usuario nao encontrado." });
    }

    return res.status(204).send();
  } catch (error: unknown) {
    console.error("Falha ao deletar usuario [details]:", toLog(error));
    return res.status(500).json({ error: "Falha ao deletar usuario." });
  }
};

export default { createUser, listUsers, getUser, updateUser, deleteUser };
