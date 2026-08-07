# Stack Handoff — replicate this app's frontend, DB & everything

> **Historical handoff warning (2026-08-06):** the UI/version information remains
> useful, but direct Supabase, database, storage, upload, webhook, and password-auth
> instructions below are superseded by
> [`ARCHITECTURE.md`](ARCHITECTURE.md) and the
> [`backend boundary audit`](audits/2026-08-06-backend-boundary-cutover.md). Do not
> use this file to configure the new Supabase project or Vercel secrets.

Everything needed to stand up a project matching this one, down to exact versions.
Since a future merge is possible, the biggest wins for compatibility are: **same
framework version, same Tailwind v4 CSS-first setup, same design-token system,
and same auth/DB shape.** Match those and merging later is mostly file moves.

> ⚠️ There is **no third-party component library** (no shadcn/ui, Radix, MUI,
> Chakra, Mantine, etc.). The UI is custom components on Tailwind CSS v4 plus the
> **Nocturne** CSS-variable design system in `app/globals.css`. To match the UI,
> copy that file and the `components/ui` primitives — not an npm install.
> Icons are **Phosphor** (`@phosphor-icons/react`) — the design system mandates it.

---

## 1. Core framework

| Concern | Choice | Exact version |
|---|---|---|
| Framework | **Next.js** (App Router) | `16.1.6` |
| Bundler/dev | **Turbopack** (Next default) | — |
| UI runtime | **React** | `19.2.3` |
| | **React DOM** | `19.2.3` |
| Language | **TypeScript** | `5.9.3` |
| Node | engines `>=22` (CI pins 22) | `@types/node` `^20` |

- App Router (`app/` directory), server components by default. Route groups:
  `(marketing)` = public shell, `(auth)` = centered auth shell, `account/` =
  protected dashboard shell.
- `next.config.ts` sets `turbopack.root` **and a `redirects()` block** (retired
  marketing routes → `/solutions` anchors; `/dashboard` → `/account`;
  `/automation-builder?id=` → `/account/builder`).
- Path alias `@/*` → repo root (see `tsconfig.json`), `moduleResolution: "bundler"`, `strict: true`.

---

## 2. Styling & UI (the "match my UI" layer)

| Concern | Choice | Exact version |
|---|---|---|
| CSS framework | **Tailwind CSS v4** | `4.1.18` |
| PostCSS plugin | `@tailwindcss/postcss` | `4.1.18` |
| Animation | **Framer Motion** (LazyMotion `m` components) | `12.38.0` |
| Icons | **@phosphor-icons/react** | `2.1.10` |
| Flow / node-graph builder | **@xyflow/react** (React Flow) | `12.10.1` |
| Font | **Inter** via `next/font/google` (CSS var `--font-inter`) | — |
| Component library | **none — all custom (Nocturne)** | — |

**Tailwind v4 is CSS-first — there is NO `tailwind.config.js`.**
- `postcss.config.mjs` just enables `@tailwindcss/postcss`.
- `app/globals.css` starts with `@import "tailwindcss";` and defines the token
  ramps in `@theme` (plus `@theme inline` for fonts).
- Design tokens are **CSS custom properties**, three layers: Nocturne primitives
  (`--color-*` OKLCH ramps), role tokens, and legacy aliases (`--bg --surface
  --text --muted --accent --ring` …). **Dark is the DEFAULT on `:root`; light
  mode is `html[data-theme="light"]`** (a blocking script in `app/layout.tsx`
  reads localStorage key `"theme"` pre-paint — no FOUC).
- Reusable visual classes live in `globals.css`: `.bubble`, `.bubble-soft`,
  `.modal-card`, `.btn-primary` (accent OUTLINE, never a fill), `.btn-secondary`,
  `.btn-ghost`, `.btn-sm`/`.btn-lg`, `.interactive-card`, `.page-glow`,
  `.lighten`, plus React Flow brand overrides.

**To match the look, copy these verbatim:**
1. `app/globals.css` (the entire Nocturne system + tokens)
2. `components/ui/*` — the hand-rolled primitives:
   `Button.tsx`, `Card.tsx`, `Kicker.tsx`, `Section.tsx` (Container + Section),
   `NumberedStep.tsx`, `ImagePlaceholder.tsx`, `Modal.tsx`, `FormInput.tsx`,
   `FormError.tsx`, `FilePicker.tsx`
3. `components/motion/MotionProvider.tsx` + `lib/motion/variants.ts`
   (shared Framer Motion variants)
