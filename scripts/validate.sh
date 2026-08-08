#!/usr/bin/env sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

[ -f dist/index.html ] || { echo 'missing dist/index.html' >&2; exit 1; }
grep -qi '<html[^>]*lang=' dist/index.html || { echo 'index.html missing lang attribute' >&2; exit 1; }
grep -qi '<meta[^>]*name="viewport"' dist/index.html || { echo 'index.html missing viewport metadata' >&2; exit 1; }
grep -qi '<title>[^<][^<]*</title>' dist/index.html || { echo 'index.html missing non-empty title' >&2; exit 1; }

h1_count=$(grep -Eio '<h1([[:space:]][^>]*)?>' dist/index.html | wc -l | tr -d ' ')
[ "$h1_count" = 1 ] || { echo "expected exactly one h1, found $h1_count" >&2; exit 1; }

# Public-boundary tripwires. These are intentionally conservative and supplement human review.
if grep -RniE 'github\.com/ryjen/the-fatherless([^a-zA-Z0-9_-]|$)|private[-_ ]?(repo|repository)|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+' src dist; then
  echo 'possible private-repository reference or secret-like material detected' >&2
  exit 1
fi

printf '%s\n' 'Validation passed.'
