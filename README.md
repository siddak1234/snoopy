# Snoopy — Autom8x website

This repository owns the Autom8x website: public marketing, the authenticated
web app, and its same-origin gateway to the platform. It is not a database,
identity-provider, object-store, or connector-secret owner.

## Architecture boundary

- Next.js 16, React 19, TypeScript, Tailwind 4, and the Nocturne design system.
- The website consumes only published Edge API contracts generated from public
  OpenAPI documents. It does not author backend contracts.
- OAuth login is backend-mediated. The browser holds no provider token,
  Supabase key, database URL, or service credential.
- `BACKEND_API_ORIGIN` is the only website runtime/build configuration value.

See [Architecture](docs/ARCHITECTURE.md) and
[Repository structure](docs/REPO-STRUCTURE.md) for the current ownership model.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `BACKEND_API_ORIGIN` to a non-production Edge origin when exercising
authenticated features. Do not add cloud, OAuth, database, or provider secrets
to this repository or to `.env.local`.

## Verification

```bash
npm run verify
```

One command, the whole offline gate, in this order: `format:check`,
`check:docs` (each changed area's doc changed with it, each fact in its one
place, and every file a changed doc names exists: `docs/docs-map.json`),
`map -- --check` (`docs/MAP.md` is what `npm run map` builds from the tree),
`lint`, `typecheck`, `audit:boundaries`, `test:contracts`, `verify:platform-contracts`
(skipped out loud when `../snoopy-backend` is not checked out beside this
repository), `build:no-backend` (the site with no backend, as a Vercel preview
builds it), `probe:no-backend` (that build served as a preview serves it: the
public pages load, the account area sends a visitor to sign in, and readiness
says "not configured"), `build` with `BACKEND_API_ORIGIN=https://backend.invalid` plus the
`/api/platform` rewrite assertion CI makes, `test:browser`, and
`test:browser:fixtures`. Locally, the browser suites run in Chromium and
Firefox. WebKit runs in GitHub CI on Linux, where it passes. CI runs all three
engines (NFR-36), and all-green needs every one. On the owner's Mac,
Playwright's WebKit fails dozens of the fixture suite's tests that pass in CI,
even on unchanged `main`, so it was left to CI (the owner's decision of
2026-10-14, register F104). Every local browser run says so as it starts.
`AUTOM8X_WEBKIT=1` runs WebKit locally on purpose. The marketing screenshots
are Chromium's baselines alone. A run in
which every gate ran green ends by emitting
this repository's facts file to `.autom8x/repo-facts/snoopy.json` (gitignored;
`snoopy-backend` commits it as `snoopy-backend/docs/repo-facts/snoopy.json`); a run that had to
skip the sibling gate says so and emits nothing. Run it on Node 22 (`.nvmrc`), the version
CI and the container use. Running it while `/audit-change` runs, or the reverse,
is refused — both build into `.next` and serve on ports 3001 and 3443, so they
share one lock, and a port anything already listens on is refused before either
starts (the preflight binds each one; `lsof` cannot see a renamed `next-server`).

