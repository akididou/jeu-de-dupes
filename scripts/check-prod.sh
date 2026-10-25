#!/usr/bin/env bash
# Contrôle du site en production après un déploiement.
# Usage : scripts/check-prod.sh [URL_DE_BASE]   (défaut : https://dupes.jppoizat.fr)
# Code de sortie : nombre de contrôles en échec (0 = tout est OK).
#
# Variables facultatives (essais locaux, ex. contre un nginx de test) :
#   CHECK_CURL_OPTS  options curl ajoutées à chaque appel (ex. "-k" pour un certificat auto-signé)
#   CHECK_HTTP_URL   URL HTTP en clair à tester pour la redirection 301
set -uo pipefail

BASE="${1:-https://dupes.jppoizat.fr}"
BASE="${BASE%/}"
HTTP_URL="${CHECK_HTTP_URL:-http://${BASE#https://}}"
# shellcheck disable=SC2206  # découpage volontaire des options
CURL_OPTS=(-sS --max-time 20 ${CHECK_CURL_OPTS:-})

FAILS=0

pass() { printf 'OK      %s\n' "$1"; }
fail() { printf 'ÉCHEC   %s\n' "$1"; FAILS=$((FAILS + 1)); }

# Code HTTP d'une requête (000 si la connexion échoue).
http_code() {
  local code
  code="$(curl "${CURL_OPTS[@]}" -o /dev/null -w '%{http_code}' "$@" 2>/dev/null)" || true
  printf '%s' "${code:-000}"
}

# En-têtes de réponse, en minuscules et sans CR.
headers_of() {
  curl "${CURL_OPTS[@]}" -D - -o /dev/null "$@" 2>/dev/null | tr -d '\r' | tr '[:upper:]' '[:lower:]'
}

expect_status() {
  local expected="$1" label="$2"
  shift 2
  local got
  got="$(http_code "$@")"
  if [ "$got" = "$expected" ]; then pass "$label -> $got"; else fail "$label -> $got (attendu $expected)"; fi
}

expect_header() {
  local headers="$1" pattern="$2" label="$3"
  if printf '%s\n' "$headers" | grep -Eq "$pattern"; then pass "en-tête $label"; else fail "en-tête $label absent"; fi
}

echo "Contrôle de $BASE"
echo "--- Pages publiques"
expect_status 200 "GET /" "$BASE/"
expect_status 200 "GET /index.html" "$BASE/index.html"
expect_status 200 "GET /manifest.webmanifest" "$BASE/manifest.webmanifest"
expect_status 200 "GET /sw.js" "$BASE/sw.js"
expect_status 200 "GET /js/main.js" "$BASE/js/main.js"
expect_status 200 "GET /data/parfums.json" "$BASE/data/parfums.json"
expect_status 200 "GET /api/parfums" "$BASE/api/parfums"

echo "--- API : JSON non vide"
api_headers="$(headers_of "$BASE/api/parfums")"
api_body="$(curl "${CURL_OPTS[@]}" "$BASE/api/parfums" 2>/dev/null || true)"
if printf '%s' "$api_body" | grep -Eq '^\s*[[{]' && [ "${#api_body}" -gt 10 ]; then
  pass "/api/parfums renvoie du JSON non vide (${#api_body} octets)"
else
  fail "/api/parfums ne renvoie pas de JSON non vide"
fi
expect_header "$api_headers" '^content-type: application/json' "Content-Type JSON sur /api/parfums"
if printf '%s\n' "$api_headers" | grep -q '^access-control-allow-origin:'; then
  fail "/api/parfums expose Access-Control-Allow-Origin"
else
  pass "/api/parfums sans Access-Control-Allow-Origin"
fi

echo "--- Liste blanche : tout le reste en 404"
for path in /nginx/dupes.conf /.git/config /.env /README.md /maquette/ /package.json /scripts/deploy.sh /css/ /assets/ /data/; do
  expect_status 404 "GET $path" "$BASE$path"
done

echo "--- Méthodes"
expect_status 405 "POST /" -X POST -d x "$BASE/"
expect_status 405 "PUT /" -X PUT -d x "$BASE/"

echo "--- En-têtes de sécurité"
root_headers="$(headers_of "$BASE/")"
expect_header "$root_headers" '^content-security-policy:' "Content-Security-Policy"
expect_header "$root_headers" '^strict-transport-security:.*max-age=63072000' "Strict-Transport-Security"
expect_header "$root_headers" '^x-content-type-options: nosniff' "X-Content-Type-Options: nosniff"
expect_header "$root_headers" '^x-frame-options: deny' "X-Frame-Options: DENY"
expect_header "$root_headers" '^referrer-policy: no-referrer' "Referrer-Policy"
expect_header "$root_headers" '^permissions-policy:' "Permissions-Policy"
expect_header "$root_headers" '^cross-origin-opener-policy: same-origin' "Cross-Origin-Opener-Policy"
expect_header "$root_headers" '^cross-origin-resource-policy: same-origin' "Cross-Origin-Resource-Policy"
for path in /js/main.js /api/parfums /nginx/dupes.conf; do
  expect_header "$(headers_of "$BASE$path")" '^content-security-policy:' "CSP sur $path"
done

echo "--- Cache"
expect_header "$(headers_of "$BASE/sw.js")" '^cache-control: no-cache' "sw.js en no-cache"
expect_header "$(headers_of "$BASE/data/parfums.json")" '^cache-control: no-cache' "parfums.json en no-cache"
expect_header "$(headers_of "$BASE/assets/icons/icon-192.png")" '^cache-control: public, max-age=2592000' "icônes en cache long"

echo "--- HTTP vers HTTPS"
http_headers="$(headers_of "$HTTP_URL/")"
if printf '%s\n' "$http_headers" | head -n 1 | grep -q ' 301 '; then
  pass "$HTTP_URL/ -> 301"
else
  fail "$HTTP_URL/ ne renvoie pas 301"
fi
expect_header "$http_headers" '^location: https://' "Location HTTPS sur la redirection"

echo "--- Divulgation de version"
server_line="$(printf '%s\n' "$root_headers" | grep '^server:' || true)"
if printf '%s' "$server_line" | grep -Eq '[0-9]'; then
  fail "l'en-tête Server contient un numéro de version ($server_line)"
else
  pass "pas de version dans l'en-tête Server (${server_line:-absent})"
fi

echo
if [ "$FAILS" -eq 0 ]; then
  echo "Tous les contrôles sont OK."
else
  echo "$FAILS contrôle(s) en échec."
fi
exit "$FAILS"
