import { Router } from "express";

/**
 * Router responsavel por endpoints administrativos.
 * Aqui ficam rotas que nao dependem de um tenant ja existente.
 */
const adminRouter = Router();

adminRouter.get("/__ping", (_req, res) => res.json({ ok: true, area: "admin" }));

export default adminRouter;
