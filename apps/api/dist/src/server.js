"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const routes_1 = __importDefault(require("./routes"));
const routes_2 = __importDefault(require("./super-admin/routes"));
require("./prisma/client");
const httpErrors_1 = require("./utils/httpErrors");
// porta padrao utilizada pelo servidor HTTP; caso a variavel nao exista, usamos 3000
const PORT = Number(process.env.PORT) || 3000;
// instancia principal do Express, responsavel por receber e responder requisicoes HTTP
const app = (0, express_1.default)();
// middleware que converte payloads JSON em objetos JavaScript acessiveis via req.body
app.use(express_1.default.json());
// rota de super admin fica antes de qualquer verificação para criação isolada de tenants
app.use("/api/super-admin", routes_2.default);
// agrupamento das rotas HTTP da aplicacao sob o prefixo /api
app.use("/api", routes_1.default);
// tratador de erros padrao que traduz excecoes em respostas JSON
const errorHandler = (err, req, res) => {
    const httpError = (0, httpErrors_1.normalizeError)(err);
    console.error("Erro nao tratado:", {
        method: req.method,
        path: req.originalUrl ?? req.url,
        status: httpError.status,
        code: httpError.code,
        message: httpError.message,
        stack: err instanceof Error ? err.stack : undefined,
    });
    res.status(httpError.status).json((0, httpErrors_1.buildErrorBody)(httpError));
};
app.use(errorHandler);
// inicializa o servidor HTTP na porta definida, pronto para receber requisicoes externas
app.listen(PORT, () => {
    console.log(`API ativa na porta ${PORT}`);
});
//# sourceMappingURL=server.js.map