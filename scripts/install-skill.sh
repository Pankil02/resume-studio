#!/usr/bin/env bash
set -euo pipefail

# openResume Skill Installer Wrapper
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if command -v bun >/dev/null 2>&1; then
  exec bun "$REPO_ROOT/bin/openresume.mjs" install "$@"
elif command -v node >/dev/null 2>&1; then
  exec node "$REPO_ROOT/bin/openresume.mjs" install "$@"
else
  echo "Error: Neither bun nor node is installed." >&2
  exit 1
fi
