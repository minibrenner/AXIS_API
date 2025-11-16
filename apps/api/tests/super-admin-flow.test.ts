import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";

type TenantRecord = {
  id: string;
  name: string;
  email: string;
  cnpj?: string | null;
  cpfResLoja?: string | null;
  ownerUserId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type UserRecord = {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  name?: string | null;
  role: "OWNER" | "ADMIN" | "ATTENDANT";
  isActive: boolean;
  mustChangePassword: boolean;
  pinSupervisor?: string | null;
  createdAt: Date;
  updatedAt: Date;
  passwordUpdatedAt: Date;
};

type SessionRecord = {
  id: string;
  tenantId: string;
  userId: string;
  refreshHash: string;
  userAgent?: string | null;
  ip?: string | null;
  expiresAt: Date;
  createdAt: Date;
};

const database = {
  tenants: [] as TenantRecord[],
  users: [] as UserRecord[],
  sessions: [] as SessionRecord[],
};

function cloneWithSelect<T extends Record<string, any>>(record: T, select?: Record<string, boolean>) {
  if (!select) {
    return { ...record };
  }

  const output: Record<string, any> = {};
  for (const [key, value] of Object.entries(select)) {
    if (value) {
      output[key] = record[key];
    }
  }
  return output;
}

function matchesWhere<T extends Record<string, any>>(record: T, where?: Record<string, any>) {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => record[key] === value);
}

vi.mock("../src/prisma/client", () => {
  const prisma = {
    tenant: {
      async findUnique(args: { where: Record<string, any>; select?: Record<string, boolean> }) {
        const tenant = database.tenants.find((item) => matchesWhere(item, args.where));
        return tenant ? cloneWithSelect(tenant, args.select) : null;
      },
      async create(args: { data: Record<string, any>; select?: Record<string, boolean> }) {
        const now = new Date();
        const tenant: TenantRecord = {
          id: args.data.id ?? randomUUID(),
          name: args.data.name,
          email: args.data.email,
          cnpj: args.data.cnpj ?? null,
          cpfResLoja: args.data.cpfResLoja ?? null,
          ownerUserId: args.data.ownerUserId ?? null,
          isActive: args.data.isActive ?? true,
          createdAt: now,
          updatedAt: now,
        };
        database.tenants.push(tenant);
        return cloneWithSelect(tenant, args.select);
      },
      async update(args: { where: Record<string, any>; data: Record<string, any>; select?: Record<string, boolean> }) {
        const tenant = database.tenants.find((item) => matchesWhere(item, args.where));
        if (!tenant) {
          const error = new Error("Tenant not found");
          (error as any).code = "P2025";
          throw error;
        }
        Object.assign(tenant, args.data);
        tenant.updatedAt = new Date();
        return cloneWithSelect(tenant, args.select);
      },
      async delete(args: { where: Record<string, any> }) {
        const index = database.tenants.findIndex((item) => matchesWhere(item, args.where));
        if (index === -1) {
          const error = new Error("Tenant not found");
          (error as any).code = "P2025";
          throw error;
        }
        database.tenants.splice(index, 1);
        return { count: 1 };
      },
      async findMany() {
        return database.tenants.map((tenant) => ({ ...tenant }));
      },
    },
    user: {
      async create(args: { data: Record<string, any>; select?: Record<string, boolean> }) {
        const now = new Date();
        const user: UserRecord = {
          id: args.data.id ?? randomUUID(),
          tenantId: args.data.tenantId,
          email: args.data.email,
          passwordHash: args.data.passwordHash,
          name: args.data.name ?? null,
          role: args.data.role,
          isActive: args.data.isActive ?? true,
          mustChangePassword: args.data.mustChangePassword ?? false,
          pinSupervisor: args.data.pinSupervisor ?? null,
          createdAt: now,
          updatedAt: now,
          passwordUpdatedAt: now,
        };
        database.users.push(user);
        return cloneWithSelect(user, args.select);
      },
      async count(args: { where?: Record<string, any> }) {
        return database.users.filter((user) => matchesWhere(user, args.where)).length;
      },
      async findFirst(args: { where?: Record<string, any>; select?: Record<string, boolean> }) {
        const user = database.users.find((item) => matchesWhere(item, args.where));
        return user ? cloneWithSelect(user, args.select) : null;
      },
      async findMany(args: { where?: Record<string, any>; select?: Record<string, boolean> }) {
        return database.users
          .filter((user) => matchesWhere(user, args.where))
          .map((user) => cloneWithSelect(user, args.select));
      },
      async updateMany(args: { where: Record<string, any>; data: Record<string, any> }) {
        let count = 0;
        for (const user of database.users) {
          if (matchesWhere(user, args.where)) {
            Object.assign(user, args.data);
            user.updatedAt = new Date();
            count += 1;
          }
        }
        return { count };
      },
      async deleteMany(args: { where: Record<string, any> }) {
        const before = database.users.length;
        database.users = database.users.filter((user) => !matchesWhere(user, args.where));
        return { count: before - database.users.length };
      },
    },
    session: {
      async create(args: { data: Record<string, any> }) {
        const session: SessionRecord = {
          id: args.data.id ?? randomUUID(),
          tenantId: args.data.tenantId,
          userId: args.data.userId,
          refreshHash: args.data.refreshHash,
          userAgent: args.data.userAgent ?? null,
          ip: args.data.ip ?? null,
          expiresAt: args.data.expiresAt,
          createdAt: args.data.createdAt ?? new Date(),
        };
        database.sessions.push(session);
        return { ...session };
      },
      async findMany(args: { where?: Record<string, any> }) {
        return database.sessions
          .filter((session) => matchesWhere(session, args.where))
          .map((session) => ({ ...session }));
      },
      async deleteMany(args: { where: Record<string, any> }) {
        const before = database.sessions.length;
        database.sessions = database.sessions.filter((session) => !matchesWhere(session, args.where));
        return { count: before - database.sessions.length };
      },
    },
  };

  const basePrisma = {
    user: {
      findFirst: (args: { where?: Record<string, any>; select?: Record<string, boolean> }) =>
        prisma.user.findFirst(args),
    },
  };

  return { prisma, basePrisma };
});

