#!/usr/bin/env bash
# Commits the desktop app and pushes it to both places:
#   1. GT_Desk (this repo, on GitHub) — branch main
#   2. the team repo, as apps/desktop on its desktop/app branch
#
#   bash scripts/ship.sh "What changed"
set -euo pipefail

MESSAGE="${1:?Usage: bash scripts/ship.sh \"What changed\"}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TEAM="${TEAM_DESKTOP:-$HERE/../gametime-team-desktop}"

cd "$HERE"
git add -A
if git diff --cached --quiet; then
  echo "GT_Desk: nothing new to commit"
else
  git commit -q -m "$MESSAGE"
fi
git push -q origin main
echo "GT_Desk: pushed"

# The team copy: same files under apps/desktop (its lockfile lives at the workspace root).
# CLAUDE.md, HANDOFF.md and .claude/ are notes for working on GT_Desk, so they stay out of it.
if [ ! -d "$TEAM/.git" ] && [ ! -f "$TEAM/.git" ]; then
  echo "Team repo not found at $TEAM; skipped"
  exit 0
fi
rsync_like() {
  tar --exclude=node_modules --exclude=dist --exclude='*.local' --exclude=.git --exclude=package-lock.json \
    --exclude=.claude --exclude=CLAUDE.md --exclude=HANDOFF.md -cf - . |
    (cd "$TEAM/apps/desktop" && tar -xf -)
}
rsync_like
cd "$TEAM"
git add apps/desktop
if git diff --cached --quiet; then
  echo "Team repo: nothing new to commit"
else
  git commit -q -m "$MESSAGE"
fi
git push -q origin desktop/app
echo "Team repo (desktop/app): pushed"
