import  { type Request, type Response} from "express";
import { prisma } from "../../../prisma/client";

/**
 * Controller responsável por lidar com a criação de novos tenants (clientes).
 * Este endpoint NÃO depende do tenantMiddleware, pois é justamente o ponto
 * de entrada para criar o primeiro registro de tenant na plataforma.
 */
export const createTenant = async (req: Request, res: Response) => {
  /**
   * Campos mínimos para criar um tenant. Estes valores chegam via JSON no corpo da requisição.
   * - name: nome fantasia exibido na plataforma.
   * - email: usado para contato e também precisa ser único na tabela.
   * - cnpj: opcional, mas serve para identificar a empresa legalmente.
   * - cpfResLoja: opcional, caso queira atrelar CPF do responsável.
   */
  const { name, email, cnpj, cpfResLoja } = req.body ?? {};

  // Validação simples para garantir que os campos obrigatórios existam.
  if (!name || !email) {
    return res
      .status(400)
      .json({ error: "Informe pelo menos os campos name e email para criar um tenant." });
  }

  try {
    /**
     * Cria o tenant usando o Prisma. O backend já cuida dos campos automáticos:
     * - id é gerado via cuid().
     * - createdAt e updatedAt são preenchidos pelo banco.
     * - isActive inicia como true conforme o schema.
     */
    const tenant = await prisma.tenant.create({
      data: {
        name,
        email,
        cnpj,
        cpfResLoja,
      },
    });

    // Retornamos 201 (Created) junto com o registro completo para o cliente HTTP.
    return res.status(201).json(tenant);
  } catch (error) {
    /**
     * Em caso de erro (ex.: e-mail já existe), informamos o cliente com status 500
     * e uma mensagem genérica. Pro código real, seria interessante mapear erros
     * conhecidos do Prisma para respostas específicas.
     */
    console.error("Falha ao criar tenant:", error);
    return res.status(500).json({ error: "Falha ao criar tenant." });
  }
};

export const deleteTenant = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.tenant.delete({
      where: { id },
    });

    return res.status(204).send();
  } catch (error) {
    console.error("Falha ao deletar tenant:", error);
    return res.status(500).json({ error: "Falha ao deletar tenant." });
  }
};

export const listTenants = async (_req: Request, res: Response) => {
  const tenants = await prisma.tenant.findMany();
  res.json(tenants);
};  

export const getTenant = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant não encontrado." });
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
    console.error("Falha ao atualizar tenant:", error);
    return res.status(500).json({ error: "Falha ao atualizar tenant." });
  }
};

export default { createTenant, deleteTenant, listTenants, getTenant, updateTenant };
