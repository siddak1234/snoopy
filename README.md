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
npm run format:check
npm run lint
npm run typecheck
npm run test:contracts
npm run audit:boundaries
npm run verify:platform-contracts
BACKEND_API_ORIGIN=https://backend.invalid npm run build -- --webpack
npm run test:browser
```

`npm run test:browser:fixtures` starts a loopback-only HTTPS Edge fixture with
a temporary certificate. It exercises authenticated accessibility, keyboard,
join-request, idempotency, entitlement, and export paths without real accounts
or credentials.

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
| `npm run build` | Production build |
| `npm run test:contracts` | Public-contract and boundary behavior tests |
| `npm run verify:platform-contracts` | Regenerate and verify public OpenAPI declarations |
| `npm run audit:boundaries` | Reject browser secrets, direct DB access, and manual fetches |
| `npm run test:browser` | Public accessibility and visual baselines |
| `npm run test:browser:fixtures` | Credential-free authenticated fixture audit |
