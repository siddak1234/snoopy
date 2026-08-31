#!/bin/bash
# Arms the committed git hooks for this clone (run once per clone):
# redirects git's hook lookup to the reviewed scripts/githooks/ directory.
set -euo pipefail
cd "$(dirname "$0")/.."
chmod +x scripts/githooks/pre-push
git config core.hooksPath scripts/githooks
echo "git hooks armed: core.hooksPath -> scripts/githooks"
