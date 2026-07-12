# Contributing

## One-time setup

1. Get added as a collaborator on `siddak1234/snoopy` (ask Siddak).
2. Clone and install:

   ```bash
   git clone https://github.com/siddak1234/snoopy.git
   cd snoopy
   npm install
   ```

3. Copy `.env.example` to `.env.local` and fill in the **development** credentials Siddak gives you (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `POSTGRES_URL`). Never use production credentials. Never commit any `.env*` file — only `.env.example` (placeholders) is committed.
4. Run locally: `npm run dev` → http://localhost:3000

## Workflow

- **Never commit to `main`** — it is protected; direct pushes are rejected.
- Create a feature branch: `git checkout -b feat/<service-name>`
- Commit, push the branch, and open a PR into `main`.
- The PR merges only after CI (Lint + Typecheck) passes **and** Siddak approves. PRs are squash-merged; the branch is auto-deleted after merge.

## Adding a new service

Read [`docs/REPO-STRUCTURE.md`](docs/REPO-STRUCTURE.md) first, and use the existing services (invoices, candidates) as reference implementations.

- **Solution page**: `app/solutions/<service>/page.tsx`
- **API endpoints**: `app/api/<service>/route.ts` — keep handlers thin; put logic in `lib/`
- **UI components**: `components/<domain>/`; dashboard widgets go in `components/dashboard/`; dialogs use `components/ui/Modal.tsx` (no custom fixed overlays)
- **Database**: import `db` from `@/lib/db` — never instantiate your own Prisma client. Schema changes go in `prisma/schema.prisma`, then `npm run db:migrate -- --name <name>`; commit the generated migration folder.
- **Env vars**: new ones go in `.env.example` (placeholder value) and, if required at runtime, in `lib/env.ts`.
- **Automation logic (n8n)** lives in the separate n8n repository — this repo hosts only the dashboard UI, API routes, and database access for the service.

## Before opening a PR

- `npm run lint` and `npm run typecheck` pass
- The service runs locally end to end
- No secrets, API keys, or `.env` values anywhere in the diff