4. `components/theme/ThemeToggle.tsx` (drives `data-theme`; dark is default)
5. `components/branding/LogoMark.tsx` (serves `public/a8x-mark.png` — white
   artwork, light theme inverts via `.brand-mark`) and
   `components/marketing/{MarketingNav,MarketingFooter}.tsx` + `lib/nav.ts`
   if he wants the same header/nav shell (wired in `app/(marketing)/layout.tsx`)

Font: Inter through `next/font/google` with variable `--font-inter`; headings
never bolder than 500. (The old `--font-geist-*` vars are gone.)

---

## 3. Database & ORM

| Concern | Choice | Exact version |
|---|---|---|
| Database | **Supabase Postgres** | — (managed) |
| ORM | **Prisma** | `7.4.1` |
| Prisma client | `@prisma/client` | `7.4.1` |
| Driver adapter | `@prisma/adapter-pg` | `7.4.1` |
| Postgres driver | `pg` | `8.19.0` |
| Env loader (CLI) | `dotenv` | `17.3.1` |

**Prisma 7 specifics (easy to trip on):**
- `prisma/schema.prisma` has **no `url` in `datasource`**. The DB URL is resolved
  in `prisma.config.ts` at runtime.
- Config loads env with dotenv (`.env.local` then `.env`, `override:false`) and
  uses `POSTGRES_URL` (the pooler) for migrate/CLI; `POSTGRES_PRISMA_URL`
  (direct) is the fallback and is often unreachable from a laptop (P1001).
- Prisma client is a **lazy singleton in `lib/db.ts`** — constructed on first
  query via a Proxy, so `next build` never needs a DB connection (CI and Vercel
  previews build env-less). Node-runtime only (never Edge).
- `postinstall` runs `prisma generate`.

Data model (see `prisma/schema.prisma`): `User`, `Workspace`, `Membership`,
`Project`, `ProjectMembership`, `WorkspaceInvite`, `Workflow` — multi-tenant with
workspace + project RBAC. `Workflow.definition` is a single JSONB graph column
(nodes/edges/notes/viewport) with a `schemaVersion` for forward-compat.

---

## 4. Auth

| Concern | Choice | Exact version |
|---|---|---|
| Auth provider | **Supabase Auth** (source of truth) | — |
| SSR helpers | `@supabase/ssr` | `0.9.0` |
| JS client | `@supabase/supabase-js` | `2.98.0` |
| Password hashing | `bcrypt` (for invite codes) | `6.0.0` |

- OAuth: **Google** and **Azure/Microsoft** via `supabase.auth.signInWithOAuth()`
  (scopes set server-side in `app/api/auth/oauth/route.ts`); plus email/password
  (`signInWithPassword` + `/api/auth/signup`).
- Supabase client factories in `lib/supabase/{client,server,middleware,admin}.ts`
  (+ a deliberately cookie-less anon client in `lib/supabase.ts` used by signup).
- After Supabase auth, `provisionUserFromSupabaseAuth()` (`lib/auth-supabase.ts`)
  upserts a Prisma `User` by `supabaseUserId`/email and creates a default
  workspace.
- **`proxy.ts`** (Next 16 proxy convention — the old `middleware.ts` name is
  deprecated) protects `/account` and `/onboarding` with a query-preserving
  `callbackUrl`; it degrades gracefully when Supabase env is absent (preview
  deploys: public pages render, gated paths bounce to `/login`).
- Microsoft setup notes: `docs/AUTH-MICROSOFT-AZURE.md`. Add redirect URLs in the
  Supabase dashboard (`https://<domain>/auth/callback`, `http://localhost:3000/auth/callback`).

---

## 5. File storage

| Concern | Choice | Exact version |
|---|---|---|
| Object storage | **Google Cloud Storage** | `@google-cloud/storage` `7.19.0` |

Used for uploaded files (resumes, invoices, JDs). Wrapper in `lib/gcs.ts`.
n8n pulls uploads from the bucket and posts results back to Postgres.

---

## 6. Hosting & tooling

| Concern | Choice | Version |
|---|---|---|
| Hosting | **Vercel** | — |
| Linter | **ESLint** (flat config) | `9.39.2` |
| Lint config | `eslint-config-next` + `eslint-config-prettier` + custom design-adherence rules | `16.1.6` |
| Formatter | **Prettier** + `prettier-plugin-tailwindcss` | `3.9.6` / `0.8.1` |
| Typecheck | `next typegen && tsc --noEmit` | — |

