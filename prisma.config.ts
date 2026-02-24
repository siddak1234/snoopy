import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Load local development env first (not committed), then fall back to .env if present.
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
