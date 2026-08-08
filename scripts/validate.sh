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
import hashlib
import json
import re
from pathlib import Path

manifest = json.loads(Path('public-manifest.json').read_text())
assert manifest.get('schema_version') == 1, 'unsupported manifest schema'
allowed_tiers = {'placeholder', 'premise', 'early-context', 'approved-excerpt'}
allowed_states = {'placeholder', 'candidate', 'approved', 'published', 'withdrawn', 'superseded'}
allowed_replacement = {'current', 'withdrawn', 'superseded'}
media_suffixes = {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg', '.pdf'}
seen = set()
manifest_paths = set()
for artifact in manifest.get('artifacts', []):
    required = {'id','path','content_type','spoiler_tier','approval_state','rights_status','provenance_class','checksum_sha256','replacement_status'}
    missing = required - artifact.keys()
    assert not missing, f"manifest entry missing fields: {sorted(missing)}"
    assert artifact['id'] not in seen, f"duplicate artifact id: {artifact['id']}"
    seen.add(artifact['id'])
    assert artifact['spoiler_tier'] in allowed_tiers, f"publicly forbidden spoiler tier: {artifact['spoiler_tier']}"
    assert artifact['approval_state'] in allowed_states, f"invalid approval state: {artifact['approval_state']}"
    assert artifact['replacement_status'] in allowed_replacement, f"invalid replacement status: {artifact['replacement_status']}"

    path = Path(artifact['path'])
    assert path.is_file(), f"manifest path missing: {artifact['path']}"
    manifest_paths.add(path.as_posix())

    if artifact['approval_state'] == 'candidate':
        assert path.parts[0] != 'src', f"candidate artifact must not be build-visible: {artifact['path']}"

    checksum = artifact['checksum_sha256']
    if artifact['approval_state'] in {'approved', 'published'}:
        assert isinstance(checksum, str) and re.fullmatch(r'[0-9a-f]{64}', checksum), f"approved artifact requires sha256: {artifact['id']}"
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        assert checksum == actual, f"checksum mismatch for {artifact['id']}"
    elif checksum is not None:
        assert isinstance(checksum, str) and re.fullmatch(r'[0-9a-f]{64}', checksum), f"invalid sha256 for {artifact['id']}"

    if path.suffix.lower() in media_suffixes:
        media_required = {'creator_class', 'rights_basis', 'attribution_required', 'metadata_review'}
        media_missing = media_required - artifact.keys()
        assert not media_missing, f"media provenance fields missing for {artifact['id']}: {sorted(media_missing)}"
        assert artifact['creator_class'] in {'author-created','commissioned','generated','stock','public-domain','historical','contributor-owned'}, f"invalid creator_class: {artifact['id']}"
        assert isinstance(artifact['rights_basis'], str) and artifact['rights_basis'].strip(), f"rights_basis required: {artifact['id']}"
        assert isinstance(artifact['attribution_required'], bool), f"attribution_required must be boolean: {artifact['id']}"
        assert artifact['metadata_review'] in {'stripped','reviewed-retained','not-applicable'}, f"invalid metadata_review: {artifact['id']}"

    serialized = json.dumps(artifact).lower()
    for forbidden in ('github.com/ryjen/the-fatherless', 'private_issue', 'private_path', 'private_revision'):
        assert forbidden not in serialized, f"private provenance field/reference detected in {artifact['id']}"

# Every public media file must be explicitly governed by the manifest.
for path in Path('src').rglob('*'):
    if path.is_file() and path.suffix.lower() in media_suffixes:
        assert path.as_posix() in manifest_paths, f"unmanifested public media: {path}"

# Heuristic leak detector: very large prose-like public source files require explicit excerpt classification.
for path in Path('src').rglob('*'):
    if not path.is_file() or path.suffix.lower() not in {'.html', '.md', '.txt'}:
        continue
    text = path.read_text(errors='ignore')
    words = re.findall(r"\b[\w’'-]+\b", text)
    if len(words) >= 8000:
        entry = next((a for a in manifest.get('artifacts', []) if a['path'] == path.as_posix()), None)
        assert entry and entry['spoiler_tier'] == 'approved-excerpt' and entry['approval_state'] in {'approved','published'}, f"suspicious manuscript-scale text import: {path} ({len(words)} words)"

# Dependency-free metadata tripwires for common formats. False positives are intentionally avoided.
for path in Path('src').rglob('*'):
    if not path.is_file():
        continue
    data = path.read_bytes()
    suffix = path.suffix.lower()
    if suffix in {'.jpg', '.jpeg'}:
        assert b'Exif\x00\x00' not in data, f"JPEG EXIF metadata present: {path}"
    elif suffix == '.png':
        assert not any(chunk in data for chunk in (b'tEXt', b'zTXt', b'iTXt', b'eXIf')), f"PNG embedded metadata present: {path}"
print('Manifest and publication-boundary validation passed.')
PY

printf '%s\n' 'Validation passed.'
