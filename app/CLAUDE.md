# app/: the routes, pages and server actions

Loaded when you work here. The router is [AGENTS.md](../AGENTS.md); a new page
starts from `/new-page` ([skill](../.claude/skills/new-page/SKILL.md)).

## Next.js here

- This Next has breaking changes. Its own docs are in `node_modules/next/dist/docs/`
  (`01-app/` for the App Router): read the guide before writing the code.
- `npm run typecheck` runs `next typegen` first, which types `PageProps<"/route">`
  and `LayoutProps`; a page takes its params and search params from them.

## Conventions as used here

- Route groups: `(marketing)` holds the public, design-owned pages, which stay
  byte-identical (screenshot diff, [e2e/CLAUDE.md](../e2e/CLAUDE.md)); `(auth)`
  holds sign-in and the deleted-account page. Signed-in pages live under
  `account/` (its `layout.tsx` sends a visitor to sign in), first-run pages under
  `onboarding/`, health and readiness under `api/`.
- `page.tsx` is a Server Component. A page that reads the platform per request
  says `export const dynamic = "force-dynamic"`.
- Beside a page: its client parts as PascalCase files that start with
  `"use client"` (`account/connections/ConnectionsPanel.tsx`), its server actions
  in `actions.ts` (`"use server"`), and pure helpers in kebab-case `.ts` files,
  which `test/` imports and tests (`account/flows/upload-refusals.ts`).
- Dynamic segments name what they hold: `[subscriptionId]`, `[runId]`, `[id]`.
- A failure renders `error.tsx` or `global-error.tsx`, never Next's own page
  (register F26).

## Parts and data

- Reuse `components/ui` (Nocturne primitives: `Button`, `Modal`, `NumberedStep`,
  the form fields) and `components/dashboard` (`SectionCard`, `EmptyRow`,
  `StatusPill`, the rows and lists). Never copy one (AGENTS.md rule 2).
- Data comes through `lib/platform-server.ts` on the server and
  `lib/platform-api.ts` in the browser (AGENTS.md rules 4 and 5). Colours are
  tokens from `app/globals.css` (rule 3).

## Plain words (the owner's rule)

1. Ask the fewest questions.
2. Read what the connected apps already know instead of asking for it.
3. Show few steps.
4. No jargon, and no explanations on the page.
5. Where a person follows steps, number them (`NumberedStep`).

Signed-in and onboarding copy says department and flow, never team, project
or automation (BUILD-PLAN 24.11.11, Build 23's B1; routes and identifiers keep
`team`; `test/structure-contract.test.mjs` parses it).

## Parity with the app

The web shows the same screens as the mobile app. The screen list is
`snoopy-mobile`'s generated map (`snoopy-mobile/docs/MAP.md`, its routes). A
screen added or changed on one side is added on the other in the same round, or
the gap is a finding for that round.
