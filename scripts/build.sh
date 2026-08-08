#!/usr/bin/env sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

rm -rf dist
mkdir -p dist
cp -R src/. dist/

printf '%s\n' 'Built dist/'
