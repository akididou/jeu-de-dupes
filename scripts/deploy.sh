#!/usr/bin/env bash
# Déploiement de « Jeux de Dupes » sur https://dupes.jppoizat.fr
# Usage : scripts/deploy.sh [--first]
#   --first : premier déploiement (config HTTP temporaire, certificat Let's Encrypt, lien nginx).
#
# Seuls les fichiers publics et nginx/ partent sur le serveur (liste blanche ci-dessous), par tar + ssh.
# Rien n'est modifié dans l'arbre de travail : __VERSION__ n'est remplacé que dans une copie temporaire.
set -euo pipefail

SSH_HOST="jppoizat.fr"
SITE_DIR="/home/projects/jeu-de-dupes"
WHITELIST=(index.html manifest.webmanifest sw.js css js assets data nginx)

FIRST=0
case "${1:-}" in
  "") ;;
  --first) FIRST=1 ;;
  *) echo "Usage : $0 [--first]" >&2; exit 2 ;;
esac

step() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERREUR : %s\n' "$*" >&2; exit 1; }

cd "$(dirname "${BASH_SOURCE[0]}")/.."

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# ── 1. Arbre Git propre ───────────────────────────────────────────────────────
step "1/6 Vérification de l'arbre Git"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short --untracked-files=no >&2
  die "des modifications ne sont pas validées (commit) : déploiement refusé."
fi
# Un fichier non suivi dans un dossier public partirait en production sans avoir été relu.
if [ -n "$(git ls-files --others --exclude-standard -- "${WHITELIST[@]}")" ]; then
  git ls-files --others --exclude-standard -- "${WHITELIST[@]}" >&2
  die "fichiers non suivis dans les dossiers publics : déploiement refusé."
fi
COMMIT="$(git rev-parse --short HEAD)"
echo "Commit déployé : $COMMIT"

# ── 2. Copie de secours des données ───────────────────────────────────────────
step "2/6 Mise à jour de data/parfums.json (non bloquant)"
if node scripts/update-fallback.mjs; then
  git diff --quiet -- data/parfums.json || echo "data/parfums.json a changé : pensez à le valider (commit)."
else
  echo "Mise à jour impossible : on garde le fichier actuel."
fi

# ── 3. Construction de l'archive ──────────────────────────────────────────────
step "3/6 Construction de l'archive (liste blanche : ${WHITELIST[*]})"
VERSION="${COMMIT}-$(date -u +%Y%m%d%H%M%S)"
STAGE="$WORK/stage"
mkdir "$STAGE"
# Fichiers suivis par Git uniquement (version de travail, donc avec la copie de secours à jour).
git ls-files -z -- "${WHITELIST[@]}" | tar --null -T - -cf - | tar -xf - -C "$STAGE"
# Fins de ligne LF dans les fichiers texte (git peut les avoir converties en CRLF sous Windows).
find "$STAGE" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' \
  -o -name '*.webmanifest' -o -name '*.svg' -o -name '*.conf' \) -exec sed -i 's/\r$//' {} +
grep -q '__VERSION__' "$STAGE/sw.js" || die "marqueur __VERSION__ introuvable dans sw.js."
sed -i "s/__VERSION__/${VERSION}/" "$STAGE/sw.js"
grep -q "const CACHE = 'dupes-${VERSION}';" "$STAGE/sw.js" || die "remplacement de la version dans sw.js échoué."
for item in "${WHITELIST[@]}"; do
  [ -e "$STAGE/$item" ] || die "élément manquant dans l'archive : $item"
done
tar --owner=0 --group=0 --numeric-owner -czf "$WORK/site.tgz" -C "$STAGE" "${WHITELIST[@]}"
echo "Version du cache : dupes-${VERSION} ($(wc -c < "$WORK/site.tgz") octets)"

