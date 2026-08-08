#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <site-base-url>" >&2
  exit 64
fi

case "$1" in
  https://*) ;;
  *)
    echo "site base URL must use HTTPS: $1" >&2
    exit 65
    ;;
esac

base="${1%/}/"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

fetch() {
  url="$1"
  output="$2"
  attempt=1
  while [ "$attempt" -le 12 ]; do
    if curl --fail --silent --show-error --location \
      --connect-timeout 10 --max-time 30 \
      --output "$output" "$url"; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  echo "failed to fetch deployed URL after retries: $url" >&2
  return 1
}

for route in '' 'books/' 'characters/' 'world/' 'news/' 'about/'; do
  name="$(printf '%s' "${route:-home}" | tr '/ ' '__')"
  file="$tmp/${name}.html"
  fetch "${base}${route}" "$file"
  grep -Eiq '<!doctype html>|<html[ >]' "$file" || {
    echo "deployed route is not HTML: ${base}${route}" >&2
    exit 1
  }
  grep -Fqi 'The Fatherless' "$file" || {
    echo "deployed route is missing the public-site identity marker: ${base}${route}" >&2
    exit 1
  }
done

fetch "${base}styles/base.v1.css" "$tmp/base.css"
grep -Fq -- '--text:' "$tmp/base.css" || {
  echo "deployed base stylesheet is missing expected visual tokens" >&2
  exit 1
}

printf 'Verified deployed Pages origin: %s\n' "$base"
