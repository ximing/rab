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

# pnpm does not interpolate ${NPM_TOKEN} / ${NODE_AUTH_TOKEN} in .npmrc.
# setup-node also sets NPM_CONFIG_USERCONFIG to a temp file with an
# unexpanded ${NODE_AUTH_TOKEN}, which overrides the project file.
# Write the literal token to both places, matching the v1 action behavior
# that last published successfully.
auth="$(printf '//registry.npmjs.org/:_authToken=%s\nregistry=https://registry.npmjs.org\n@rabjs:registry=https://registry.npmjs.org\nalways-auth=true\n' "$NPM_TOKEN")"
printf '%s' "$auth" > .npmrc
if [ -n "${NPM_CONFIG_USERCONFIG:-}" ]; then
  printf '%s' "$auth" > "$NPM_CONFIG_USERCONFIG"
fi
unset NPM_CONFIG_USERCONFIG
pnpm changeset publish
