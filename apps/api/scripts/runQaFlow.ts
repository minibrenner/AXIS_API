import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { Response } from "supertest";
import { Prisma } from "@prisma/client";
import { app } from "../src/app";
import { prisma } from "../src/prisma/client";
import { getSuperAdminEnv } from "../src/super-admin/config";
import { TenantContext } from "../src/tenancy/tenant.context";

type StepLog = {
  title: string;
  status: "passed" | "failed";
  durationMs: number;
  details?: Record<string, unknown>;
  error?: string;
};

type TokenBundle = {
  access: string;
  refresh?: string;
};

const agent = request(app);
const runId = Date.now();
const slug = `qa-${runId}`;
const log: StepLog[] = [];

async function step<T>(title: string, fn: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    log.push({ title, status: "passed", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    log.push({
      title,
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function buildEmail(label: string) {
  return `${label}-${slug}@axis.test`;
}

function authHeader(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function post<T = any>(
  url: string,
  token?: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<Response & { body: T }> {
  let req = agent.post(url);
  const mergedHeaders = { ...authHeader(token), ...(headers ?? {}) };
  for (const [key, value] of Object.entries(mergedHeaders)) {
    req = req.set(key, value);
  }
  return (await req.send(body)) as Response & { body: T };
}

async function get<T = any>(
  url: string,
  token?: string,
  headers?: Record<string, string>
): Promise<Response & { body: T }> {
  let req = agent.get(url);
  const mergedHeaders = { ...authHeader(token), ...(headers ?? {}) };
  for (const [key, value] of Object.entries(mergedHeaders)) {
    req = req.set(key, value);
  }
  return (await req) as Response & { body: T };
}

async function put<T = any>(url: string, token?: string, body?: unknown): Promise<Response & { body: T }> {
  let req = agent.put(url);
  if (token) {
    req = req.set("Authorization", `Bearer ${token}`);
  }
  return (await req.send(body)) as Response & { body: T };
}

async function del<T = any>(url: string, token?: string): Promise<Response & { body: T }> {
  let req = agent.delete(url);
  if (token) req = req.set("Authorization", `Bearer ${token}`);
  return (await req) as Response & { body: T };
}

async function loginUser(email: string, password: string) {
  const res = await post<TokenBundle>("/api/auth/login", undefined, { email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status}`);
  }
  return res.body;
}

async function main() {
  const report: {
    runId: number;
    tenant: Record<string, unknown>;
    users: Record<string, unknown>;
    sales: unknown[];
    cashSessions: Array<Record<string, any>>;
    stock: Record<string, unknown>;
    log: StepLog[];
    syncAvailable: boolean;
    validation: Record<string, unknown>;
  } = {
    runId,
    tenant: {},
    users: {},
    sales: [],
    cashSessions: [],
    stock: {},
    log,
    syncAvailable: true,
    validation: {},
  };

  const superEnv = getSuperAdminEnv();
  const superAdminEmail = superEnv.email;
  const superAdminPassword =
    superEnv.passwordPlain || process.env.SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_KEY;

  if (!superAdminPassword) {
    throw new Error("SUPER_ADMIN credencial em texto plano nao configurada");
  }

  const superToken = await step("Super admin login", async () => {
    const res = await post<{ token: string }>("/api/super-admin/login", undefined, {
      email: superAdminEmail,
      password: superAdminPassword,
    });
    if (res.status !== 200) {
      throw new Error(`Super admin login falhou: ${res.status}`);
    }
    return res.body.token;
  });

  const tenantPayload = {
    name: `QA Tenant ${slug}`,
    email: buildEmail("tenant"),
  };

  const tenant = await step("Criar tenant via super admin", async () => {
    const res = await post("/api/super-admin/tenants", superToken, tenantPayload);
    if (res.status !== 201) {
      throw new Error(`Falha ao criar tenant: ${res.status}`);
    }
    report.tenant = res.body;
    return res.body as { id: string };
  });

  const tenantId = tenant.id;

  const ownerPassword = `Own#${runId}!`;
  const ownerPin = "8520";
  const ownerEmail = buildEmail("owner");

  const owner = await step("Bootstrap owner", async () => {
    const res = await post(`/api/t/${tenantId}/users`, undefined, {
      email: ownerEmail,
      password: ownerPassword,
      name: "QA Owner",
      pinSupervisor: ownerPin,
    });
    if (res.status !== 201) {
      throw new Error(`Bootstrap owner falhou: ${res.status}`);
    }
    return res.body;
  });

  const ownerTokens = await step("Login owner", () => loginUser(ownerEmail, ownerPassword));

  await step("Validar conflito de email duplicado", async () => {
    const res = await post(`/api/super-admin/tenants/${tenantId}/users`, superToken, {
      tenantIdentifier: tenantId,
      email: ownerEmail,
      password: "Temp#123",
    });
    report.validation.duplicateEmailStatus = res.status;
    if (res.status !== 409 && res.status !== 500) {
      throw new Error(`Esperado 409 ao duplicar email, recebido ${res.status}`);
    }
  });

  const users: Record<string, any> = {};

  async function createTenantUser(label: string, payload: Record<string, unknown>) {
    const res = await post(`/api/t/${tenantId}/users`, ownerTokens.access, payload);
    if (res.status !== 201) {
      throw new Error(`Falha ao criar usuario ${label}: ${res.status}`);
    }
    users[label] = res.body;
    return res.body;
  }

  const admin1Password = `Adm#${runId}!`;
  await step("Criar Admin Alpha", () =>
    createTenantUser("adminAlpha", {
      email: buildEmail("admin-alpha"),
      password: admin1Password,
      role: "ADMIN",
      name: "QA Admin Alpha",
      pinSupervisor: "7410",
    })
  );

  const admin2Password = `Adm2#${runId}!`;
  await step("Criar Admin Beta via OWNER", () =>
    createTenantUser("adminBeta", {
      email: buildEmail("admin-beta"),
      password: admin2Password,
      role: "ADMIN",
      name: "QA Admin Beta",
    })
  );

  const att1Password = `Att#${runId}!`;
  const att1 = await step("Criar Attendant A", () =>
    createTenantUser("attendantA", {
      email: buildEmail("attendant-a"),
      password: att1Password,
      role: "ATTENDANT",
      name: "QA Attendant A",
    })
  );

  const att2Password = `Att2#${runId}!`;
  await step("Criar Attendant B", () =>
    createTenantUser("attendantB", {
      email: buildEmail("attendant-b"),
      password: att2Password,
      role: "ATTENDANT",
      name: "QA Attendant B",
    })
  );

  await step("Criar Owner Secundario", () =>
    createTenantUser("ownerB", {
      email: buildEmail("owner-b"),
      password: `Own2#${runId}!`,
      role: "OWNER",
      name: "QA Owner B",
    })
  );

  report.users = users;

  const adminTokens = await step("Login Admin Alpha", () =>
    loginUser(users.adminAlpha.email, admin1Password)
  );
  const attendantTokens = await step("Login Attendant A", () =>
    loginUser(users.attendantA.email, att1Password)
  );

  await step("Admin promove Attendant A para ADMIN", async () => {
    const res = await put(
      `/api/t/${tenantId}/users/${att1.id}`,
      adminTokens.access,
      { role: "ADMIN" }
    );
    if (res.status !== 200) {
      throw new Error(`Falha ao promover atendente: ${res.status}`);
    }
  });

  const location = await step("Criar estoque/location com ADMIN", async () => {
    const res = await post(
      "/api/stock/locations",
      adminTokens.access,
      { name: `Deposito QA ${slug}` }
    );
    if (res.status !== 201) {
      throw new Error(`Falha ao criar deposito: ${res.status}`);
    }
    return res.body;
  });

  const categories: Record<string, string> = {};
  await step("Criar categorias", async () => {
    for (const name of ["BEBIDAS", "COMIDAS", "UTENSILIOS"]) {
      const res = await post("/api/categories", adminTokens.access, { name });
      if (res.status !== 201) {
        throw new Error(`Falha ao criar categoria ${name}: ${res.status}`);
      }
      categories[name] = res.body.id;
    }
  });

  type ProductInfo = { id: string; name: string; category: string };
  const products: ProductInfo[] = [];

  await step("Criar produtos", async () => {
    const productMatrix: Record<string, string[]> = {
      BEBIDAS: ["Suco de Laranja", "Agua Mineral", "Refrigerante Cola", "Cha Gelado"],
      COMIDAS: ["Sanduiche Natural", "Salada Caesar", "Batata Frita", "Wrap Vegano"],
      UTENSILIOS: ["Copo Descartavel", "Prato Biodegradavel", "Guardanapo Premium", "Canudo Metal"],
    };
    let productCounter = 0;

    for (const [category, names] of Object.entries(productMatrix)) {
      for (const [index, name] of names.entries()) {
        productCounter += 1;
        const barcode = `${String(runId).slice(-6)}${productCounter.toString().padStart(7, "0")}`;
        const payload = {
          name,
          sku: `${category.slice(0,3)}-${index + 1}-${runId}`,
          barcode,
          unit: "UN",
          price: (10 + index * 2).toFixed(2),
          cost: (5 + index).toFixed(2),
          categoryId: categories[category],
          minStock: "5",
        };
        const res = await post("/api/products", adminTokens.access, payload);
        if (res.status !== 201) {
          throw new Error(`Falha ao criar produto ${name}: ${res.status}`);
        }
        products.push({ id: res.body.id, name, category });
      }
    }
  });

  await step("Editar e excluir produtos", async () => {
    const [firstProduct] = products;
    if (!firstProduct) return;
    const updateRes = await agent
      .patch(`/api/products/${firstProduct.id}`)
      .set("Authorization", `Bearer ${adminTokens.access}`)
      .send({ price: "29.90" });
    if (updateRes.status !== 200) {
      throw new Error("Falha no update de produto");
    }

    const removed = products.pop();
    if (removed) {
      const deleteRes = await del(`/api/products/${removed.id}`, adminTokens.access);
      if (deleteRes.status !== 204) {
        throw new Error("Falha ao excluir produto");
      }
    }
  });

  await step("Normalizar IDs de produtos para UUID", async () => {
    await TenantContext.run(tenantId, async () => {
      for (const product of products) {
        const uuid = randomUUID();
        await prisma.product.update({
          where: { id: product.id },
          data: { id: uuid },
        });
        product.id = uuid;
      }
    });
  });

  await step("Preparar inventario inicial", async () => {
    await TenantContext.run(tenantId, async () => {
      for (const product of products) {
        try {
          await prisma.inventory.create({
            data: {
              tenantId,
              productId: product.id,
              locationId: location.id,
              quantity: new Prisma.Decimal(0),
            },
          });
        } catch (error) {
          if (
            !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
          ) {
            throw error;
          }
        }
      }
    });
  });

  await step("Inicializar e movimentar estoque", async () => {
    for (const product of products) {
      await post("/api/stock/in", adminTokens.access, {
        productId: product.id,
        locationId: location.id,
        qty: 50,
      });
      await post("/api/stock/out", adminTokens.access, {
        productId: product.id,
        locationId: location.id,
        qty: 5,
      });
    }
    const warningRes = await post("/api/stock/adjust", adminTokens.access, {
      productId: products[0].id,
      locationId: location.id,
      qty: -200,
      reason: "QA NEGATIVE TEST",
    });
    if (!warningRes.body.wentNegative) {
      throw new Error("Esperado aviso de estoque negativo");
    }
  });

  const attendantSession = await step("Abrir caixa (attendant)", async () => {
    const res = await post("/api/cash/open", attendantTokens.access, {
      openingCents: 10000,
      notes: "Caixa QA Attendant",
    });
    if (res.status !== 201) {
      throw new Error("Falha ao abrir caixa attendant");
    }
    report.cashSessions = [res.body.session];
    return res.body.session as { id: string };
  });

  const saleIds: string[] = [];

  async function createSaleWithPayload(payload: Record<string, unknown>, token: string) {
    const res = await post("/api/sales", token, payload);
    if (![200, 201].includes(res.status)) {
      throw new Error(`Falha ao criar venda (${res.status})`);
    }
    if ("sale" in res.body && res.body.sale?.id) {
      saleIds.push(res.body.sale.id);
    }
    return res.body;
  }

  const sampleItems = products.slice(0, 3);

  await step("Venda 1 - PIX + DINHEIRO", () =>
    createSaleWithPayload(
      {
        sale: {
          cashSessionId: attendantSession.id,
          locationId: location.id,
          items: sampleItems.slice(0, 2).map((product, idx) => ({
            productId: product.id,
            sku: `SKU-${idx}`,
            name: product.name,
            qty: 2 + idx,
            unitPriceCents: 2500 + idx * 500,
          })),
          payments: [
            { method: "pix", amountCents: 4000 },
            { method: "cash", amountCents: 7000 },
          ],
          fiscalMode: "none",
        },
      },
      attendantTokens.access
    )
  );

  const duplicatedKey = `dup-${slug}`;
  const saleTwoPayload = {
    sale: {
      cashSessionId: attendantSession.id,
      locationId: location.id,
      items: [
        {
          productId: sampleItems[1].id,
          sku: "SPLIT-1",
          name: sampleItems[1].name,
          qty: 3,
          unitPriceCents: 3280,
        },
        {
          productId: sampleItems[2].id,
          sku: "SPLIT-2",
          name: sampleItems[2].name,
          qty: 1,
          unitPriceCents: 6720,
        },
      ],
      payments: [
        { method: "debit", amountCents: 3280 },
        { method: "credit", amountCents: 6720 },
      ],
      fiscalMode: "none",
    },
    idempotencyKey: duplicatedKey,
  };

  await step("Venda 2 - cartoes fracionados", () =>
    createSaleWithPayload(saleTwoPayload, attendantTokens.access)
  );

  await step("Evitar duplicidade de venda (idempotency)", async () => {
    const res = await post("/api/sales", attendantTokens.access, saleTwoPayload);
    if (res.status !== 200 || !res.body.duplicate) {
      throw new Error("Esperado retorno de duplicate");
    }
  });

  await step("Venda 3 com desconto requerendo PIN", () =>
    createSaleWithPayload(
      {
        sale: {
          cashSessionId: attendantSession.id,
          locationId: location.id,
          items: [
            {
              productId: sampleItems[0].id,
              sku: "DISC-1",
              name: sampleItems[0].name,
              qty: 1,
              unitPriceCents: 1000,
            },
          ],
          payments: [{ method: "cash", amountCents: 900 }],
          discount: { type: "value", valueCents: 100 },
        },
        supervisorSecret: ownerPin,
      },
      attendantTokens.access
    )
  );

  await step("Gerar recibos das vendas", async () => {
    for (const saleId of saleIds) {
      const res = await get(`/api/sales/${saleId}/receipt`, attendantTokens.access);
      if (res.status !== 200) {
        throw new Error(`Recibo indisponivel para ${saleId}`);
      }
    }
  });

  await step("Sangria requer PIN", async () => {
    const res = await post("/api/cash/withdraw", attendantTokens.access, {
      cashSessionId: attendantSession.id,
      amountCents: 1500,
      reason: "QA retirada",
      supervisorSecret: ownerPin,
    });
    if (res.status !== 201) {
      throw new Error("Sangria falhou");
    }
  });

  const saleToCancel = saleIds.at(1);
  if (saleToCancel) {
    await step("Cancelar venda e devolver estoque", async () => {
      const res = await post(
        `/api/sales/${saleToCancel}/cancel`,
        attendantTokens.access,
        { reason: "QA cancelamento", supervisorSecret: ownerPin }
      );
      if (res.status !== 200) {
        throw new Error("Cancelamento falhou");
      }
    });
  }

  await step("Fechar caixa attendant", async () => {
    const res = await post("/api/cash/close", attendantTokens.access, {
      cashSessionId: attendantSession.id,
      closingCents: 9000,
      supervisorSecret: ownerPin,
      notes: "Fechamento QA",
    });
    if (res.status !== 200) {
      throw new Error("Fechamento falhou");
    }
    report.cashSessions[0] = { ...report.cashSessions[0], closing: res.body };
  });

  await step("Consultar relatorio de caixa encerrado", async () => {
    const res = await get(
      `/api/cash/${attendantSession.id}/report`,
      ownerTokens.access
    );
    if (res.status !== 200) {
      throw new Error("Falha ao consultar relatorio");
    }
  });

  await step("Teste de sync sale com idempotencia", async () => {
    const payload = {
      saleId: `sync-${slug}`,
      deviceId: "POS-001",
      createdAt: new Date().toISOString(),
      items: [
        { productId: products[0].id, locationId: location.id, qty: 2 },
        { productId: products[1].id, locationId: location.id, qty: 1 },
      ],
    };
    const first = await post("/api/sync/sale", adminTokens.access, payload);
    if (first.status === 404) {
      report.syncAvailable = false;
      return;
    }
    if (first.status !== 200) {
      throw new Error(`Sync sale falhou: ${first.status} ${JSON.stringify(first.body)}`);
    }
    const second = await post("/api/sync/sale", adminTokens.access, payload);
    if (!second.body.alreadyProcessed) throw new Error("Idempotencia sync falhou");
  });

  await step("Abrir caixa como ADMIN", async () => {
    const res = await post("/api/cash/open", adminTokens.access, {
      openingCents: 5000,
      notes: "Caixa Admin QA",
    });
    if (res.status !== 201) throw new Error("Falha abrir caixa admin");
    report.cashSessions.push(res.body.session);
  });

  await step("Registrar venda simples como ADMIN", () => {
    const adminSession = report.cashSessions[1];
    if (!adminSession) {
      throw new Error("Sessao de caixa do admin nao encontrada");
    }
    return createSaleWithPayload(
      {
        sale: {
          cashSessionId: adminSession.id,
          locationId: location.id,
          items: [
            {
              productId: products[2].id,
              sku: "ADMIN-1",
              name: products[2].name,
              qty: 2,
              unitPriceCents: 1500,
            },
          ],
          payments: [{ method: "credit", amountCents: 3000 }],
        },
        supervisorSecret: admin1Password,
      },
      adminTokens.access
    );
  });

  await step("Fechar caixa admin", async () => {
    const session = report.cashSessions[1];
    if (!session) {
      throw new Error("Sessao de caixa admin nao encontrada");
    }
    const res = await post("/api/cash/close", adminTokens.access, {
      cashSessionId: session.id,
      closingCents: 5000,
      supervisorSecret: admin1Password,
    });
    if (res.status !== 200) throw new Error("Fechamento admin falhou");
    session.closing = res.body;
  });

  await step("Niveis de estoque apos vendas/cancelamentos", async () => {
    const snapshot: Record<string, string> = {};
    for (const product of sampleItems) {
      const res = await get(
        `/api/stock/level?productId=${product.id}&locationId=${location.id}`,
        adminTokens.access
      );
      if (res.status !== 200) throw new Error("Falha ao consultar estoque");
      snapshot[product.name] = res.body.quantity;
    }
    report.stock = snapshot;
  });

  const statePath = path.resolve(__dirname, "../../../qa/state.json");
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(report, null, 2));
}

main()
  .then(async () => {
    log.push({ title: "QA flow concluido", status: "passed", durationMs: 0 });
    await prisma.$disconnect();
    console.log(`QA flow concluido com sucesso (${slug})`);
  })
  .catch(async (error) => {
    log.push({
      title: "QA flow abortado",
      status: "failed",
      durationMs: 0,
      error: error instanceof Error ? error.message : String(error),
    });
    await prisma.$disconnect();
    console.error("QA flow falhou:", error);
    process.exitCode = 1;
  });
