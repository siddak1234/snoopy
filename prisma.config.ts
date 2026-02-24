import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Local dev only: .env.local is gitignored. Production (e.g. Vercel) uses platform env vars only.
dotenv.config({ path: ".env.local" });
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["POSTGRES_PRISMA_URL"],
  },
});
