# Stack summary (for agents)

**Stack:** Next.js (App Router), Supabase Auth (Google, Microsoft OAuth; email/password), Prisma 7.4.1, Supabase Postgres. Repo = website only; n8n and DB are separate.

---

## Prisma

- **Schema:** No `url` in `datasource` (Prisma 7). Connection URL comes from **`prisma.config.ts` only:** `process.env.POSTGRES_PRISMA_URL`.
- **Config:** `prisma.config.ts` loads env with dotenv: `.env.local` then `.env`, `override: false`, `quiet: true`. Uses **POSTGRES_URL** (pooler) for migrate so CLI can connect; direct (POSTGRES_PRISMA_URL) often unreachable from local (P1001).
- **Client:** From `@prisma/client`; **singleton in `lib/db.ts`**. No custom output; `postinstall` runs `prisma generate`.
- **Usage:** Use `db` only in Node runtime (not Edge). No top-level `db` import in route files so build does not require DB.

---

## Env

- `.env` and `.env.local` are gitignored; `.env.example` is committed (template only).
- **Production:** Vercel env vars only; no reliance on `.env.local` in prod.
- **Local:** Prisma CLI needs `.env.local` (or `.env`) for migrations; dotenv in `prisma.config.ts` handles that.

---

## Auth

- **Supabase Auth** is the source of truth. OAuth (Google, Azure) via `supabase.auth.signInWithOAuth()`. Email/password via `signInWithPassword` and `/api/auth/signup`.
- **User provisioning:** After Supabase auth, `provisionUserFromSupabaseAuth()` in `lib/auth-supabase.ts` upserts Prisma `User` by `supabaseUserId` or email, creates default workspace via `ensureDefaultWorkspaceForUser()`.
- **Session:** `getAppSession()` (server) and `useAppSession()` (client via `/api/session`) return `{ user: { id, email, name, image } }` from Prisma User.
- **Env:** `lib/env.ts` validates in production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `POSTGRES_URL`.

---

## Routes

- **`/api/health`** — Liveness; no DB.
- **`/api/ready`** — Readiness; dynamic import of db, `SELECT 1` when `POSTGRES_PRISMA_URL` set; otherwise 200 + `database: "skipped"`.
- **`/account`** and **`/dashboard`** — Protected in `middleware.ts` (redirect to `/login` if no Supabase session). Dashboard layout also checks `session?.user?.id` server-side and redirects if missing.

---

## Schema

- **User:** `id`, `email`, `googleSub` String? @unique, `supabaseUserId` String? @unique, `name`, `image`, `createdAt`, `updatedAt`; table `users`.
- Migrations in `prisma/migrations/`: `init`, `add_google_sub_to_user`, `add_supabase_user_id`, etc.

---

## Deploy

- **Vercel does not run migrations.** Run `prisma migrate deploy` (or equivalent) against prod DB separately.
- Build does not need DB; no top-level db import in routes.
- **Supabase Dashboard:** Add redirect URLs (`https://yourdomain.com/auth/callback`, `http://localhost:3000/auth/callback`). Enable Google and Azure providers. For Microsoft use tenant "common" and required scopes; see **docs/AUTH-MICROSOFT-AZURE.md**.
