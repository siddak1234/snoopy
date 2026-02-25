import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI does not load .env.local; load it explicitly. .env.local first, then .env; override: false so existing env wins.
dotenv.config({ path: ".env.local", override: false, quiet: true });
dotenv.config({ path: ".env", override: false, quiet: true });

if (!process.env.POSTGRES_PRISMA_URL) {
  throw new Error(
    "Prisma migrations require POSTGRES_PRISMA_URL pointing to the direct Supabase database (db.<project>.supabase.co)."
  );
}

export default defineConfig({
  datasource: {
    url: process.env.POSTGRES_PRISMA_URL,
  },
});
