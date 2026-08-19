#!/bin/bash
# Used only by .github/workflows/release.yml publish-script.
# Writes auth into the project .npmrc (what pnpm/changeset actually read),
# then restores the committed placeholder so it cannot be committed.
set -euo pipefail

if [ -z "${NPM_TOKEN:-}" ]; then
  echo "NPM_TOKEN is empty" >&2
  exit 1
fi

restore_npmrc() {
  git checkout -- .npmrc 2>/dev/null || true
}
trap restore_npmrc EXIT

printf '//registry.npmjs.org/:_authToken=%s\nregistry=https://registry.npmjs.org\n@rabjs:registry=https://registry.npmjs.org\n' "$NPM_TOKEN" > .npmrc
pnpm changeset publish
