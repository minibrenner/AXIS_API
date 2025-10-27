import { Router } from "express";
import {
  createTenant,
  deleteTenant,
  getTenant,
  listTenants,
  updateTenant,
} from "../controllers/tenants.controller";

/**
 * Router responsavel por endpoints administrativos.
 * Aqui ficam rotas que nao dependem de um tenant ja existente.
 */
const adminRouter = Router();

// POST /api/admin/tenants -> cria um novo tenant na plataforma
adminRouter.post("/tenants", createTenant);

// DELETE /api/admin/tenants/:id -> remove um tenant existente
adminRouter.delete("/tenants/:id", deleteTenant);

// GET /api/admin/tenants -> lista todos os tenants cadastrados
adminRouter.get("/tenants", listTenants);

// GET /api/admin/tenants/:id -> obtem um tenant especifico
adminRouter.get("/tenants/:id", getTenant);

// PUT /api/admin/tenants/:id -> atualiza os dados de um tenant
adminRouter.put("/tenants/:id", updateTenant);

export default adminRouter;

