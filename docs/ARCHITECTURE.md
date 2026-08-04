# Snoopy (Autom8x) – Architecture Overview

This repo is the **website only**. For how it fits with n8n and the database, see [System architecture](SYSTEM-ARCHITECTURE.md). For where to put code, see [Repo structure](REPO-STRUCTURE.md).

Minimal overview for cloud deployment: single app, containerized, ready for service-to-service APIs.

---

## Current Stack

| Layer        | Technology        | Purpose                          |
|-------------|--------------------|----------------------------------|
| **App**     | Next.js 16 (App Router) | Web UI, SSR, API routes          |
| **Auth**    | Supabase Auth (Google, Microsoft OAuth; email/password) | Sign-in, session, user provisioning to Prisma |
| **Data**    | Prisma + PostgreSQL    | ORM + database (via `lib/db.ts`) |
| **Config**  | `prisma.config.ts`     | DB URLs from env (`POSTGRES_URL` runtime, optional `POSTGRES_PRISMA_URL` direct) |
| **Styling** | Tailwind 4              | UI                                |

Single Node process: Next.js serves pages and API routes; Prisma talks to Postgres. No separate API server or workers in-repo today.

---

## Repository Layout (relevant to deployment)

```
snoopy/
├── app/                    # Next.js App Router
│   ├── api/auth/signup/route.ts          # Email/password signup
│   ├── auth/callback/route.ts            # OAuth callback (Supabase)
│   ├── layout.tsx, globals.css
│   ├── (marketing)/        # /, solutions, automation-builder, contact
│   ├── (auth)/             # login, signup, verify-email, org-invite, ...
│   ├── account/            # protected dashboard (incl. builder canvas)
│   ├── onboarding/
│   └── ...
├── components/
├── lib/
│   ├── db.ts               # Prisma singleton (use for all DB access)
│   └── site.ts             # App/site config
├── prisma/
│   ├── schema.prisma       # Postgres, User model
│   ├── migrations/
│   └── ...
├── prisma.config.ts        # Datasource URL from env
├── next.config.ts
└── package.json            # postinstall: prisma generate
```

---

## External Boundaries

- **PostgreSQL**: runtime URL from `POSTGRES_URL` (with optional direct `POSTGRES_PRISMA_URL`); set in env at deploy time, not in repo.
- **Supabase Auth**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Configure Google and Azure providers in Supabase Dashboard.

All config via environment variables; no hardcoded URLs or secrets.

---

## Deployment Model (minimal, containerized)

- **One container**: the Next.js app (build with `npm run build`, run with `npm run start`).
- **Postgres**: managed service (e.g. Vercel Postgres, Neon, RDS) or a separate Postgres container; app connects via `POSTGRES_URL` at runtime.
- **Service-to-service later**: new backends (Node, Go, etc.) can run in their own containers and call this app’s APIs over HTTP (e.g. `GET/POST /api/...`), or you add dedicated API routes that other services call. Keep URLs in env (e.g. `NEXT_PUBLIC_*` for browser, internal env for server-to-server).

Recommended:

1. **Single Dockerfile** for the Next.js app: multi-stage build, `node:*-alpine`, `prisma generate` at build (or via `postinstall`), no `next dev` in production.
2. **No DB in same container**; always connect to Postgres via env.
3. **Health vs readiness**: `GET /api/health` = liveness (200, no DB). `GET /api/ready` = readiness (200 when DB ok, 503 when DB down).
4. **Secrets**: only from env (or your cloud’s secret manager), never committed.

---

## API Surface (current and future)

- **Existing**: `app/auth/callback` — Supabase OAuth callback; `app/api/auth/signup` — email/password signup. Session via Supabase cookies.
- **Future**: Add routes under `app/api/` for any logic you want to call from other services (e.g. `app/api/jobs/route.ts`). Use `Authorization` headers or internal API keys for server-to-server calls; keep this app as the only thing that talks to Prisma/DB if you stay minimal.

---

## Summary

- One Next.js app, one Prisma client, one Postgres.
- Config and secrets via env; container runs `next start` only.
- Ready to add more containers later and call this app’s APIs over HTTP with minimal changes.
