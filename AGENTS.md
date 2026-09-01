<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

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
> without a prompt. **Read access only.** From Round 5 you will also read
> `docs/openapi/*.yaml` from there to generate the API client — reading a
> contract is correct; editing one from a web session is not.

**If §0 STATUS does not name `snoopy` as the open repository, you are in the
wrong repo.** Say so and stop. Then read the current round's card in
`AUTOM8X-ROUND-PLAYBOOK.md` §4 before writing anything.

## Rules

1. **One repository per session.** Work only here. A change that appears to need
   `snoopy-backend` is a *finding* to record, not an edit to make.
2. **The design system is the asset.** Reuse `components/ui` primitives and
   `components/dashboard`; no new component may duplicate one that exists.
   Marketing pages must render byte-identically — screenshot diff.
3. **No raw hex** outside the 163 `@theme` tokens in `app/globals.css`.
   (`app/opengraph-image.tsx` is the one exemption: OG image generation cannot
   read CSS custom properties.)
4. **No hand-written `fetch`.** Use `lib/platform-api.ts`; from Round 5 the
   response types are generated from the backend's `docs/openapi/*.yaml`.
5. **The browser holds no secret** — no Supabase key, no database URL, no
   provider token. `npm run audit:boundaries` enforces this in CI and a direct
   database import is an unconditional failure.
6. **Prisma is being removed, in Round 5, via plan items 4.6.4–4.6.7.** The 17
   files still importing it are tracked work — do not delete them ad hoc, and do
   not add an eighteenth.
7. `npm run build` and `npm run lint` clean before every commit.
8. **No push without a passing change audit.** `/audit-change` must PASS for the
   exact tree being pushed — it maps the blast radius of the change and tests
   it, not just the changed feature. The Claude hook in `.claude/settings.json`
   and the native hook (armed once per clone via
   `bash scripts/install-git-hooks.sh`) both enforce the marker.
