#!/bin/bash
set -e

if [ -z "$NPM_TOKEN" ]; then
  echo "Error: NPM_TOKEN is not set."
  exit 1
fi

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN is not set."
  exit 1
fi

# ---------------------------------------------------------
# (1) Publish to npm
# ---------------------------------------------------------
echo "[START] Publish to npm"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
pnpm changeset publish
rm .npmrc

echo "[DONE] Published to npm!"

# ---------------------------------------------------------
# (2) Publish to GitHub Packages
# ---------------------------------------------------------
echo "[START] Publish to GitHub Packages"
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" > .npmrc
echo "@rutan:registry=https://npm.pkg.github.com/" >> .npmrc
pnpm -r publish --no-git-checks
rm .npmrc

echo "[DONE] Published to GitHub Packages!"
