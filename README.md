# Snoopy — Autom8x website

This repository is the **website only**: Next.js app (marketing site, auth, UI).  
n8n and the database server are separate; see [System architecture](docs/SYSTEM-ARCHITECTURE.md).

## Stack

- **Next.js 16** (App Router), **TypeScript**, **Tailwind 4**
- **Supabase Auth** (Google, Microsoft OAuth; email/password)
- **Prisma** + **PostgreSQL** (connection via env; DB is external to this repo)

## Quick start

```bash
cp .env.example .env.local   # then fill in values (see below)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Copy `.env.example` to `.env.local` and set:

- `POSTGRES_URL` — Postgres connection string (required for Prisma)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase Auth (OAuth + email/password). Configure Google and Azure in Supabase Dashboard → Authentication → Providers. Add redirect URLs: `https://yourdomain.com/auth/callback`, `http://localhost:3000/auth/callback`

Do **not** commit `.env.local` or any file with real secrets.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run db:migrate -- --name <name>` | Create and run migrations (interactive; can hang with pooler) |
| `npm run db:deploy` | Apply pending migrations only (non-interactive; use if migrate hangs) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Regenerate Prisma client |

## Repository layout

- **`app/`** — Next.js routes, pages, API (`/api/auth/signup`, `/api/health`, `/api/ready`, `/auth/callback`)
- **`components/`** — React UI components
- **`lib/`** — Shared logic: `db.ts`, `site.ts`, `env.ts` (validation), `auth.ts` (workspace provisioning), `auth-supabase.ts` (session + user provisioning)
- **`middleware.ts`** — Protects `/account` (redirect to login when unauthenticated)
- **`prisma/`** — Schema and migrations (website’s DB access)
- **`types/`** — TypeScript module augmentation (if needed)
- **`docs/`** — Architecture and structure

See **[docs/REPO-STRUCTURE.md](docs/REPO-STRUCTURE.md)** for where to put new code.  
See **[docs/SYSTEM-ARCHITECTURE.md](docs/SYSTEM-ARCHITECTURE.md)** for how this app fits with n8n and the database.
