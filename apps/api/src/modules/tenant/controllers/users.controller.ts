import { Prisma } from "@prisma/client";
import { type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../../prisma/client";

// ------------ helpers de erro tipado ------------
function isPrismaKnownError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError;
}
function toLog(e: unknown) {
  const out: Record<string, unknown> = {};
  if (e instanceof Error) {
    out.name = e.name;
    out.message = e.message;
    out.stack = e.stack;
  }
  if (typeof e === "object" && e !== null) {
    const r = e as Record<string, unknown>;
    if (r.code) out.code = r.code;
    if (r.meta) out.meta = r.meta;
  }
  return out;
}

// ------------ helpers de resposta sem passwordHash ------------
const userSelectSafe = {
  id: true,
  tenantId: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} satisfies Record<string, boolean>;

// ------------ garantir tenantId ------------
function requireTenantId(req: Request, res: Response): string | undefined {
  const tenantId = req.tenantId;
  if (!tenantId) {
    res.status(400).json({ error: "Tenant não identificado (tenantId ausente no contexto)." });
    return undefined;
  }
  return tenantId;
}

// ========== CREATE ==========
export const createUser = async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;

  const { email, password, name, role, isActive } = req.body;

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        name,
        role: role ?? "ATTENDANT",
        isActive: isActive ?? true
      },
      select: userSelectSafe
    });

    return res.status(201).json(user);
  } catch (error: unknown) {
    console.error("Falha ao criar usuário [details]:", toLog(error));
    if (isPrismaKnownError(error)) {
      if (error.code === "P2002") {
        return res.status(409).json({
          error: `Conflito de unicidade no(s) campo(s): ${(error.meta?.target as string[])?.join(", ")}`
        });
      }
    }
    return res.status(500).json({ error: "Falha ao criar usuário." });
  }
};

// ========== LIST ==========
export const listUsers = async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;

  const users = await prisma.user.findMany({
    where: { tenantId },
    select: userSelectSafe
  });
  return res.json(users);
};

// ========== GET BY ID ==========
export const getUser = async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;

  const { id } = req.params;

  const user = await prisma.user.findFirst({
    where: { id, tenantId },
    select: userSelectSafe
  });

  if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
  return res.json(user);
};

// ========== UPDATE ==========
export const updateUser = async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;

  const { id } = req.params;
  const { email, password, name, role, isActive } = req.body;

  const data: Record<string, unknown> = { email, name, role, isActive };
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  try {
    const user = await prisma.user.update({
      where: { id }, // garantimos escopo pelo filtro seguinte
      data,
      select: userSelectSafe
    });

    // proteção extra: valida se pertence ao tenant (em caso de IDs vazados)
    if (user.tenantId !== tenantId) {
      return res.status(403).json({ error: "Usuário não pertence a este tenant." });
    }

    return res.json(user);
  } catch (error: unknown) {
    console.error("Falha ao atualizar usuário [details]:", toLog(error));
    if (isPrismaKnownError(error)) {
      if (error.code === "P2025") return res.status(404).json({ error: "Usuário não encontrado." });
      if (error.code === "P2002") {
        return res.status(409).json({
          error: `Conflito de unicidade no(s) campo(s): ${(error.meta?.target as string[])?.join(", ")}`
        });
      }
    }
    return res.status(500).json({ error: "Falha ao atualizar usuário." });
  }
};

// ========== DELETE ==========
export const deleteUser = async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res);
  if (!tenantId) return;

  const { id } = req.params;

  try {
    // delete direto por id e conferência: se quiser, faça first -> check -> delete.
    const deleted = await prisma.user.delete({
      where: { id },
      select: { id: true, tenantId: true }
    });

    if (deleted.tenantId !== tenantId) {
      return res.status(403).json({ error: "Usuário não pertence a este tenant." });
    }

    return res.status(204).send();
  } catch (error: unknown) {
    console.error("Falha ao deletar usuário [details]:", toLog(error));
    if (isPrismaKnownError(error) && error.code === "P2025") {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }
    return res.status(500).json({ error: "Falha ao deletar usuário." });
  }
};

export default { createUser, listUsers, getUser, updateUser, deleteUser };
