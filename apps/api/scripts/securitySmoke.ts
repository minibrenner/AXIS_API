import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { app } from "../src/app";

type StepLog = {
  title: string;
  status: "passed" | "failed";
  durationMs: number;
  details?: Record<string, unknown>;
  error?: string;
};

const agent = request(app);

async function step(title: string, fn: () => Promise<void>, log: StepLog[]) {
  const startedAt = Date.now();
  try {
    await fn();
    log.push({ title, status: "passed", durationMs: Date.now() - startedAt });
  } catch (error) {
    const failed: StepLog = {
      title,
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
    if (error && typeof error === "object" && "response" in error) {
      const response = (error as { response?: request.Response }).response;
      if (response) {
        failed.details = { status: response.status, body: response.body };
      }
    }
    log.push(failed);
  }
}

async function login(email: string, password: string) {
  const res = await agent.post("/api/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Falha ao autenticar ${email}: ${res.status}`);
  }
  return res.body.access as string;
}

async function main() {
  const statePath = path.resolve(__dirname, "../../../qa/state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf-8")) as {
    runId: number;
    tenant: { id: string };
  };
  const runId = state.runId;
  const slug = `qa-${runId}`;
  const tenantId = state.tenant.id;

  const ownerEmail = `owner-${slug}@axis.test`;
  const ownerPassword = `Own#${runId}!`;
  const attendantBEmail = `attendant-b-${slug}@axis.test`;
  const attendantBPassword = `Att2#${runId}!`;

  const log: StepLog[] = [];

  await step("Sem token em /api/categories => 401", async () => {
    await agent.get("/api/categories").expect(401);
  }, log);

  await step("Bootstrap bloqueado sem token apos owner inicial", async () => {
    await agent
      .post(`/api/t/${tenantId}/users`)
      .send({ email: "late-owner@example.com", password: "Temp@123" })
      .expect(401);
  }, log);

  const attendantToken = await login(attendantBEmail, attendantBPassword);

  await step("ATTENDANT nao cria usuarios", async () => {
    const payload = {
      email: `att-smoke-${Date.now()}@axis.test`,
      password: "Tmp#12345",
      role: "ADMIN",
    };
    const res = await agent
      .post(`/api/t/${tenantId}/users`)
      .set("Authorization", `Bearer ${attendantToken}`)
      .send(payload);

    if (res.status !== 403) {
      const error: Error & { response?: request.Response } = new Error(`Esperado 403, recebido ${res.status}`);
      error.response = res;
      throw error;
    }
  }, log);

  await step("Token invalido em /api/customers => 401", async () => {
    await agent
      .get("/api/customers")
      .set("Authorization", "Bearer invalid.token")
      .set("x-tenant-id", tenantId)
      .expect(401);
  }, log);

  const ownerToken = await login(ownerEmail, ownerPassword);

  await step("Tenant mismatch bloqueado", async () => {
    const seededAdmin = await login("admin.qa@axis.local", "Axis#123");
    await agent
      .get(`/api/t/${tenantId}/users`)
      .set("Authorization", `Bearer ${seededAdmin}`)
      .expect(403);
  }, log);

  await step("Super admin guard exige token", async () => {
    await agent.get("/api/super-admin/tenants").expect(401);
  }, log);

  console.table(
    log.map((entry) => ({
      title: entry.title,
      status: entry.status,
      durationMs: entry.durationMs,
      error: entry.error,
      details: entry.details,
    }))
  );

  const failed = log.filter((entry) => entry.status === "failed");
  if (failed.length) {
    console.dir({ failed }, { depth: null });
    process.exitCode = 1;
  } else {
    console.log("Security smoke OK");
  }
}

main().catch((err) => {
  console.error("Security smoke falhou:", err);
  process.exit(1);
});
