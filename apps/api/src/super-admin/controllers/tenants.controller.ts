// apps/api/src/super-admin/controllers/tenants.controller.ts
// CRUD administrativo exclusivo do super admin com checagens de unicidade e mensagens amigaveis.
import { Prisma } from "@prisma/client";
import { type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../prisma/client";
import { ErrorCodes, respondWithError } from "../../utils/httpErrors";

function isPrismaKnownError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

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

function formatUniqueTarget(target: unknown): string {
  if (!target) return "dados";
  if (Array.isArray(target)) return target.join(", ");
  if (typeof target === "string") {
    const cleaned = target.replace(/[^A-Za-z0-9_,]+/g, " ").trim();
    return cleaned || "dados";
  }
  return "dados";
}

export const buildTenantWhereCandidates = (identifier: string): Prisma.TenantWhereUniqueInput[] => {
  const trimmed = identifier.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");
  const candidates: Prisma.TenantWhereUniqueInput[] = [];

  if (digitsOnly.length === 14) {
    candidates.push({ cnpj: digitsOnly });
  }

  if (digitsOnly.length === 11) {
    candidates.push({ cpfResLoja: digitsOnly });
  }

  if (trimmed) {
    candidates.push({ id: trimmed });
    candidates.push({ name: trimmed });
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = Object.entries(candidate)
      .map(([k, v]) => `${k}:${v}`)
      .join("-");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export async function findTenantByIdentifier(identifier: string) {
  const candidates = buildTenantWhereCandidates(identifier);

  for (const where of candidates) {
    const tenant = await prisma.tenant.findUnique({ where });
    if (tenant) {
      return tenant;
    }
  }

  return null;
}

export const createTenant = async (req: Request, res: Response) => {
  const payload = (req.body ?? {}) as {
    name?: string;
    email?: string;
    cnpj?: string;
    cpfResLoja?: string;
  };
  const { name, email, cnpj, cpfResLoja } = payload;

  const missingFields: string[] = [];
  if (!name) missingFields.push("name");
  if (!email) missingFields.push("email");

  if (missingFields.length) {
    return respondWithError(res, {
      status: 400,
      code: ErrorCodes.BAD_REQUEST,
      message: "Informe os campos obrigatorios name e email para criar um tenant.",
      details: { missing: missingFields },
    });
  }

  const ensuredName = name as string;
  const ensuredEmail = email as string;

  try {
    const [emailExists, cnpjExists, nameExists, cpfExists] = await Promise.all([
      prisma.tenant.findUnique({ where: { email: ensuredEmail } }),
      cnpj ? prisma.tenant.findUnique({ where: { cnpj } }) : Promise.resolve(null),
      prisma.tenant.findUnique({ where: { name: ensuredName } }),
      cpfResLoja ? prisma.tenant.findUnique({ where: { cpfResLoja } }) : Promise.resolve(null),
    ]);

    if (emailExists) {
      return respondWithError(res, {
        status: 409,
        code: ErrorCodes.TENANT_CONFLICT,
        message: "Email ja cadastrado.",
        details: { field: "email" },
      });
    }
    if (cnpj && cnpjExists) {
      return respondWithError(res, {
        status: 409,
        code: ErrorCodes.TENANT_CONFLICT,
        message: "CNPJ ja cadastrado.",
        details: { field: "cnpj" },
      });
    }
    if (nameExists) {
      return respondWithError(res, {
        status: 409,
        code: ErrorCodes.TENANT_CONFLICT,
        message: "Nome ja cadastrado.",
        details: { field: "name" },
      });
    }
    if (cpfResLoja && cpfExists) {
      return respondWithError(res, {
        status: 409,
        code: ErrorCodes.TENANT_CONFLICT,
        message: "CPF do responsavel da loja ja cadastrado.",
        details: { field: "cpfResLoja" },
      });
    }

    const tenant = await prisma.tenant.create({
      data: { name: ensuredName, email: ensuredEmail, cnpj, cpfResLoja },
    });

    return res.status(201).json(tenant);
  } catch (error: unknown) {
    console.error("Falha ao criar tenant [details]:", toLog(error));

    if (isPrismaKnownError(error) && error.code === "P2002") {
      const target = formatUniqueTarget(error.meta?.target);
      return respondWithError(res, {
        status: 409,
        code: ErrorCodes.TENANT_CONFLICT,
        message: "Ja existe um tenant com os dados fornecidos.",
        ...(target ? { details: { target } } : {}),
      });
    }

    return respondWithError(res, {
      status: 500,
      code: ErrorCodes.INTERNAL,
      message: "Falha ao criar tenant por conta do servidor.",
    });
  }
};

export const deleteTenant = async (req: Request, res: Response) => {
  const { identifier } = req.params;

  const candidates = buildTenantWhereCandidates(identifier);

  for (const where of candidates) {
    try {
      await prisma.tenant.delete({ where });
      return res.status(204).send();
    } catch (error: unknown) {
      if (isPrismaKnownError(error) && error.code === "P2025") {
        continue;
      }
      console.error("Falha ao deletar tenant:", toLog(error));
      return respondWithError(res, {
        status: 500,
        code: ErrorCodes.INTERNAL,
        message: "Falha ao deletar tenant.",
      });
    }
  }

  return respondWithError(res, {
    status: 404,
    code: ErrorCodes.TENANT_NOT_FOUND,
    message: "Tenant nao encontrado.",
    details: { identifier },
  });
};

export const listTenants = async (_req: Request, res: Response) => {
  const tenants = await prisma.tenant.findMany();
  res.json(tenants);
};

export const getTenant = async (req: Request, res: Response) => {
  const { identifier } = req.params;

  try {
    const tenant = await findTenantByIdentifier(identifier);

    if (!tenant) {
      return respondWithError(res, {
        status: 404,
        code: ErrorCodes.TENANT_NOT_FOUND,
        message: "Tenant nao encontrado.",
        details: { identifier },
      });
    }

    return res.json(tenant);
  } catch (error: unknown) {
    console.error("Falha ao obter tenant:", toLog(error));
    return respondWithError(res, {
      status: 500,
      code: ErrorCodes.INTERNAL,
      message: "Falha ao obter tenant.",
    });
  }
};

export const updateTenant = async (req: Request, res: Response) => {
  const { identifier } = req.params;
  const { name, email, cnpj, cpfResLoja, isActive, password } = req.body ?? {};

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (cnpj !== undefined) data.cnpj = cnpj;
  if (cpfResLoja !== undefined) data.cpfResLoja = cpfResLoja;
  if (isActive !== undefined) data.isActive = isActive;

  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
    data.mustChangePassword = true;
  }

  const candidates = buildTenantWhereCandidates(identifier);
  const updatePayload = data as Prisma.TenantUpdateInput;

  for (const where of candidates) {
    try {
      const tenant = await prisma.tenant.update({
        where,
        data: updatePayload,
      });

      return res.json(tenant);
    } catch (error: unknown) {
      if (isPrismaKnownError(error)) {
        if (error.code === "P2025") {
          continue;
        }
        if (error.code === "P2002") {
          const target = formatUniqueTarget(error.meta?.target);
          return respondWithError(res, {
            status: 409,
            code: ErrorCodes.TENANT_CONFLICT,
            message: "Ja existe um tenant com os dados fornecidos.",
            ...(target ? { details: { target } } : {}),
          });
        }
      }

      console.error("Falha ao atualizar tenant:", toLog(error));
      return respondWithError(res, {
        status: 500,
        code: ErrorCodes.INTERNAL,
        message: "Falha ao atualizar tenant.",
      });
    }
  }

  return respondWithError(res, {
    status: 404,
    code: ErrorCodes.TENANT_NOT_FOUND,
    message: "Tenant nao encontrado.",
    details: { identifier },
  });
};

export default { createTenant, deleteTenant, listTenants, getTenant, updateTenant };
