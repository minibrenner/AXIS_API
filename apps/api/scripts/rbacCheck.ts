import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { app } from "../src/app";

const agent = request(app);

async function login(email: string, password: string) {
  const res = await agent.post("/api/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login falhou para ${email}: ${res.status}`);
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

  const attendantEmail = `attendant-b-${slug}@axis.test`;
  const attendantPassword = `Att2#${runId}!`;
  const ownerEmail = `owner-${slug}@axis.test`;
  const ownerPassword = `Own#${runId}!`;

  const attendantToken = await login(attendantEmail, attendantPassword);
  const ownerToken = await login(ownerEmail, ownerPassword);

  // Attendant should NOT be able to create stock locations (ADMIN/OWNER only)
  const locationName = `RBAC Loc ${Date.now()}`;
  const attendantAttempt = await agent
    .post("/api/stock/locations")
    .set("Authorization", `Bearer ${attendantToken}`)
    .send({ name: locationName });

  console.log("Attendant status @stock/locations:", attendantAttempt.status);
  console.dir(attendantAttempt.body, { depth: null });

  if (attendantAttempt.status !== 403) {
    process.exitCode = 1;
    return;
  }

  const ownerCreate = await agent
    .post("/api/stock/locations")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: locationName });

  console.log("Owner status @stock/locations:", ownerCreate.status);
  console.dir(ownerCreate.body, { depth: null });
}

main().catch((err) => {
  console.error("RBAC check falhou:", err);
  process.exit(1);
});
