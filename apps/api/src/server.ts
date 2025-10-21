import express from "express";
import { tenantMiddleware } from "./tenancy/tenant.middleware";
// import seu authMiddleware que popula req.user antes do tenantMiddleware
import { prisma } from "./prisma/client"; // ✅

import routes from "./routes";


const app = express();
app.use(express.json());

// 1) auth que decodifica JWT e coloca req.user
// app.use(authMiddleware);

// 2) tenant: precisa vir depois do auth
app.use(tenantMiddleware);

// 3) rotas
app.use("/api", routes);

// 4) tratador de erros
app.use((err: any, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message ?? "Erro" });
});

app.listen(process.env.PORT ?? 3000, () => {
  console.log("API on", process.env.PORT ?? 3000);
});
