import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import argon2 from "argon2";
import { app } from "../src/app";
import { basePrisma } from "../src/prisma/client";
import * as mailer from "../src/utils/mailer";

const tenantId = randomUUID();
const tenantEmail = `tenant-${tenantId}@example.com`;
const userId = randomUUID();
const userEmail = `reset-${tenantId}@example.com`;
const initialPassword = "OldPass123!";

describe("Password reset flow", () => {
  beforeAll(async () => {
    await basePrisma.tenant.create({
      data: {
        id: tenantId,
        name: `Tenant ${tenantId}`,
        email: tenantEmail,
        isActive: true,
      },
    });

    const passwordHash = await argon2.hash(initialPassword);
    await basePrisma.user.create({
      data: {
        id: userId,
        tenantId,
        email: userEmail,
        passwordHash,
        role: "ADMIN",
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await basePrisma.passwordResetToken.deleteMany({ where: { userId } });
    await basePrisma.session.deleteMany({ where: { userId } });
    await basePrisma.user.delete({ where: { id: userId } });
    await basePrisma.tenant.delete({ where: { id: tenantId } });
  });

  it("allows requesting and consuming a reset token", async () => {
    const spy = vi.spyOn(mailer, "sendPasswordResetEmail").mockResolvedValue();

    const forgot = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: userEmail });

    expect(forgot.status).toBe(200);
    expect(spy).toHaveBeenCalled();

    const resetUrl = spy.mock.calls.at(-1)?.[0]?.resetUrl as string;
    expect(resetUrl).toBeDefined();

    const token = new URL(resetUrl).searchParams.get("token");
    expect(token).not.toBeNull();

    const newPassword = "NovaSenha123!";
    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword });

    expect(reset.status).toBe(200);
    expect(reset.body.message).toMatch(/Senha redefinida/);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: userEmail, password: newPassword });

    expect(login.status).toBe(200);
    expect(login.body).toHaveProperty("access");
    expect(login.body).toHaveProperty("refresh");

    spy.mockRestore();
  });
});
