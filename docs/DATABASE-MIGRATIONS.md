# Database migrations

## How Supabase + Prisma was corrected (future reference)

We use **Supabase Postgres** with two connection URLs:

| Env var               | Purpose              | Host / port example                                      |
|-----------------------|----------------------|----------------------------------------------------------|
| `POSTGRES_URL`        | **Runtime** (app)    | `aws-0-REGION.pooler.supabase.com:6543` (transaction)    |
| `POSTGRES_PRISMA_URL` | **Direct** (optional)| `db.PROJECT.supabase.co:5432` (direct DB)                |

**Runtime** (`lib/db.ts`) uses `POSTGRES_URL` so the app and Vercel can reach the DB. The direct URL often cannot be reached from local or serverless (P1001).

**Prisma CLI** (migrate, deploy, resolve) is configured in `prisma.config.ts`:

1. **Use `POSTGRES_URL` first** so the CLI can connect from local (direct often gives P1001).
2. **Rewrite port 6543 → 5432** when the URL is the pooler. Port 6543 is Supabase *transaction* mode (PgBouncer), which does not support prepared statements; Prisma migrate uses them and fails with "prepared statement 's1' already exists". Port 5432 on the pooler is *session* mode, which supports prepared statements.
3. **SSL**: we append `sslmode=require` when missing for Supabase URLs.

So for future DB changes: keep both URLs in `.env.local`; run **`npm run db:deploy`** to apply migrations (do not rely on `db:migrate` from local if it hangs). The config in `prisma.config.ts` is documented inline; do not switch back to "direct only" for the CLI unless you run migrations from a context where the direct host is reachable.

---

## Normal flow

- **Apply pending migrations (no prompt, no shadow DB):**  
  `npm run db:deploy`  
  Use this for all schema changes. Prefer this over `db:migrate` when using Supabase pooler.

- **Create a new migration (then apply):**  
  Edit `prisma/schema.prisma`, then either run `npm run db:migrate -- --name your_migration_name` (can hang with pooler), or create the migration SQL by hand under `prisma/migrations/YYYYMMDD_name/`, then run `npm run db:deploy`.

## If migrate or deploy hangs

With Supabase pooler (POSTGRES_URL on port 6543), the CLI can hang or time out. Apply the migration manually:

1. Open **Supabase Dashboard → SQL Editor**.
2. Run the SQL from the migration file, e.g.  
   `prisma/migrations/20260225120000_add_projects/migration.sql`  
   (copy the full contents and run.)
3. Mark the migration as applied so Prisma doesn’t run it again:
   ```bash
   npx prisma migrate resolve --applied 20260225120000_add_projects
   ```
   (If that also hangs, run it from a context where the CLI can connect, e.g. CI with direct URL, or after temporarily using a reachable DB URL.)

4. Regenerate the client: `npm run db:generate`
