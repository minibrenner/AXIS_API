"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
/**
 * Router responsavel por endpoints administrativos.
 * Aqui ficam rotas que nao dependem de um tenant ja existente.
 */
const adminRouter = (0, express_1.Router)();
adminRouter.get("/__ping", (_req, res) => res.json({ ok: true, area: "admin" }));
exports.default = adminRouter;
//# sourceMappingURL=index.js.map