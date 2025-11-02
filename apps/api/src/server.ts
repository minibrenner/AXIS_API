import express, { type ErrorRequestHandler } from "express";
import { tenantMiddleware } from "./tenancy/tenant.middleware";
import adminRoutes from "./modules/admin/routes";
import routes from "./routes";
import "./prisma/client";

// porta padrao utilizada pelo servidor HTTP; caso a variavel nao exista, usamos 3000
const PORT = Number(process.env.PORT) || 3000;

// instancia principal do Express, responsavel por receber e responder requisicoes HTTP
const app = express();

// middleware que converte payloads JSON em objetos JavaScript acessiveis via req.body
app.use(express.json());

// rotas administrativas nao dependem de tenant e devem ser registradas antes do middleware multi-tenant
app.use("/api/admin", adminRoutes);

// middleware de autenticacao deve vir antes (descomente quando estiver implementado)
// app.use(authMiddleware); // garante que tenantMiddleware receba o usuario ja autenticado

// middleware que injeta o tenant atual no contexto do Prisma para rotas que dependem dele
app.use("/api/auth", tenantMiddleware);
app.use("/api/t/:tenantId", tenantMiddleware);

// agrupamento das rotas HTTP da aplicacao sob o prefixo /api
app.use("/api", routes);

// tratador de erros padrao que traduz excecoes em respostas JSON
const errorHandler: ErrorRequestHandler = (err, _req, res) => {
  console.error("Erro nao tratado:", err);
  res.status(400).json({ error: err instanceof Error ? err.message : "Erro inesperado" });
};

app.use(errorHandler);

// inicializa o servidor HTTP na porta definida, pronto para receber requisicoes externas
app.listen(PORT, () => {
  console.log(`API ativa na porta ${PORT}`);
});
