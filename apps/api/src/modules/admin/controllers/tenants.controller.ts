import { Prisma } from "@prisma/client";
import { type Request, type Response } from "express";
import { prisma } from "../../../prisma/client";

/**
 * Controller responsavel por lidar com operacoes administrativas de tenants.
 * A criacao de tenants acontece fora do fluxo multi-tenant, portanto estes
 * handlers nao dependem do tenantMiddleware.
 */
export const createTenant = async (req: Request, res: Response) => {
  /**
   * Campos minimos para criar um tenant. Esses valores chegam via JSON no corpo da requisicao.
   */
  const { name, email, cnpj, cpfResLoja } = req.body ?? {};

  if (!name || !email) {
    return res
      .status(400)
      .json({ error: "Informe pelo menos os campos name e email para criar um tenant." });
  }

  try {
    const tenant = await prisma.tenant.create({
      data: { name, email, cnpj, cpfResLoja },
    });

    return res.status(201).json(tenant);
  } catch (error) {
    console.error("Falha ao criar tenant:", error);
    return res.status(500).json({ error: "Falha ao criar tenant." });
  }
};

/**
 * Converte o identificador recebido em rota (id ou cnpj) para o formato aceito
 * pelo Prisma. CNPJs sao detectados quando contem 14 digitos (ignorando
 * caracteres especiais). Caso contrario assumimos que se trata do ID (cuid).
 */
const resolveTenantUniqueWhere = (identifier: string) => {
  const digitsOnly = identifier.replace(/\D/g, "");
  if (digitsOnly.length === 14) {
    return { cnpj: digitsOnly } as const;
  }

  return { id: identifier } as const;
};

export const deleteTenant = async (req: Request, res: Response) => {
  const { identifier } = req.params;

  try {
    await prisma.tenant.delete({
      where: resolveTenantUniqueWhere(identifier),
    });

    return res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ error: "Tenant nao encontrado." });
    }

    console.error("Falha ao deletar tenant:", error);
    return res.status(500).json({ error: "Falha ao deletar tenant." });
  }
};

export const listTenants = async (_req: Request, res: Response) => {
  const tenants = await prisma.tenant.findMany();
  res.json(tenants);
};

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
  } catch (error) {
    console.error("Falha ao obter tenant:", error);
    return res.status(500).json({ error: "Falha ao obter tenant." });
  }
};

export const updateTenant = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, cnpj, cpfResLoja, isActive } = req.body;

  try {
    const tenant = await prisma.tenant.update({
      where: { id },
      data: { name, email, cnpj, cpfResLoja, isActive },
    });

    return res.json(tenant);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ error: "Tenant nao encontrado." });
    }

    console.error("Falha ao atualizar tenant:", error);
    return res.status(500).json({ error: "Falha ao atualizar tenant." });
  }
};

export default { createTenant, deleteTenant, listTenants, getTenant, updateTenant };
