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
- The PR merges only after CI (Lint + Format + Build + Typecheck) passes **and** Siddak approves. PRs are squash-merged; the branch is auto-deleted after merge.

## Design system (Nocturne)

The site runs on the Nocturne design system — tokens live in
`app/globals.css` and are the single source of truth for color, type,
spacing, radius and shadows.

- **Never hard-code a hex, rgba, or font name in TSX.** Use the tokens:
  `var(--color-*)`, `var(--font-heading|body)`, `var(--radius-*)`,
  `var(--shadow-*)`, `var(--space-*)`. ESLint enforces this (error in
  marketing/ui trees, warn elsewhere while legacy code migrates).
- **Reuse before you re-implement.** Shared primitives live in
  `components/ui/`: `Button` (primary = accent outline, never a fill; sizes
  sm/md/lg), `Card`, `Kicker`, `Section`/`Container`, `NumberedStep`,
  `ImagePlaceholder`, `FormInput`, `Modal`. Marketing-specific
  pieces are in `components/marketing/`.
- **Dark is the default theme**; light is `html[data-theme="light"]`. Verify
  changes in both (toggle in the header).
- Headings are never bolder than 500 (`font-medium`) — hierarchy comes from
  size and space. Icons are Phosphor (`@phosphor-icons/react`).
- Nav data lives in `lib/nav.ts` (marketing) and
  `components/dashboard/DashboardNav.tsx` (dashboard) — one source each.
- Breakpoint canon: `sm:`/`lg:` for content grids, `md:` for navigation.
- New shared components use **named exports**; component files are
  `PascalCase.tsx`, lib files `kebab-case.ts`.

## Adding a new service

Read [`docs/REPO-STRUCTURE.md`](docs/REPO-STRUCTURE.md) first, and use the existing services (invoices, candidates) as reference implementations.

- **Solution content**: add a section to `app/(marketing)/solutions/page.tsx` (the industry pages were consolidated there)
- **API endpoints**: `app/api/<service>/route.ts` — keep handlers thin; put logic in `lib/`
- **UI components**: `components/<domain>/`; dashboard widgets go in `components/dashboard/`; dialogs use `components/ui/Modal.tsx` (no custom fixed overlays)
- **Database**: import `db` from `@/lib/db` — never instantiate your own Prisma client. Schema changes go in `prisma/schema.prisma`, then `npm run db:migrate -- --name <name>`; commit the generated migration folder.
- **Env vars**: new ones go in `.env.example` (placeholder value) and, if required at runtime, in `lib/env.ts`.
- **Automation logic (n8n)** lives in the separate n8n repository — this repo hosts only the dashboard UI, API routes, and database access for the service.

## Before opening a PR

- `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm run build` pass (CI runs all four)
- The service runs locally end to end, checked in **both themes**
- No secrets, API keys, or `.env` values anywhere in the diff
