# System architecture: website, n8n, database

High-level view of how the **website** (this repo), **n8n**, and the **database server** fit together.

## The three pieces

```
┌─────────────────────────────────────────────────────────────────┐
│                         Your system                              │
│                                                                   │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐   │
│  │   Website    │     │     n8n      │     │ Database server │   │
│  │  (this repo) │     │  (separate   │     │   (PostgreSQL)   │   │
│  │              │     │   repo)      │     │                  │   │
│  │  Next.js +   │     │              │     │  Single source   │   │
│  │  NextAuth +  │────▶│  Workflows   │────▶│  of truth for    │   │
│  │  Prisma      │     │  Automation  │     │  persisted data  │   │
│  │              │◀────│  Webhooks    │     │                  │   │
│  └──────────────┘     └──────────────┘     └──────────────────┘   │
│         │                      │                      ▲          │
│         │                      │                      │          │
│         └──────────────────────┴──────────────────────┘          │
│                    All connect via connection URL                 │
└─────────────────────────────────────────────────────────────────┘
```

| Component | Repo / location | Role |
|-----------|------------------|------|
| **Website** | This repo (snoopy) | Marketing site, auth (NextAuth), user-facing UI. Reads/writes DB via Prisma for website-specific data (e.g. users, preferences). |
| **n8n** | Separate n8n repository | Workflows, automations, internal or external triggers. Can read/write the same DB or call website APIs. |
| **Database server** | Managed Postgres or own container | Single PostgreSQL instance. Website and n8n each use their own connection URL (same DB or separate DBs, your choice). |

## How they interact

- **Website ↔ Database**: Prisma in this repo connects with `POSTGRES_PRISMA_URL`. All website persistence goes through `lib/db.ts`.
- **n8n ↔ Database**: n8n uses its own Postgres config (same server or separate DB). No Prisma in n8n unless you add it; n8n typically uses its built-in DB nodes or direct SQL.
- **Website ↔ n8n**: Optional. The website can call n8n webhooks or REST APIs (e.g. to trigger workflows). n8n can call the website’s API routes (e.g. `POST /api/...`) if you expose them and secure with headers or API keys. Keep base URLs in env (e.g. `N8N_BASE_URL`, `NEXT_PUBLIC_APP_URL`).

## Deployment (containerized)

- **Website**: One container (Next.js). Env: `POSTGRES_PRISMA_URL`, NextAuth vars, optional `N8N_BASE_URL`.
- **n8n**: One or more containers (n8n’s official image). Env: its own DB URL and config.
- **Database**: One Postgres instance (managed or container). Both website and n8n point at it (or at separate DBs on the same server).

No shared filesystem between website and n8n; all integration via network (DB and HTTP).

## Summary

- **This repo = website only.** Clear boundary; no n8n code or DB server code here.
- **n8n = separate repo.** Automation and workflows.
- **Database = shared or separate.** One server; multiple connection URLs (website, n8n).
- **Clean integration:** env-based URLs, API calls between website and n8n only where needed.
