"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tenant_middleware_1 = require("./tenancy/tenant.middleware");
const routes_1 = __importDefault(require("./modules/admin/routes"));
const routes_2 = __importDefault(require("./routes"));
require("./prisma/client");
// porta padrao utilizada pelo servidor HTTP; caso a variavel nao exista, usamos 3000
const PORT = Number(process.env.PORT) || 3000;
// instancia principal do Express, responsavel por receber e responder requisicoes HTTP
const app = (0, express_1.default)();
// middleware que converte payloads JSON em objetos JavaScript acessiveis via req.body
app.use(express_1.default.json());
// rotas administrativas nao dependem de tenant e devem ser registradas antes do middleware multi-tenant
app.use("/api/admin", routes_1.default);
// middleware de autenticacao deve vir antes (descomente quando estiver implementado)
// app.use(authMiddleware); // garante que tenantMiddleware receba o usuario ja autenticado
// middleware que injeta o tenant atual no contexto do Prisma para rotas que dependem dele
app.use("/api/auth", tenant_middleware_1.tenantMiddleware);
app.use("/api/t/:tenantId", tenant_middleware_1.tenantMiddleware);
// agrupamento das rotas HTTP da aplicacao sob o prefixo /api
app.use("/api", routes_2.default);
// tratador de erros padrao que traduz excecoes em respostas JSON
const errorHandler = (err, _req, res) => {
    console.error("Erro nao tratado:", err);
    res.status(400).json({ error: err instanceof Error ? err.message : "Erro inesperado" });
};
app.use(errorHandler);
// inicializa o servidor HTTP na porta definida, pronto para receber requisicoes externas
app.listen(PORT, () => {
    console.log(`API ativa na porta ${PORT}`);
});
//# sourceMappingURL=server.js.map