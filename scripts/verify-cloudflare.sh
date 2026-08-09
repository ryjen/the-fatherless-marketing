#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <https-site-url>" >&2
  exit 64
fi

case "$1" in
  https://*) ;;
  *)
    echo "Cloudflare verification requires an HTTPS URL: $1" >&2
    exit 65
    ;;
esac

base="${1%/}/"
host="$(printf '%s' "$base" | sed -E 's#^https://([^/]+)/.*#\1#')"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

curl_common='--fail --silent --show-error --connect-timeout 10 --max-time 30'

# Verify that the custom domain is actually passing through Cloudflare and
# still serves the current site marker over HTTPS.
# shellcheck disable=SC2086
curl $curl_common --location --dump-header "$tmp/https.headers" \
  --output "$tmp/home.html" "$base"

grep -Fqi 'The Fatherless' "$tmp/home.html" || {
  echo "Cloudflare HTTPS response is missing the public-site identity marker: $base" >&2
  exit 1
}

grep -Eiq '^cf-ray:' "$tmp/https.headers" || {
  echo "Cloudflare proxy header cf-ray is missing for $base" >&2
  exit 1
}

# HTTP must not remain a parallel plaintext public path.
# Do not follow the redirect so the edge behavior itself is tested.
http_url="http://${host}/"
# shellcheck disable=SC2086
curl $curl_common --max-redirs 0 --dump-header "$tmp/http.headers" \
  --output /dev/null "$http_url"

grep -Eq '^HTTP/[0-9.]+ (301|302|307|308)' "$tmp/http.headers" || {
  echo "Cloudflare HTTP endpoint did not return a redirect: $http_url" >&2
  cat "$tmp/http.headers" >&2
  exit 1
}

location="$(awk 'tolower($0) ~ /^location:/ { sub(/\r$/, ""); sub(/^[^:]+:[[:space:]]*/, ""); print; exit }' "$tmp/http.headers")"
case "$location" in
  "https://${host}"|"https://${host}/"|"https://${host}/"*) ;;
  *)
    echo "Cloudflare HTTP redirect does not target HTTPS on the canonical host: ${location:-<missing>}" >&2
    exit 1
    ;;
esac

# Fetch the versioned stylesheet through the edge so stale-cache regressions
# fail on content, while cache disposition is reported for diagnosis.
# shellcheck disable=SC2086
curl $curl_common --location --dump-header "$tmp/css.headers" \
  --output "$tmp/base.css" "${base}styles/base.v1.css"

grep -Fq -- '--text:' "$tmp/base.css" || {
  echo "Cloudflare-served stylesheet is stale or missing expected visual tokens" >&2
  exit 1
}

print_header() {
  label="$1"
  name="$2"
  file="$3"
  value="$(awk -v target="$name" 'index(tolower($0), tolower(target) ":") == 1 { sub(/\r$/, ""); sub(/^[^:]+:[[:space:]]*/, ""); print; exit }' "$file")"
  printf '%s: %s\n' "$label" "${value:-<not present>}"
}

printf 'Verified Cloudflare edge: %s\n' "$base"
print_header 'HTTPS server' 'server' "$tmp/https.headers"
print_header 'Home CF-Cache-Status' 'cf-cache-status' "$tmp/https.headers"
print_header 'CSS CF-Cache-Status' 'cf-cache-status' "$tmp/css.headers"
