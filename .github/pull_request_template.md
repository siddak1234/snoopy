## What this adds

<!-- 1–3 sentences: what service/change and why -->

## Checklist

- [ ] Follows `docs/REPO-STRUCTURE.md` (routes in `app/`, logic in `lib/`, UI in `components/`)
- [ ] `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:contracts`, and `npm run audit:boundaries` pass locally
- [ ] Public contract changes use generated types; no manual browser `fetch` was added
- [ ] UI changes have browser/a11y evidence; protected-flow changes have fixture or non-production observations
- [ ] No database, Supabase, object-store, provider, or browser secret appears in the diff
- [ ] `BACKEND_API_ORIGIN` remains the only website configuration value

## Screenshots / demo

<!-- Screenshots of the solution page / dashboard views this PR adds -->