# ── 4. Envoi et extraction à côté du site en place ────────────────────────────
step "4/6 Envoi vers $SSH_HOST:${SITE_DIR}.new"
ssh -o BatchMode=yes "$SSH_HOST" "set -euo pipefail
  rm -rf '${SITE_DIR}.new'
  mkdir -p '${SITE_DIR}.new'
  tar -xzf - -C '${SITE_DIR}.new' --no-same-owner
  chown -R root:root '${SITE_DIR}.new'
  find '${SITE_DIR}.new' -type d -exec chmod 755 {} +
  find '${SITE_DIR}.new' -type f -exec chmod 644 {} +" < "$WORK/site.tgz"

# ── 5 et 6. Bascule, test et rechargement nginx (côté serveur) ────────────────
step "5/6 et 6/6 Bascule du dossier, nginx -t, rechargement (mode : $([ "$FIRST" = 1 ] && echo premier déploiement || echo mise à jour))"
ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$SITE_DIR" "$FIRST" <<'REMOTE'
set -euo pipefail
SITE="$1"
FIRST="$2"
OLD="${SITE}.old"
NEW="${SITE}.new"
CACHE_DIR="/var/cache/nginx/dupes"
ENABLED="/etc/nginx/sites-enabled"
BOOT="${ENABLED}/dupes-bootstrap.conf"
LINK="${ENABLED}/dupes.conf"

say() { printf '  - %s\n' "$*"; }

restore_site() {
  say "restauration de l'ancien dossier"
  rm -rf "$SITE"
  if [ -d "$OLD" ]; then mv "$OLD" "$SITE"; fi
}

reload_nginx() {
  nginx -t && systemctl reload nginx
}

# Bascule : l'ancien dossier part en .old (supprimé à la fin, une fois nginx rechargé).
say "bascule de $SITE"
rm -rf "$OLD"
if [ -d "$SITE" ]; then mv "$SITE" "$OLD"; fi
mv "$NEW" "$SITE"

# Cache du proxy opensheet : doit exister et appartenir à www-data avant tout nginx -t.
say "dossier de cache $CACHE_DIR"
mkdir -p "$CACHE_DIR"
chown www-data:www-data "$CACHE_DIR"
chmod 700 "$CACHE_DIR"

if [ "$FIRST" = 1 ]; then
  say "config HTTP temporaire pour le défi ACME"
  cat > "$BOOT" <<'EOC'
server {
    listen 80;
    listen [::]:80;
    server_name dupes.jppoizat.fr;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 404; }
}
EOC
  if ! reload_nginx; then
    rm -f "$BOOT"
    restore_site
    echo "ERREUR : la config temporaire est refusée par nginx." >&2
    exit 1
  fi

  say "certbot (webroot /var/www/certbot)"
  if ! certbot certonly --webroot -w /var/www/certbot -d dupes.jppoizat.fr --non-interactive; then
    rm -f "$BOOT"
    if reload_nginx; then say "config temporaire retirée, nginx rechargé"; fi
    restore_site
    echo "ERREUR : certbot a échoué, le serveur est revenu à son état précédent." >&2
    exit 1
  fi

  say "activation de dupes.conf"
  rm -f "$BOOT"
  ln -sfn "$SITE/nginx/dupes.conf" "$LINK"
fi

say "nginx -t"
if ! nginx -t; then
  echo "ERREUR : nginx -t a échoué, retour à l'ancienne version." >&2
  if [ "$FIRST" = 1 ]; then rm -f "$LINK"; fi
  restore_site
  nginx -t || echo "ATTENTION : nginx -t échoue encore après restauration." >&2
  exit 1
fi

say "rechargement de nginx"
if ! systemctl reload nginx; then
  echo "ERREUR : le rechargement a échoué, retour à l'ancienne version." >&2
  if [ "$FIRST" = 1 ]; then rm -f "$LINK"; fi
  restore_site
  nginx -t && systemctl reload nginx || true
  exit 1
fi

rm -rf "$OLD"
say "terminé"
REMOTE

echo
echo "Déploiement terminé (version dupes-${VERSION}). Lancez scripts/check-prod.sh pour contrôler le site."
