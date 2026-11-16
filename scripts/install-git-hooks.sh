#!/bin/bash
# Arms the committed git hooks for this clone (run once per clone):
# redirects git's hook lookup to the reviewed scripts/githooks/ directory:
# pre-commit runs the private-data scan; pre-push runs it and the kit's workflow lint,
# then the gates.
set -euo pipefail
cd "$(dirname "$0")/.."
chmod +x scripts/githooks/pre-commit scripts/githooks/pre-push
git config core.hooksPath scripts/githooks
echo "git hooks armed: core.hooksPath -> scripts/githooks"
