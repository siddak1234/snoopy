<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Autom8x website (`snoopy`): the router

## Identity

- The Next.js **website and web app** for Autom8x, one of four independent
  repositories. **Public:** nothing private (a path, key, email or host) lands here.
- The required check is `all-green`. `CLAUDE.md` is only `@AGENTS.md`, so this
  file is the router: 150 lines or fewer, links rather than detail.

## Start here, every session

1. Run `/add-dir ../snoopy-backend` (or launch with `--add-dir`): **read access
   only**. The governance lives there; this repo reads it and never edits it.
2. Grep `../snoopy-backend/docs/platform/AUTOM8X-MASTER-PLAN.md` for §0 STATUS:
   the current round, the open repository and the next three actions.
3. **If §0 STATUS does not name `snoopy` as the open repository, you are in the
   wrong repo.** Say so and stop. Then read the round's card in
   `AUTOM8X-ROUND-PLAYBOOK.md` §4 before writing anything.
4. `npm run generate:platform-contracts` reads the backend's published contracts
   from there ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)). Reading a contract
   is correct; editing one from a web session is not.

## Where to look

[docs/MAP.md](docs/MAP.md) first: generated from `docs/docs-map.json` and the
tree, it lists the folders, routes, scripts, specs, skills, agents, hooks and
records by size. Then:

