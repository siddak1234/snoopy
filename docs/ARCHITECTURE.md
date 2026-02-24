# Snoopy (Autom8x) – Architecture Overview

This repo is the **website only**. For how it fits with n8n and the database, see [System architecture](SYSTEM-ARCHITECTURE.md). For where to put code, see [Repo structure](REPO-STRUCTURE.md).

Minimal overview for cloud deployment: single app, containerized, ready for service-to-service APIs.

---

## Current Stack

| Layer        | Technology        | Purpose                          |
|-------------|--------------------|----------------------------------|
| **App**     | Next.js 16 (App Router) | Web UI, SSR, API routes          |
| **Auth**    | NextAuth (Google, JWT)  | Sign-in, session, no DB adapter yet |
| **Data**    | Prisma + PostgreSQL    | ORM + database (via `lib/db.ts`) |
| **Config**  | `prisma.config.ts`     | DB URL from env (`POSTGRES_PRISMA_URL`) |
| **Styling** | Tailwind 4              | UI                                |

Single Node process: Next.js serves pages and API routes; Prisma talks to Postgres. No separate API server or workers in-repo today.

---

## Repository Layout (relevant to deployment)

```
snoopy/
├── app/                    # Next.js App Router
│   ├── api/auth/[...nextauth]/route.ts   # Auth API (NextAuth)
│   ├── page.tsx, layout.tsx, globals.css
│   ├── login, signup, account, contact, automation-builder, solutions/
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

- **PostgreSQL**: URL from `POSTGRES_PRISMA_URL` (set in env at deploy time; not in repo).
- **Google OAuth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` for NextAuth.
- **Next.js**: Needs `NEXTAUTH_URL` and `NEXTAUTH_SECRET` in production.

All config via environment variables; no hardcoded URLs or secrets.

---

## Deployment Model (minimal, containerized)

- **One container**: the Next.js app (build with `npm run build`, run with `npm run start`).
- **Postgres**: managed service (e.g. Vercel Postgres, Neon, RDS) or a separate Postgres container; app connects via `POSTGRES_PRISMA_URL`.
- **Service-to-service later**: new backends (Node, Go, etc.) can run in their own containers and call this app’s APIs over HTTP (e.g. `GET/POST /api/...`), or you add dedicated API routes that other services call. Keep URLs in env (e.g. `NEXT_PUBLIC_*` for browser, internal env for server-to-server).

Recommended:

1. **Single Dockerfile** for the Next.js app: multi-stage build, `node:*-alpine`, `prisma generate` at build (or via `postinstall`), no `next dev` in production.
2. **No DB in same container**; always connect to Postgres via env.
3. **Health check**: e.g. `GET /api/health` returning 200 when app and (optionally) DB are reachable.
4. **Secrets**: only from env (or your cloud’s secret manager), never committed.

---

## API Surface (current and future)

- **Existing**: `app/api/auth/[...nextauth]` — NextAuth handles sign-in, callback, session.
- **Future**: Add routes under `app/api/` for any logic you want to call from other services (e.g. `app/api/jobs/route.ts`). Use `Authorization` headers or internal API keys for server-to-server calls; keep this app as the only thing that talks to Prisma/DB if you stay minimal.

---

## Architecture assessment: clean, professional, scalable?

**Verdict: solid foundation, a few gaps before "production-grade" at scale.**

### What's in good shape

| Area | Status | Notes |
|------|--------|--------|
| **Stack choice** | OK | Next.js App Router, TypeScript strict, Prisma, Postgres, NextAuth — standard, well-supported, cloud-friendly. |
| **Structure** | OK | Clear separation: `app/` (routes + API), `components/`, `lib/` (db, config). Path alias `@/*` used consistently. |
| **Config** | OK | No hardcoded secrets or DB URLs. `prisma.config.ts` and NextAuth read from env. Ready for 12-factor deployment. |
| **Database** | OK | Single Prisma client via `lib/db.ts` (singleton), migrations in repo, `postinstall` runs `prisma generate`. |
| **Scalability** | OK | Stateless app; horizontal scaling is "run more containers." DB is the only stateful piece; use managed Postgres or connection pooling when needed. |
| **Containerization** | OK | One service, env-driven, no embedded DB. Straightforward to put in a single Docker image and scale behind a load balancer. |

So: **yes, the architecture is clean and professional enough to deploy in the cloud and scale.** The choices (single app, env-based config, Prisma singleton, JWT auth) are appropriate for containerized, multi-instance deployment.

### Gaps to address (optional but recommended)

| Gap | Risk | Fix (minimal) |
|-----|------|----------------|
| **No tests** | Regressions, harder refactors | Add a few integration tests (e.g. Playwright for critical flows) and/or API route tests; even a small suite helps. |
| **Auth only in UI** | `/account` (and similar) are protected only client-side; direct URL access still renders then redirects. | Add middleware or `getServerSession` in a server layout for protected routes so unauthenticated users get a redirect before any sensitive UI. |
| **Env not validated** | Missing `NEXTAUTH_SECRET` or `GOOGLE_*` can fail in subtle ways (e.g. empty string in NextAuth). | At app startup or in a small `lib/env.ts`, validate required env and throw a clear error if missing in production. |
| **No health endpoint** | Orchestrators (Kubernetes, ECS, etc.) and load balancers need a simple "is this process up?" check. | Add `GET /api/health` that returns 200 (and optionally checks DB connectivity). |
| **Prisma/User unused** | Schema has `User` and you have `lib/db`, but NextAuth uses JWT only (no DB adapter). | Either wire NextAuth to Prisma (e.g. adapter + sync users to DB) or treat User as "for future use" and document it; avoids confusion. |

None of these block deployment; they improve operability and security as you containerize and scale.

---

## Summary

- One Next.js app, one Prisma client, one Postgres.
- Config and secrets via env; container runs `next start` only.
- Ready to add more containers later and call this app’s APIs over HTTP with minimal changes.
