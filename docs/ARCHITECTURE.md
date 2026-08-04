# Snoopy (Autom8x) – Architecture Overview

This repo is the **website only**. For where to put code, see [Repo structure](REPO-STRUCTURE.md).

Single app, containerized, ready for service-to-service APIs. This page also covers how the website fits with n8n and the database (the former SYSTEM-ARCHITECTURE doc).

---

## Current Stack

| Layer        | Technology        | Purpose                          |
|-------------|--------------------|----------------------------------|
| **App**     | Next.js 16 (App Router) | Web UI, SSR, API routes          |
| **Auth**    | Supabase Auth (Google, Microsoft OAuth; email/password) | Sign-in, session, user provisioning to Prisma |
| **Data**    | Prisma + PostgreSQL    | ORM + database (via `lib/db.ts`) |
| **Config**  | `prisma.config.ts`     | DB URLs from env (`POSTGRES_URL` runtime, optional `POSTGRES_PRISMA_URL` direct) |
| **Styling** | Tailwind 4 (Nocturne token sheet in `app/globals.css`) | UI |

Single Node process: Next.js serves pages and API routes; Prisma talks to Postgres. No separate API server or workers in-repo today.

---

## System boundaries: website ↔ n8n ↔ database

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Website    │     │     n8n      │     │ Database server  │
│  (this repo) │     │  (separate)  │     │   (PostgreSQL)   │
│  Next.js +   │────▶│  Workflows   │────▶│  Single source   │
│  Supabase +  │     │  Automation  │     │  of truth for    │
│  Prisma      │◀────│  Webhooks    │     │  persisted data  │
└──────────────┘     └──────────────┘     └──────────────────┘
```

- **Website ↔ Database**: Prisma uses `POSTGRES_URL` at runtime (optional `POSTGRES_PRISMA_URL` direct fallback). All website persistence goes through `lib/db.ts`.
- **Website → n8n**: fire-and-forget webhooks with an `X-Webhook-Secret` header. The live pairs: `N8N_INGEST_WEBHOOK_*` + `AUTOM8X_N8N_WEBHOOK_*` (invoice ingest, Claros vs Autom8x), `N8N_JD_WEBHOOK_*` (job-description parse), `N8N_CANDIDATE_WEBHOOK_*` (resume screen), plus the contact form via `AUTOM8X_N8N_WEBHOOK_*`.
- **n8n ↔ Database**: n8n writes results (parsed JDs, screens, allocations) straight to the same Postgres. The hand-synced contract for GL allocation columns lives in `running-total/` and `prompts/` — see the comments in `lib/gl-allocations.ts` and `lib/gl-codes-general-template.ts`.
- **Files**: uploads go to GCS (`GCP_SERVICE_ACCOUNT_KEY_BASE64`, `GCS_INVOICE_BUCKET`, `AUTOM8X_GCS_BUCKET`); n8n pulls from the bucket.

No shared filesystem; all integration is network (DB and HTTP), all URLs/secrets from env.

---

## Repository Layout (relevant to deployment)

```
snoopy/
├── app/                    # Next.js App Router
│   ├── layout.tsx, globals.css
│   ├── (marketing)/        # /, solutions, automation-builder, contact
│   ├── (auth)/             # login, signup, verify-email, org-invite, ...
│   ├── account/            # protected dashboard (incl. builder canvas)
│   ├── onboarding/
│   ├── auth/callback/      # Supabase OAuth callback
│   └── api/                # 14 routes — see API Surface below
├── components/             # ui/, marketing/, dashboard/, builder/, auth/, ...
├── hooks/                  # use-app-session, use-hydrated
├── lib/                    # db.ts (Prisma singleton), auth, gl-*, workflows, supabase/
├── prisma/                 # schema (7 models) + migrations
├── supabase/               # reference SQL (deploy never runs these)
├── prompts/, running-total/ # n8n prompt + Code-node source copies (not imported)
├── proxy.ts                # route protection (Next 16 proxy convention)
├── instrumentation.ts      # env validation at server startup
├── prisma.config.ts        # datasource URL from env (pooler 6543→5432 rewrite)
├── next.config.ts          # redirects for retired marketing routes
└── package.json            # postinstall: prisma generate
```

---

## External Boundaries

- **PostgreSQL**: runtime URL from `POSTGRES_URL` (optional direct `POSTGRES_PRISMA_URL`); set in env at deploy time, not in repo.
- **Supabase Auth**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Configure Google and Azure providers in Supabase Dashboard (see [AUTH-MICROSOFT-AZURE.md](AUTH-MICROSOFT-AZURE.md)).
- **Google Cloud Storage**: `GCP_SERVICE_ACCOUNT_KEY_BASE64` + `GCS_INVOICE_BUCKET`/`AUTOM8X_GCS_BUCKET` for invoice/JD/resume uploads.
- **n8n webhooks**: the six `*_WEBHOOK_URL`/`*_WEBHOOK_SECRET` pairs listed above.

All config via environment variables; no hardcoded URLs or secrets. `.env.example` is the committed template.

---

## Deployment Model (minimal, containerized)

- **One container**: the Next.js app (build with `npm run build`, run with `npm run start`).
- **Postgres**: managed service (e.g. Vercel Postgres, Neon, RDS) or a separate Postgres container; app connects via `POSTGRES_URL` at runtime.
- **n8n**: its own container/host with its own DB config; never bundled here.

Recommended:

1. **Single Dockerfile** for the Next.js app: multi-stage build, `node:*-alpine`, `prisma generate` at build (or via `postinstall`), no `next dev` in production.
2. **No DB in same container**; always connect to Postgres via env.
3. **Health vs readiness**: `GET /api/health` = liveness (200, no DB). `GET /api/ready` = readiness (200 when DB ok, 503 when DB down; 200 + `database: "skipped"` when `POSTGRES_URL` unset).
4. **Secrets**: only from env (or your cloud’s secret manager), never committed.

---

## Route protection

`proxy.ts` → `lib/supabase/middleware.ts` protects `/account` (incl. `/account/builder`) and `/onboarding` — unauthenticated visitors are redirected to `/login` with a query-preserving `callbackUrl`. The account layout re-checks the session server-side. `/dashboard` is only a redirect to `/account` (`next.config.ts`).

---

## API Surface

All under `app/api/`, one `route.ts` each:

- **Auth/session**: `auth/signup`, `auth/oauth`, `session`, `account/delete` (plus `app/auth/callback` for OAuth).
- **Invoices**: `invoices/upload` (→ GCS + n8n), `invoices/file`.
- **Recruiting**: `job-descriptions/{upload,file,archive}`, `candidates/{upload,file}`.
- **Marketing**: `contact` (→ n8n webhook, honeypot + validation).
- **Infra**: `health` (liveness), `ready` (readiness).

Server-to-server calls from other services should use `Authorization` headers or internal API keys; keep this app as the only thing that talks to Prisma/DB.

---

## Summary

- One Next.js app, one Prisma client, one Postgres; n8n and the DB server live outside this repo.
- Config and secrets via env; container runs `next start` only.
- Ready to add more containers later and call this app’s APIs over HTTP with minimal changes.
