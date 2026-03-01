import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI config (migrations, deploy, resolve).
 *
 * --- Supabase + Prisma: how this was corrected (for future DB changes) ---
 *
 * We have two URLs in .env.local:
 *   POSTGRES_URL       = pooler (aws-0-REGION.pooler.supabase.com:6543) — used by app at runtime (lib/db.ts)
 *   POSTGRES_PRISMA_URL = direct (db.PROJECT.supabase.co:5432) — intended for migrations but often unreachable from local (P1001)
 *
 * Problems we hit and how this file fixes them:
 *   1. P1001 "Can't reach database server" — Using POSTGRES_PRISMA_URL (direct) from local/CI often fails (network/firewall). Fix: use POSTGRES_URL (pooler) first so the CLI can connect.
 *   2. "prepared statement 's1' already exists" — Pooler port 6543 is transaction mode (PgBouncer); Prisma migrate uses prepared statements, which transaction mode doesn't support. Fix: when the URL is pooler:6543, rewrite to port 5432 (session mode). Session mode keeps the same connection and supports prepared statements.
 *   3. migrate dev hanging — migrate dev uses a shadow DB and can hang with pooler. Fix: use `npm run db:deploy` to apply pending migrations (no shadow DB). For new migrations, create the migration file then run db:deploy, or apply SQL manually in Supabase and use migrate resolve (see docs/DATABASE-MIGRATIONS.md).
 *
 * So: this config uses POSTGRES_URL first, and rewrites :6543 → :5432 for the pooler. Do not change this unless you have a reachable direct URL for migrations (e.g. CI with direct access).
 */

dotenv.config({ path: ".env.local", override: false, quiet: true });
dotenv.config({ path: ".env", override: false, quiet: true });

let raw =
  process.env.POSTGRES_URL?.trim() || process.env.POSTGRES_PRISMA_URL?.trim();
if (!raw) {
  throw new Error(
    "Prisma needs POSTGRES_URL or POSTGRES_PRISMA_URL in .env.local."
  );
}

if (raw.includes("pooler.supabase.com") && raw.includes("6543")) {
  raw = raw.replace(/:6543/, ":5432");
}
let url = raw;
if (url.includes("supabase.com") && !url.includes("sslmode=")) {
  url += url.includes("?") ? "&sslmode=require" : "?sslmode=require";
}

export default defineConfig({
  datasource: {
    url,
  },
});
