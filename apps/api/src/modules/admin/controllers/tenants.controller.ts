// apps/api/src/modules/admin/controllers/tenants.controller.ts
import { Prisma } from "@prisma/client";
import { type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../../prisma/client";

/**
 * Identifica se o erro é um PrismaClientKnownRequestError (para ler .code/.meta).
 */
function isPrismaKnownError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError;
}

/**
 * Formata um objeto de log seguro para qualquer erro (sem usar `any`).
 */
function toLog(e: unknown) {
  const out: Record<string, unknown> = {};
  if (e instanceof Error) {
    out.name = e.name;
    out.message = e.message;
    out.stack = e.stack;
  }
  if (typeof e === "object" && e !== null) {
    const maybe = e as Record<string, unknown>;
    if (maybe.code) out.code = maybe.code;
    if (maybe.meta) out.meta = maybe.meta;
  }
  return out;
}

/**
 * Converte o identificador recebido em rota (id ou cnpj) para o formato aceito pelo Prisma.
 * CNPJs são detectados quando contêm 14 dígitos (ignorando caracteres especiais).
 * Caso contrário assumimos que se trata do ID (cuid).
 */
const resolveTenantUniqueWhere = (identifier: string) => {
  const digitsOnly = identifier.replace(/\D/g, "");
  if (digitsOnly.length === 14) {
    return { cnpj: digitsOnly } as const;
  }
  return { id: identifier } as const;
};

/**
 * Cria um Tenant.
 * - Aceita "password" no body; se ausente, usa "1234" (em prod, prefira ler de env).
 * - Gera hash de senha e seta mustChangePassword = true.
 * - Faz checagens pró-UX (email/cnpj/name duplicados) além do unique do Prisma.
 */
export const createTenant = async (req: Request, res: Response) => {
  const { name, email, cnpj, cpfResLoja, password } = req.body ?? {};

  if (!name || !email) {
    return res
      .status(400)
      .json({ error: "Informe pelo menos os campos name e email para criar um tenant." });
  }

  const rawPassword = password ?? "1234"; // em prod: process.env.TENANT_DEFAULT_PASSWORD
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  try {
    // Checagens explícitas (melhor mensagem que apenas P2002)
    const [emailExists, cnpjExists, nameExists] = await Promise.all([
      prisma.tenant.findUnique({ where: { email } }),
      cnpj ? prisma.tenant.findUnique({ where: { cnpj } }) : Promise.resolve(null),
      prisma.tenant.findUnique({ where: { name } }),
    ]);
    if (emailExists) return res.status(409).json({ error: "Email já cadastrado." });
    if (cnpj && cnpjExists) return res.status(409).json({ error: "CNPJ já cadastrado." });
    if (nameExists) return res.status(409).json({ error: "Nome já cadastrado." });

    const tenant = await prisma.tenant.create({
      data: { name, email, cnpj, cpfResLoja, passwordHash, mustChangePassword: true },
    });

    return res.status(201).json(tenant);
  } catch (error: unknown) {
    console.error("Falha ao criar tenant [details]:", toLog(error));

    if (isPrismaKnownError(error)) {
      // Violação de unique
      if (error.code === "P2002") {
        return res.status(409).json({
          error: `Conflito de unicidade no(s) campo(s): ${(error.meta?.target as string[])?.join(", ")}`,
        });
      }
    }
    return res.status(500).json({ error: "Falha ao criar tenant por conta do servidor." });
  }
};

/**
 * Remove um Tenant por ID ou CNPJ.
 */
export const deleteTenant = async (req: Request, res: Response) => {
  const { identifier } = req.params;

  try {
    await prisma.tenant.delete({
      where: resolveTenantUniqueWhere(identifier),
    });

    return res.status(204).send();
  } catch (error: unknown) {
    if (isPrismaKnownError(error) && error.code === "P2025") {
      return res.status(404).json({ error: "Tenant nao encontrado." });
    }
    console.error("Falha ao deletar tenant:", toLog(error));
    return res.status(500).json({ error: "Falha ao deletar tenant." });
  }
};

/**
 * Lista todos os Tenants.
 */
export const listTenants = async (_req: Request, res: Response) => {
  const tenants = await prisma.tenant.findMany();
  res.json(tenants);
};

/**
 * Obtém um Tenant por ID ou CNPJ.
 */
export const getTenant = async (req: Request, res: Response) => {
  const { identifier } = req.params;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: resolveTenantUniqueWhere(identifier),
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant nao encontrado." });
    }

    return res.json(tenant);
  } catch (error: unknown) {
    console.error("Falha ao obter tenant:", toLog(error));
    return res.status(500).json({ error: "Falha ao obter tenant." });
  }
};

/**
 * Atualiza um Tenant por ID ou CNPJ.
 * - Se `password` vier no body, troca a senha (re-hash) e força mustChangePassword = true.
 * - Demais campos são atualizados se fornecidos (Prisma ignora undefined).
 */
export const updateTenant = async (req: Request, res: Response) => {
  const { identifier } = req.params;
  const { name, email, cnpj, cpfResLoja, isActive, password } = req.body;

  const data: Record<string, unknown> = { name, email, cnpj, cpfResLoja, isActive };

  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
    data.mustChangePassword = true;
  }

  try {
    const tenant = await prisma.tenant.update({
      where: resolveTenantUniqueWhere(identifier),
      data,
    });

    return res.json(tenant);
  } catch (error: unknown) {
    if (isPrismaKnownError(error)) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "Tenant nao encontrado." });
      }
      if (error.code === "P2002") {
        return res.status(409).json({
          error: `Conflito de unicidade no(s) campo(s): ${(error.meta?.target as string[])?.join(", ")}`,
        });
      }
    }

    console.error("Falha ao atualizar tenant:", toLog(error));
    return res.status(500).json({ error: "Falha ao atualizar tenant." });
  }
};

export default { createTenant, deleteTenant, listTenants, getTenant, updateTenant };