`npm run test:browser:fixtures` starts a loopback-only HTTPS Edge fixture with
a temporary certificate and scans every authenticated page with axe. Here it
runs in Chromium and Firefox; CI runs it once per engine, WebKit's leg
included (register F104). Its tests drive the published operations the website calls — flows and runs, archiving
a flow and the archived ones, adding a flow (it goes to the department of its
category, which the platform makes when there is none, and its Set up opens;
a catalog with nothing to add), the dashboard (Today's three tiles, counted
from the browser's midnight and each opening Activity from it; the approvals
banner while something waits; Add a flow and Flows; Recent runs; and a
workspace with no flow yet), a flow's page (its live Dashboard, its five
Steps — titles only, Step 1 holding the run's fields and Start run, step 2 its
integration, step 4 titled by the flow's choice, step 5 who gets the email —
and Edit setup; no Connections and no move to another version), its Set up
(Turn on, or Save; a member makes a newly added flow's first choice there, a
connected vendor or None, and on a flow already on sees it read-only), its
Connect integration page (a tap saves and goes back; a vendor connected from
it comes back chosen, one connected meanwhile is reused, and a refused
connect is said under its row; a member sees the integration and no row is a
choice; a flow still on an older version
with no vendor to choose is sent to Connections instead), who gets its email
(an owner or admin adds and removes addresses, each saved at once, at most
ten; a member reads them), a run's page (every step from the start — its
integration and its email among them, the running one spinning — read again
while it goes on, a held job's step 4 with Approve and Deny, appearing with no
reload when the job reaches it while its page is open — read again at most
ten times, never once listed or gone on, a failed read keeping the page —
each document it read a closed row of its own that opens in place — headed in its
flow's word ("Invoice 1 of 3" for Invoice Processing, "Document 1 of 3" for a flow
that names none; the catalog's `documentWords`), its Document type and Format — and View package, Download PDF and
Download Excel, each download to the platform's signed link, an https one
only), the run
package's page (the PDF itself, in a frame of the site's inline route that
answers it `application/pdf` inline, a busy platform asked once more; its
downloads, an https link only; a job with no package yet), Approvals (each
row its flow and step, fewer words when those cannot be read; a decided row
leaves, and the last one goes to Activity; a run page that keeps itself
through refused re-reads, and tells a member watching a job turn held who can
decide), a document headed in its flow's word or else "Document", the A8X
mark's near-black #212121 on the light ground of the site, the account, Sign
in and Set up your organization, every run by its
full id, a run's file (PUT straight to the fixture's object store, across
origins), a webhook flow's address, connections (one row each — mark, name, the account's email or its
state, one button — each disconnect confirmed first; every row pinned in both palettes, read as data:
its mark, words, colours and height, the app's row snapshot's half), departments (a
department is a project in the platform's contract: its members, asking to
join and the answers), setting up an organization
(a refused domain claim retried on the organization made), the organization's
join link,
unlinking a sign-in account (each refusal, and a platform with no unlink yet),
billing (Free, Plus and Pro — the platform's, or the one the website draws
while the platform lists none — and a second plan refused), the quick and the
complete export (its link followed only when https), account deletion, and the platform's refusals —
without real accounts or credentials, and each test starts from the fixture's
first state. Four specs: `e2e/accessibility.spec.ts`,
`e2e/public-edge-fixture.spec.ts`, `e2e/account-surfaces.spec.ts` (every
surface a change audit probed and no test asserted) and `e2e/dialogs.spec.ts`
(every dialog's Escape, click outside, focus return and hold, one row each),
sharing `e2e/helpers.ts`. The playbook's human keyboard
traversal (NFR-35) has a hand-over test in the same suite:
`KEYBOARD_JOURNEY=1 node scripts/run-browser-fixtures.mjs --headed --grep "keyboard journey"`
opens the built site against the fixture, signed in, and pauses for the person
at the keyboard; it is skipped otherwise.

## Container

The website image is standalone and runs as the non-root `nextjs` user. Start
the platform stack first from `../snoopy-backend`, then run:

```bash
docker compose up -d --build web
```

`compose.yml` joins the platform's external `autom8x_default` network and
passes `http://api:8080` as the internal Edge origin. Production resource and
secret provisioning belongs to the deployment configuration round, not here.

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run verify` | The whole offline gate in one command; emits the facts file |
| `npm run build` | Production build |
| `npm run build:no-backend` | The build a Vercel preview makes: no `BACKEND_API_ORIGIN` |
| `npm run probe:no-backend` | Serve that build as a preview does, and check what a visitor gets |
| `npm run test:contracts` | Public-contract and boundary behavior tests, and the common kit's own (`scripts/kit/kit.test.mjs`) |
| `npm run check:docs` | Each changed area's doc changed with it, and each fact in one place (`docs/docs-map.json`) |
| `npm run map` | Rebuild `docs/MAP.md` from the tree; `-- --check` fails when it is stale |
| `npm run generate:platform-contracts` | Regenerate the typed client from `../snoopy-backend`'s published contracts |
| `npm run verify:platform-contracts` | Report a generated type that differs from its contract; changes nothing |
| `npm run audit:boundaries` | Reject browser secrets, direct DB access, manual fetches, and raw hex colours |
| `npm run test:browser` | Public accessibility in Chromium and Firefox (and WebKit in CI), and Chromium's visual baselines |
| `npm run test:browser:fixtures` | Credential-free authenticated suite, in Chromium and Firefox (and WebKit in CI) |

CI (`.github/workflows/ci.yml`) runs these gates as jobs on every pull request,
plus what `npm run verify` cannot run offline: the dependency audit, a scan of
the built image, and its SBOM. On `main`, `.github/workflows/main.yml` runs a
smoke (lint, format, typecheck, the contract tests) when the merged commit's
tree is the one its pull request's all-green passed, and the whole suite
otherwise. `npm run hooks:install` arms the pre-push hook
(`scripts/githooks/pre-push`), which requires the change-audit marker and runs
the seven fast gates `npm run verify` begins with (see "Verification"; ~30 s):
every gate before its builds but the map's check, which `test:contracts` makes
too (`test/kit-repo.test.mjs`). CI is the authority for the rest; its
Architecture gates job runs `check:docs` and the map's check on the pull
request's commits.
