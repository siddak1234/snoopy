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

One command, the whole offline gate, in this order: `format:check`, `lint`,
`typecheck`, `audit:boundaries`, `test:contracts`, `verify:platform-contracts`
(skipped out loud when `../snoopy-backend` is not checked out beside this
repository), `build` with `BACKEND_API_ORIGIN=https://backend.invalid` plus the
`/api/platform` rewrite assertion CI makes, `test:browser`, and
`test:browser:fixtures`. The browser suites run in Chromium, Firefox and WebKit
(NFR-36); the marketing screenshots are Chromium's baselines alone. A run in
which every gate ran green ends by emitting
this repository's facts file to `.autom8x/repo-facts/snoopy.json` (gitignored;
`snoopy-backend` commits it as `snoopy-backend/docs/repo-facts/snoopy.json`); a run that had to
skip the sibling gate says so and emits nothing. Run it on Node 22 (`.nvmrc`), the version
CI and the container use. Running it while `/audit-change` runs, or the reverse,
is refused — both build into `.next` and serve on ports 3001 and 3443, so they
share one lock.

`npm run test:browser:fixtures` starts a loopback-only HTTPS Edge fixture with
a temporary certificate and scans every authenticated page with axe. Its tests
drive the published operations the website calls — automations and runs,
connections, teams and project access, billing, export, account deletion, and
the platform's refusals — without real accounts or credentials, and each test
starts from the fixture's first state. The playbook's human keyboard
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
| `npm run test:contracts` | Public-contract and boundary behavior tests |
| `npm run generate:platform-contracts` | Regenerate the typed client from `../snoopy-backend`'s published contracts |
| `npm run verify:platform-contracts` | Report a generated type that differs from its contract; changes nothing |
| `npm run audit:boundaries` | Reject browser secrets, direct DB access, manual fetches, and raw hex colours |
| `npm run test:browser` | Public accessibility in three engines, and Chromium's visual baselines |
| `npm run test:browser:fixtures` | Credential-free authenticated suite, in three engines |

CI (`.github/workflows/ci.yml`) runs these gates as jobs, plus what `npm run
verify` cannot run offline: the dependency audit, a scan of the built image, and
its SBOM.
