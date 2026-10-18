# AGENTS.md before the engineering standard (archive)

Archive: closed and dated history, append-only, grep-only. On 2026-10-18 the
router [AGENTS.md](AGENTS.md) replaced the text below (the engineering
standard's (a)); its rules 1–8 keep their numbers there, compressed. The
`next dev` block before it stayed in AGENTS.md as it was. Verbatim:

````text
# Autom8x — read before doing anything

This is the Next.js **website and web app** for Autom8x — one of four
independent repositories.

## Start here, every session

**Read `../snoopy-backend/docs/platform/AUTOM8X-MASTER-PLAN.md` §0 STATUS
first.** That block states the current round, the open repository, and the next
three actions. The governance documents live in the private `snoopy-backend`
repository; this repo **reads** them and never edits them.

> That path is outside this working directory. Run `/add-dir ../snoopy-backend`
> at the start of the session (or launch with `--add-dir`) so the read succeeds
> without a prompt. **Read access only.** `npm run generate:platform-contracts`
> also reads the API client's three contracts from there —
> `snoopy-backend/docs/openapi.yaml`, `snoopy-backend/docs/openapi/automations.yaml`
> and `snoopy-backend/docs/openapi/connections.yaml`. Reading a contract is correct;
> editing one from a web session is not.

**If §0 STATUS does not name `snoopy` as the open repository, you are in the
wrong repo.** Say so and stop. Then read the current round's card in
`AUTOM8X-ROUND-PLAYBOOK.md` §4 before writing anything.

## Rules

1. **One repository per session.** Work only here. A change that appears to need
   `snoopy-backend` is a *finding* to record, not an edit to make.
2. **The design system is the asset.** Reuse `components/ui` primitives and
   `components/dashboard`; no new component may duplicate one that exists.
   Marketing pages must render byte-identically — screenshot diff.
3. **No raw hex** outside `app/globals.css`, where the design tokens are
   defined. (`app/opengraph-image.tsx` is the one exemption: OG image
   generation cannot read CSS custom properties.) `npm run audit:boundaries`
   refuses a hex colour anywhere else; comments are not code.
4. **No hand-written `fetch`.** Use `lib/platform-api.ts` in the browser and
   `lib/platform-server.ts` on the server. The response types are generated
   from the backend's published contracts into
   `lib/generated/platform-contracts/` — regenerate, never hand-edit; each
   file names the sha256 of the contract it came from.
5. **The browser holds no secret** — no Supabase key, no database URL, no
   provider token. `npm run audit:boundaries` enforces this in CI and a direct
   database import is an unconditional failure.
6. **Prisma is gone** — removed in Round 5 (plan items 4.6.4–4.6.7). Rule 5's
   audit refuses it, a direct database import, or a Supabase SDK coming back.
7. **`npm run verify` green before every commit** — the whole offline gate in
   one command, listed in the README. On a developer's machine its browser
   suites run in Chromium and Firefox. WebKit runs in GitHub CI on Linux, where
   it passes, and all-green needs it there; on the owner's Mac, Playwright's
   WebKit fails dozens of tests that pass in CI, even on unchanged `main`
   (the owner's decision of 2026-10-14, register F104). `AUTOM8X_WEBKIT=1`
   runs WebKit locally on purpose.
8. **No push without a passing change audit.** `/audit-change` must PASS for the
   exact tree being pushed — it maps the blast radius of the change and tests
   it, not just the changed feature. Its gates are rule 7's, so its browser
   suites run in Chromium and Firefox, and the pull request's CI runs WebKit.
   The Claude hook in `.claude/settings.json` and the native hook (armed once
   per clone via `bash scripts/install-git-hooks.sh`) both enforce the marker.
````