- `eslint.config.mjs` is flat config composing `eslint-config-next/core-web-vitals`,
  `.../typescript`, `eslint-config-prettier`, **plus `no-restricted-syntax` rules
  banning raw hex/rgba/px/fonts in TSX** (error-level in marketing/ui trees).
- ⚠️ `prettier-plugin-tailwindcss` strips leading spaces inside className
  template-literal strings — use whole-string ternaries for conditional classes.
- CI (GitHub Actions): Lint + format:check, Build, Typecheck — Node 22.
- **Vercel does NOT run migrations.** Run `prisma migrate deploy` against the prod
  DB separately.

---

## 7. package.json to copy

```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "next typegen && tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "postinstall": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate"
  },
  "dependencies": {
    "@google-cloud/storage": "^7.19.0",
    "@phosphor-icons/react": "^2.1.10",
    "@prisma/adapter-pg": "^7.4.1",
    "@prisma/client": "^7.4.1",
    "@supabase/ssr": "^0.9.0",
    "@supabase/supabase-js": "^2.98.0",
    "@xyflow/react": "^12.10.1",
    "bcrypt": "^6.0.0",
    "dotenv": "^17.3.1",
    "framer-motion": "^12.38.0",
    "next": "16.1.6",
    "pg": "^8.19.0",
    "prisma": "^7.4.1",
    "react": "19.2.3",
    "react-dom": "19.2.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/bcrypt": "^6.0.0",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "eslint-config-prettier": "^10.1.8",
    "prettier": "^3.9.6",
    "prettier-plugin-tailwindcss": "^0.8.1",
    "tailwindcss": "^4",
    "typescript": "^5"
  },
  "engines": { "node": ">=22" }
}
```

> Trim what he doesn't need: drop `@xyflow/react` if there's no node-graph builder;
> drop `@google-cloud/storage` if there are no file uploads; drop `bcrypt` if he
> uses only Supabase invites. Keep everything in sections 1–4 to stay merge-compatible.

---

## 8. Environment variables

Needed at minimum (see `.env.example` for the full template, including the six
n8n `*_WEBHOOK_URL`/`*_WEBHOOK_SECRET` pairs and the GCS vars):

```
# Supabase Auth (public)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Postgres (Prisma)
POSTGRES_URL=            # pooled — used by migrate/CLI and runtime
POSTGRES_PRISMA_URL=     # direct — fallback

# Google Cloud Storage (if using file uploads)
GCP_SERVICE_ACCOUNT_KEY_BASE64=
GCS_INVOICE_BUCKET=      # (+ AUTOM8X_GCS_BUCKET for the non-Claros path)

# Supabase service role (server-only admin ops)
SUPABASE_SERVICE_ROLE_KEY=
```

`lib/env.ts` validates `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
and `POSTGRES_URL` — throwing only in real production (`VERCEL_ENV=production`);
previews warn instead. `.env`/`.env.local` are gitignored; only `.env.example`
is committed.

---

## 9. Quickest path to a matching starter

```bash
npx create-next-app@16.1.6 myapp --ts --app --eslint --no-src-dir --import-alias "@/*"
cd myapp

# Tailwind v4 (CSS-first, no config file)
npm i -D tailwindcss@4 @tailwindcss/postcss@4
# postcss.config.mjs -> { plugins: { "@tailwindcss/postcss": {} } }
# app/globals.css -> @import "tailwindcss";  (then paste the Nocturne tokens)

# DB + ORM
npm i @prisma/client@7.4.1 @prisma/adapter-pg@7.4.1 pg@8.19.0 dotenv
npm i -D prisma@7.4.1

# Auth
npm i @supabase/ssr@0.9.0 @supabase/supabase-js@2.98.0 bcrypt
npm i -D @types/bcrypt

# UI: motion, icons, flow builder (builder optional)
npm i framer-motion@12.38.0 @phosphor-icons/react @xyflow/react@12.10.1

# Formatting (CI-gated here)
npm i -D prettier prettier-plugin-tailwindcss eslint-config-prettier
```

Then copy over, in order: `app/globals.css`, `components/ui/*`,
`components/motion/*` + `lib/motion/variants.ts`, `components/theme/ThemeToggle.tsx`,
`public/a8x-mark.png` + `components/branding/LogoMark.tsx`,
`prisma/schema.prisma` + `prisma.config.ts`, `lib/db.ts`, `lib/supabase/*`,
`lib/env.ts`, and `proxy.ts`.
