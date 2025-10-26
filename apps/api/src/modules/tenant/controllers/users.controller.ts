import { type Request, type Response } from "express";
import { prisma } from "../../../prisma/client";

/**
 * Cria um novo usuario associado ao tenant presente no contexto.
 */
export const createUser = async (req: Request, res: Response) => {
  const { email, passwordHash, role = "ATTENDANT" } = req.body;
  // tenantMiddleware garante que `req.tenantId` esteja presente antes de chegar aqui.
  const tenantId = req.tenantId!;

  const user = await prisma.user.create({
    data: { tenantId, email, passwordHash, role },
  });

  res.status(201).json(user);
};

/**
 * Lista os usuarios pertencentes ao tenant atual, ordenados por criacao.
 */
export const listUsers = async (_req: Request, res: Response) => {
  // `prisma.user.findMany` ja aplica o filtro de tenant via withTenantExtension.
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  res.json(users);
};
