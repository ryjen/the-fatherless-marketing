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

browser_ua='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

browser_curl() {
  curl --user-agent "$browser_ua" \
    --header 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8' \
    --header 'Accept-Language: en-US,en;q=0.9' \
    "$@"
}

# Verify that the custom domain is actually passing through Cloudflare and
# still serves the current site marker over HTTPS. Redirects are followed,
# but the final URL must remain on the configured custom host.
home_effective_url="$(browser_curl --fail --silent --show-error \
  --connect-timeout 10 --max-time 30 --location \
  --dump-header "$tmp/https.headers" --output "$tmp/home.html" \
  --write-out '%{url_effective}' "$base")"

case "$home_effective_url" in
  "https://${host}"|"https://${host}/"|"https://${host}/"*) ;;
  *)
    echo "Cloudflare HTTPS response escaped the canonical host: $home_effective_url" >&2
    exit 1
    ;;
esac

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
browser_curl --fail --silent --show-error --connect-timeout 10 --max-time 30 \
  --max-redirs 0 --dump-header "$tmp/http.headers" --output /dev/null "$http_url"

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
css_effective_url="$(browser_curl --fail --silent --show-error \
  --connect-timeout 10 --max-time 30 --location \
  --dump-header "$tmp/css.headers" --output "$tmp/base.css" \
  --write-out '%{url_effective}' "${base}styles/base.v1.css")"

case "$css_effective_url" in
  "https://${host}/styles/base.v1.css") ;;
  *)
    echo "Cloudflare stylesheet response escaped the canonical host: $css_effective_url" >&2
    exit 1
    ;;
esac

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
printf 'Effective HTTPS URL: %s\n' "$home_effective_url"
print_header 'HTTPS server' 'server' "$tmp/https.headers"
print_header 'Home CF-Cache-Status' 'cf-cache-status' "$tmp/https.headers"
print_header 'CSS CF-Cache-Status' 'cf-cache-status' "$tmp/css.headers"
