# Repository structure (website)

This repo contains **only the marketing/website application**. n8n and the database server live in separate repos or infrastructure.

## Top-level layout

```
snoopy/
├── app/              # Next.js App Router — routes, pages, API
├── components/       # React UI components (no route logic)
├── lib/              # Shared runtime logic (DB, config, utils)
├── prisma/           # Database schema and migrations (website’s DB access)
├── public/           # Static assets (images, favicon, etc.)
├── docs/             # Architecture and runbooks (this folder)
├── .env.example            # Required env vars for deployment (copy to .env.local; never commit real secrets)
├── next.config.ts
├── prisma.config.ts
├── package.json
└── README.md
```

## Where to put what

| Add this | Put it here | Notes |
|----------|-------------|--------|
| New page or route | `app/<path>/page.tsx` | One `page.tsx` (or `layout.tsx`) per route segment. |
| New API endpoint | `app/api/<name>/route.ts` | Export `GET`, `POST`, etc. |
| Shared UI (buttons, cards, nav) | `components/` | Use subfolders by domain: `components/navigation/`, `components/home/`, `components/theme/`. |
| Icons / small assets | `components/icons/` or `public/` | Icons as React components in `components/icons/`; static SVGs in `public/`. |
| Database access | Use `lib/db.ts` | Import `db` from `@/lib/db`; do not create new Prisma client instances. |
| App/site config (name, tagline) | `lib/site.ts` | Constants used across the app. |
| Env validation | `lib/env.ts` | `validateEnv()` runs from auth config; in production, throws if required vars missing. |
| Auth config | `lib/auth.ts` | `getAuthOptions()` — shared NextAuth config for the API route and `getServerSession()`. |
| Route protection | `middleware.ts` | Protects `/account` (redirects to `/login` if unauthenticated). |
| Health check | `app/api/health/route.ts` | `GET /api/health` — 200 if app + DB ok, 503 if DB down (for orchestrators). |
| Schema changes | `prisma/schema.prisma` | Then run `npm run db:migrate -- --name <name>`. |
| Docs / architecture | `docs/` | Keep ARCHITECTURE.md and REPO-STRUCTURE.md up to date. |

## Conventions

- **Imports**: Use the `@/` path alias for app code (e.g. `import { db } from "@/lib/db"`).
- **No business logic in `app/`**: Keep route handlers thin; call into `lib/` or services.
- **API routes**: Only under `app/api/`; return JSON and appropriate status codes.
- **Secrets**: Never in code. Use env vars; copy `.env.example` to `.env.local` and fill in locally.

## What this repo is not

- **Not the n8n app**: Workflow/automation logic and n8n config live in a separate n8n repository.
- **Not the database server**: Postgres is external (managed or separate container); this app connects via `POSTGRES_PRISMA_URL`.
- **Not a monorepo**: One app only. Other services (n8n, future backends) are separate repos or images.
