import { Router } from "express";
import { prisma } from "./prisma/client"; // usa nosso client com extensão

const r = Router();

// POST /api/users  -> cria usuário no tenant atual
r.post("/users", async (req, res) => {
  const { email, passwordHash, role = "ATTENDANT" } = req.body;

  // vem do tenantMiddleware (header x-tenant-id em dev, ou do JWT)
  const tenantId = req.tenantId!;
  const user = await prisma.user.create({
    data: { tenantId, email, passwordHash, role },
  });

  res.status(201).json(user);
});

// GET /api/users  -> lista do tenant atual
r.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  res.json(users);
});

export default r;
