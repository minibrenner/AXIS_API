import request from "supertest";
import { app } from "../src/app";
import { getSuperAdminEnv } from "../src/super-admin/config";

const agent = request(app);

async function superAdminLogin() {
  const env = getSuperAdminEnv();
  const res = await agent.post("/api/super-admin/login").send({
    email: env.email,
    password: env.passwordPlain ?? env.passwordHash ?? "",
  });
  if (res.status !== 200) throw new Error(`Super admin login falhou (${res.status})`);
  return res.body.token as string;
}

async function main() {
  const slug = `cust-${Date.now()}`;
  const superToken = await superAdminLogin();

  // cria tenant
  const tenantRes = await agent
    .post("/api/super-admin/tenants")
    .set("Authorization", `Bearer ${superToken}`)
    .send({ name: `Customer QA ${slug}`, email: `${slug}@tenant.test` });
  if (tenantRes.status !== 201) throw new Error(`Falha ao criar tenant (${tenantRes.status})`);
  const tenantId = tenantRes.body.id as string;

  // bootstrap owner
  const ownerEmail = `owner-${slug}@qa.test`;
  const ownerPassword = "Owner#123";
  await agent.post(`/api/t/${tenantId}/users`).send({
    email: ownerEmail,
    password: ownerPassword,
    name: "Owner QA",
    pinSupervisor: "1234",
  });

  const ownerLogin = await agent.post("/api/auth/login").send({ email: ownerEmail, password: ownerPassword });
  const ownerToken = ownerLogin.body.access as string;

  // cria admin
  const adminEmail = `admin-${slug}@qa.test`;
  const adminPassword = "Admin#123";
  await agent
    .post(`/api/t/${tenantId}/users`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      email: adminEmail,
      password: adminPassword,
      role: "ADMIN",
      name: "Admin QA",
      pinSupervisor: "5678",
    });
  const adminLogin = await agent.post("/api/auth/login").send({ email: adminEmail, password: adminPassword });
  const adminToken = adminLogin.body.access as string;

  // cria atendente
  const attEmail = `att-${slug}@qa.test`;
  const attPassword = "Att#123";
  await agent
    .post(`/api/t/${tenantId}/users`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      email: attEmail,
      password: attPassword,
      role: "ATTENDANT",
      name: "Atendente QA",
    });
  const attLogin = await agent.post("/api/auth/login").send({ email: attEmail, password: attPassword });
  const attToken = attLogin.body.access as string;

  // cria customer com limite
  const createCustomer = await agent
    .post("/api/customers")
    .set("Authorization", `Bearer ${adminToken}`)
    .set("x-tenant-id", tenantId)
    .send({
      name: "Cliente Demo",
      document: "000.000.000-00",
      allowCredit: true,
      creditLimit: "500.00",
      defaultDueDays: 30,
    });
  if (createCustomer.status !== 201) throw new Error("Falha ao criar cliente");
  const customerId = createCustomer.body.id as string;
  console.log("Cliente criado:", {
    id: customerId,
    allowCredit: createCustomer.body.allowCredit,
    creditLimit: createCustomer.body.creditLimit,
  });

  // consulta lista
  const listRes = await agent
    .get("/api/customers")
    .set("Authorization", `Bearer ${adminToken}`)
    .set("x-tenant-id", tenantId);
  if (!Array.isArray(listRes.body) || !listRes.body.length) throw new Error("Lista de clientes vazia");

  // charge dentro do limite
  const idempotencyKey = `charge-${slug}`;
  const chargePayload = {
    amount: 120,
    description: "Compra 1",
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
  };
  const chargeRes = await agent
    .post(`/api/customers/${customerId}/ledger/charge`)
    .set("Authorization", `Bearer ${attToken}`)
    .set("x-tenant-id", tenantId)
    .set("Idempotency-Key", idempotencyKey)
    .send(chargePayload);
  if (chargeRes.status !== 201) throw new Error(`Charge falhou (${chargeRes.status})`);

  // idempotência
  const chargeDup = await agent
    .post(`/api/customers/${customerId}/ledger/charge`)
    .set("Authorization", `Bearer ${attToken}`)
    .set("x-tenant-id", tenantId)
    .set("Idempotency-Key", idempotencyKey)
    .send(chargePayload);
  if (chargeDup.body.id !== chargeRes.body.id) throw new Error("Idempotency falhou");

  // charge adicional para quase atingir limite
  await agent
    .post(`/api/customers/${customerId}/ledger/charge`)
    .set("Authorization", `Bearer ${attToken}`)
    .set("x-tenant-id", tenantId)
    .send({ amount: 350, description: "Compra 2" });

  // tentativa que excede limite deve falhar
  const overLimit = await agent
    .post(`/api/customers/${customerId}/ledger/charge`)
    .set("Authorization", `Bearer ${attToken}`)
    .set("x-tenant-id", tenantId)
    .send({ amount: 200, description: "Acima do limite" });
  if (overLimit.status !== 403) throw new Error("Esperado bloqueio por limite");

  // payment
  const paymentRes = await agent
    .post(`/api/customers/${customerId}/ledger/payment`)
    .set("Authorization", `Bearer ${adminToken}`)
    .set("x-tenant-id", tenantId)
    .send({ amount: 100, method: "cash" });
  if (paymentRes.status !== 201) throw new Error("Payment falhou");

  // statement JSON
  const statementRes = await agent
    .get(`/api/customers/${customerId}/ledger/statement`)
    .set("Authorization", `Bearer ${adminToken}`)
    .set("x-tenant-id", tenantId);
  if (statementRes.status !== 200 || !statementRes.body.items?.length) throw new Error("Statement JSON falhou");

  // PDF
  const pdfRes = await agent
    .get(`/api/customers/${customerId}/ledger/statement.pdf`)
    .set("Authorization", `Bearer ${adminToken}`)
    .set("x-tenant-id", tenantId);
  if (pdfRes.status !== 200 || pdfRes.header["content-type"] !== "application/pdf") {
    throw new Error("Statement PDF nao gerado");
  }

  console.log("Fluxo de clientes/crediario validado com sucesso 🎉");
}

main().catch((err) => {
  console.error("Teste de customers falhou:", err);
  process.exit(1);
});
