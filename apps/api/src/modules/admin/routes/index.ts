import { Router } from "express";
import { createTenant } from "../controllers/tenants.controller";

/**
 * Router responsável por endpoints administrativos.
 * Aqui ficam rotas que não dependem de um tenant já existente.
 */
const adminRouter = Router();

// POST /api/admin/tenants -> cria um novo tenant na plataforma
adminRouter.post("/tenants", createTenant);

export default adminRouter;
