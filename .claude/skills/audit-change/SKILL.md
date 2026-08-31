---
name: audit-change
description: Run the pre-push change audit — blast-radius analysis, full gate suite, and probes for uncovered surfaces — and record the PASS marker the push hooks require. Use before any git push; --live probes production after a merge deploys.
---

Audit the change that is about to be pushed, and record the result the push hooks check. The push gate (`scripts/hooks/require-change-audit.mjs` and `scripts/githooks/pre-push`) blocks any push whose tree has no valid PASS marker — this skill is how a marker is earned.

## Gate mode (default)

1. **Preflight** — every item verified by command, none assumed:
   - `git fetch origin main` (the audit is against current `origin/main`; the marker records the baseline and goes stale if it moves).
   - `git status --porcelain` must show no tracked modifications. Commit or stash first — the audited artifact must be the pushed artifact.
   - Ports 3001 and 3443 must be free (`lsof -nP -iTCP:<port> -sTCP:LISTEN`) and no stray `next dev` may be running — audits build and serve the real app.
   - If `.git/autom8x-audit/lock` names a live pid, another audit is running; wait.
2. **Tier** the change: `BASE=$(git merge-base origin/main HEAD)`; changed files = `git diff --name-only $BASE..HEAD`.
   - Empty, or HEAD tree equals the base tree → report "nothing new ships" and stop; pushes of an already-merged tree are allowed without a marker.
   - All changed paths in `docs/**` or `**/*.md` (and none in `.github/**`) → **docs-only**: run `node scripts/audit/run-gates.mjs`, then `node scripts/audit/record-pass.mjs --docs-only`.
   - Anything else → **full audit**: spawn the `change-auditor` agent (Agent tool, subagent_type `change-auditor`) with the branch context. Do not run the suites yourself in parallel with it — the ports are exclusive.
3. **Record**: only if the agent's verdict is PASS, run `node scripts/audit/record-pass.mjs <verdict-file-path>`. That script is the sole marker writer and re-verifies everything; if it refuses, treat the refusal as a finding, fix, and re-audit. Never edit the marker, the evidence file, or the verdict file by hand — a hand-edited audit trail is worse than no audit.
4. **Report**: verdict; the coverage table; `required_tests` (these are debt to schedule even on PASS); the marker path and its expiry. If the verdict is FAIL: the findings, then fix code or add the named tests and re-run this skill from step 1.

## --live mode (after a merge to main has deployed)

Not a push gate — a post-deploy verification that the change works where users are.

1. Confirm the production deployment for the merged commit is READY (Vercel MCP `list_deployments`, project `snoopy`).
2. Determine the merged change's affected routes/interactions (the merge commit's diff, same blast-radius reasoning as gate mode).
3. Run `node scripts/audit/live-probe.mjs <route> [...routes]` — it drives headless Chromium against `https://www.autom8x.ai` and exits non-zero on any failed assertion. For interaction-level checks the probes in the verdict's `required_tests` are the guide.
4. Report per-route results. A red live probe on a just-deployed change is an incident: say so plainly and propose the revert or fix before anything else.

## Notes

- Markers live in `.git/autom8x-audit/` (per-clone, never committed), keyed by `git rev-parse HEAD^{tree}`, and expire after 24h — untracked inputs like `.env.local` and `node_modules` are invisible to the tree hash, so a stale green must re-earn itself.
- Amending only a commit message keeps the tree, and the marker stays valid; any content change moves the tree and the push blocks again. That is correct, not a bug.
- Manual pushes outside Claude sessions hit the same marker check via `scripts/githooks/pre-push` (armed once per clone with `bash scripts/install-git-hooks.sh`; deliberate bypass is `git push --no-verify`).
