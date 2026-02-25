import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI does not load .env.local; load it explicitly. .env.local first, then .env; override: false so existing env wins.
dotenv.config({ path: ".env.local", override: false, quiet: true });
dotenv.config({ path: ".env", override: false, quiet: true });

export default defineConfig({
  datasource: {
    url: process.env.POSTGRES_PRISMA_URL,
  },
});
