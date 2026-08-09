#!/usr/bin/env sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

python3 scripts/content_model.py
python3 scripts/publication.py build
node scripts/build-responsive-media.mjs
