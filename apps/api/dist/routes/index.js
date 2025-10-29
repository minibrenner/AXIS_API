"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const routes_1 = __importDefault(require("../modules/tenant/routes"));
const routes_2 = __importDefault(require("../modules/admin/routes")); // confirme o caminho
/**
 * Router raiz da API. Este arquivo concentra a uniao de todos os sub-routers
 * da aplicacao para que o servidor (`server.ts`) tenha um unico ponto de importacao.
 */
const router = (0, express_1.Router)();
/**
 * Agrupa rotas relacionadas a tenants sob o prefixo `/tenant`.
 * Resultado final: endpoints expostos como `/api/tenant/...`.
 */
router.use("/tenant", routes_1.default);
router.use("/admin", routes_2.default); // expõe /api/admin/...
exports.default = router;
//# sourceMappingURL=index.js.map