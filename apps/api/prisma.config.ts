import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: path.resolve(__dirname, "prisma/.env") });

export default defineConfig({
  schema: "./prisma/schema.prisma",
  seed: "tsx prisma/seed.ts",
});
