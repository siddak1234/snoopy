# Contributing

## Setup

```bash
git clone https://github.com/siddak1234/snoopy.git
cd snoopy
cp .env.example .env.local
npm install
```

The only website configuration is `BACKEND_API_ORIGIN`. A normal UI-only run
does not need any credential. Never add a provider token, Supabase key,
database URL, or object-store credential to this repository.

## Boundaries

- Work in one repository per session. Backend contract or deployment changes
  are findings for their owning repository, not changes to make here.
- Use `lib/platform-api.ts` for browser calls and the generated public OpenAPI
  types for responses. Do not write a new manual `fetch`.
- Do not add Prisma, direct database, Supabase SDK, manual-password, or storage
  access. `npm run audit:boundaries` is the enforcement point.
- Reuse `components/ui` and dashboard primitives. Keep marketing screenshot
  baselines unchanged unless a design change is explicitly approved.

## Pull requests

1. Read `AGENTS.md` and the private master-plan status before changing scope.
2. Create a focused branch; never commit directly to `main`.
3. Stage only the files belonging to the change. Do not use `git add -A` in a
   mixed worktree without confirming every file belongs in the PR.
4. Run the verification set in the README. UI work also requires browser
   baselines; protected-flow work requires the loopback fixture audit.
5. Include contract inputs, user impact, boundary impact, and exact commands in
   the PR body. Open a draft PR first unless it is explicitly ready for review.

Before release approval, perform the core keyboard journey manually in addition
to the automated accessibility checks. Provider/OAuth infrastructure is tested
only in a non-production backend environment; it is never configured here.