import { app } from "../src/app";

const superAdminCredentials = {
  email: process.env.SUPER_ADMIN_EMAIL ?? "lucas-brenner@hotmail.com",
  password: process.env.SUPER_ADMIN_PASSWORD ?? "Lu102030@",
};

describe("super admin + tenant user flows", () => {
  beforeEach(() => {
    database.tenants.length = 0;
    database.users.length = 0;
    database.sessions.length = 0;
  });

  async function loginSuperAdmin() {
    const response = await request(app).post("/api/super-admin/login").send(superAdminCredentials).expect(200);
    expect(response.body.token).toBeDefined();
    return response.body.token as string;
  }

  it("creates tenant, bootstrap owner, admins and attendants respecting role policies", async () => {
    const superToken = await loginSuperAdmin();

    const tenantResponse = await request(app)
      .post("/api/super-admin/tenants")
      .set("Authorization", `Bearer ${superToken}`)
      .send({
        name: "Tenant QA",
        email: "tenant-qa@example.com",
      })
      .expect(201);

    const tenantId = tenantResponse.body.id as string;
    expect(tenantId).toBeTruthy();

    const ownerEmail = "owner.qa@example.com";
    const ownerPassword = "Owner@123";

    const bootstrapOwner = await request(app)
      .post(`/api/t/${tenantId}/users`)
      .send({
        email: ownerEmail,
        password: ownerPassword,
        name: "QA Owner",
      })
      .expect(201);

    expect(bootstrapOwner.body.role).toBe("OWNER");

    async function loginUser(email: string, password: string) {
      const response = await request(app).post("/api/auth/login").send({ email, password }).expect(200);
      expect(response.body.access).toBeTruthy();
      return response.body.access as string;
    }

    const ownerAccess = await loginUser(ownerEmail, ownerPassword);

    async function createWithToken(
      token: string,
      payload: { email: string; password: string; name?: string; role: "ADMIN" | "ATTENDANT" | "OWNER" }
    ) {
      const response = await request(app)
        .post(`/api/t/${tenantId}/users`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: payload.name ?? payload.email.split("@")[0], ...payload })
        .expect(201);
      expect(response.body.role).toBe(payload.role);
      return payload;
    }

    const ownerCreatedAdmin = await createWithToken(ownerAccess, {
      email: "admin.one@example.com",
      password: "AdminOne@123",
      role: "ADMIN",
    });

    const ownerCreatedAttendant = await createWithToken(ownerAccess, {
      email: "attendant.one@example.com",
      password: "Attendant@123",
      role: "ATTENDANT",
    });

    const ownerCreatedOwner = await createWithToken(ownerAccess, {
      email: "owner.two@example.com",
      password: "OwnerTwo@123",
      role: "OWNER",
    });

    const owner2Access = await loginUser(ownerCreatedOwner.email, ownerCreatedOwner.password);
    expect(owner2Access).toBeTruthy();

    const adminAccess = await loginUser(ownerCreatedAdmin.email, ownerCreatedAdmin.password);

    const adminCreatedAdmin = await createWithToken(adminAccess, {
      email: "admin.two@example.com",
      password: "AdminTwo@123",
      role: "ADMIN",
    });

    const adminCreatedAttendant = await createWithToken(adminAccess, {
      email: "attendant.two@example.com",
      password: "Attendant2@123",
      role: "ATTENDANT",
    });

    await loginUser(adminCreatedAdmin.email, adminCreatedAdmin.password);
    await loginUser(ownerCreatedAttendant.email, ownerCreatedAttendant.password);
    await loginUser(adminCreatedAttendant.email, adminCreatedAttendant.password);
    await loginUser(ownerEmail, ownerPassword);
  });
});
