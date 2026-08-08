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
if grep -RniE 'github\.com/ryjen/the-fatherless([^a-zA-Z0-9_-]|$)|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+' src dist; then
  echo 'possible private-repository reference or secret-like material detected' >&2
  exit 1
fi

python3 - <<'PY'
import json
from pathlib import Path

manifest = json.loads(Path('public-manifest.json').read_text())
assert manifest.get('schema_version') == 1, 'unsupported manifest schema'
allowed_tiers = {'placeholder', 'premise', 'early-context', 'approved-excerpt'}
allowed_states = {'placeholder', 'candidate', 'approved', 'published', 'withdrawn', 'superseded'}
seen = set()
for artifact in manifest.get('artifacts', []):
    required = {'id','path','content_type','spoiler_tier','approval_state','rights_status','provenance_class','checksum_sha256','replacement_status'}
    missing = required - artifact.keys()
    assert not missing, f"manifest entry missing fields: {sorted(missing)}"
    assert artifact['id'] not in seen, f"duplicate artifact id: {artifact['id']}"
    seen.add(artifact['id'])
    assert artifact['spoiler_tier'] in allowed_tiers, f"publicly forbidden spoiler tier: {artifact['spoiler_tier']}"
    assert artifact['approval_state'] in allowed_states, f"invalid approval state: {artifact['approval_state']}"
    assert Path(artifact['path']).is_file(), f"manifest path missing: {artifact['path']}"
    serialized = json.dumps(artifact).lower()
    for forbidden in ('github.com/ryjen/the-fatherless', 'private_issue', 'private_path', 'private_revision'):
        assert forbidden not in serialized, f"private provenance field/reference detected in {artifact['id']}"
print('Manifest validation passed.')
PY

printf '%s\n' 'Validation passed.'
