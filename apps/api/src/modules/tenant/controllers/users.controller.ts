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

export const getUser = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findFirst({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuario nao encontrado." });
    }

    return res.json(user);
  } catch (error) {
    console.error("Falha ao obter usuario:", error);
    return res.status(500).json({ error: "Falha ao obter usuario." });
  }
};  

export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email, passwordHash, role } = req.body;

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { email, passwordHash, role },
    });

    return res.json(user);
  } catch (error) {
    console.error("Falha ao atualizar usuario:", error);  
    return res.status(500).json({ error: "Falha ao atualizar usuario." });
  }
};
export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.user.delete({
      where: { id },
    });

    return res.status(204).send();
  } catch (error) {
    console.error("Falha ao deletar usuario:", error);
    return res.status(500).json({ error: "Falha ao deletar usuario." });
  }
};