| Task | Read or run |
| --- | --- |
| Add or change a signed-in page | `/new-page` ([skill](.claude/skills/new-page/SKILL.md)), [app/CLAUDE.md](app/CLAUDE.md) |
| A route, server action or component | [app/CLAUDE.md](app/CLAUDE.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| A browser or fixture test, a visual baseline | [e2e/CLAUDE.md](e2e/CLAUDE.md), README "Verification" |
| Where a change belongs | [docs/REPO-STRUCTURE.md](docs/REPO-STRUCTURE.md) |
| What each repository holds; no code for one flow | `../snoopy-backend/docs/platform/AUTOM8X-MASTER-PLAN.md` §3.4, read only; `test/no-flow-code.test.mjs` |
| The gates, the scripts | [README.md](README.md) "Verification" and "Useful scripts" |
| Push a change | `/audit-change` ([skill](.claude/skills/audit-change/SKILL.md)), "Gates and push" below |
| Find where something lives | the `explorer` agent ([.claude/agents/explorer.md](.claude/agents/explorer.md)) |
| Review a branch before it lands | the `reviewer` agent ([.claude/agents/reviewer.md](.claude/agents/reviewer.md)) |
| Build a lane from a brief | the `builder` agent ([.claude/agents/builder.md](.claude/agents/builder.md)) |
| A finding's history (F-numbers) | grep `docs/audits/` ("Records" below) |

## Rules

1. **One repository per session.** Work only here. A change that appears to need
   `snoopy-backend` is a *finding* to record, not an edit to make.
2. **The design system is the asset.** Reuse `components/ui` and
   `components/dashboard`; no new component may duplicate one that exists.
   Marketing pages render byte-identically: screenshot diff ([e2e/CLAUDE.md](e2e/CLAUDE.md)).
3. **No raw hex** outside `app/globals.css`, where the design tokens are defined
   (`app/opengraph-image.tsx` is the one exemption: OG images cannot read CSS
   custom properties). `npm run audit:boundaries` refuses a hex colour anywhere
   else; comments are not code.
4. **No hand-written `fetch`.** Use `lib/platform-api.ts` in the browser and
   `lib/platform-server.ts` on the server. Response types are generated from the
   backend's published contracts into `lib/generated/platform-contracts/`:
   regenerate, never hand-edit; each file names the sha256 of its contract.
5. **The browser holds no secret**: no Supabase key, database URL or provider
   token. `npm run audit:boundaries` enforces this in CI, and a direct database
   import is an unconditional failure.
6. **Prisma is gone.** Rule 5's audit refuses it, a direct database import, or a
   Supabase SDK coming back.
7. **`npm run verify` green before every commit**: the whole offline gate in one
   command, listed in README "Verification". Locally its browser suites run in
   Chromium and Firefox; WebKit runs in GitHub CI, and `all-green` needs it there
   (the owner's decision of 2026-10-14, register F104; [e2e/CLAUDE.md](e2e/CLAUDE.md)).
8. **No push without a passing change audit.** `/audit-change` must PASS for the
   exact tree being pushed: it maps the change's blast radius and tests it, not
   just the changed feature, with rule 7's gates. The Claude hook in
   `.claude/settings.json` and the native hook (`scripts/githooks/pre-push`,
   armed once per clone via `bash scripts/install-git-hooks.sh`) both enforce
   the marker; the native hook first runs README's fast gates.

## Invariants

- `BACKEND_API_ORIGIN` is the only website setting, never a `NEXT_PUBLIC_*`
  value; login is backend-mediated OAuth (README "Architecture boundary").
- The website reads published contracts and never authors one; tenancy comes
  from typed Edge responses ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).
- Plain words and the same screens as the app: [app/CLAUDE.md](app/CLAUDE.md).
- A page must still build and serve with no backend, as a Vercel preview does
  (`npm run build:no-backend`, `npm run probe:no-backend`; register F62).
- Ports 3001 and 3443 belong to one gate at a time ([e2e/CLAUDE.md](e2e/CLAUDE.md)).

## Gates and push

- Work in a scratch clone, never a synced folder. Installs, `npm run verify`,
  Playwright and builds run one at a time, under the session's gate lock when
  it has one. Node 22 (`.nvmrc`).
- Commit first, then run `npm run verify` on the committed tree.
- The push (the owner's option C, 2026-10-15):
  1. Review: `/audit-change` runs the `change-auditor` agent
     ([.claude/agents/change-auditor.md](.claude/agents/change-auditor.md)).
  2. The main session runs `node scripts/audit/record-pass.mjs <verdict.json>`,
     the only marker writer.
  3. A normal `git push` (the pre-push hook), then the pull request, then CI's
     `all-green`, where WebKit runs.
- Never `git push --no-verify`; the guard hook refuses it.
- A pull request is ready only when it is pushed, `all-green` on its head, and
  its body is final. The owner merges.
- Hooks (`.claude/settings.json`): `guard.mjs` refuses `--no-verify`, a forced
  recursive `rm` outside the repo or scratch, and installs or builds in a
  synced folder; `session-start.mjs` prints the repo's state; `stop-check.mjs`
  warns of processes left behind. The cases: `.claude/hooks/cases.json`.

## Docs always updated

- Every change updates every doc and code comment that describes it, in the same
  commit, one place each; the others link. The standard:
  [ENGINEERING-STANDARD](../snoopy-backend/docs/platform/ENGINEERING-STANDARD.md) (e).
- `docs/docs-map.json` maps each area's code to its doc. `npm run check:docs`
  fails when that doc did not change with it, when a fact is restated outside
  its home, or when a changed doc names a missing file. A commit that truly
  needs no doc says why in a `Docs-Unchanged: <reason>` trailer.
- `npm run map` rebuilds `docs/MAP.md`; `npm run map -- --check` fails when it is stale.

## Cleanup

- List every process, server, container, worktree and temp folder you start;
  stop or remove each before you return, and report anything left.
- Stop every `next` server you start: a held port 3001 or 3443 refuses the
  next gate. The Stop hook warns of processes left under the session's scratch folder.

## Records

- Current: this router, `README.md`, `docs/ARCHITECTURE.md`,
  `docs/REPO-STRUCTURE.md`. Archive (closed, dated, grep-only): `docs/audits/`
  (the register of findings, F-numbers) and every `*.archive.md`, such as
  [AGENTS.archive.md](AGENTS.archive.md), this router's earlier text.
- Grep any file over 100 KB (MAP "Records by size"); never Read one whole.
