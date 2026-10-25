#!/usr/bin/env bash
# Déploiement de « Jeux de Dupes » sur https://dupes.jppoizat.fr
# Usage : scripts/deploy.sh [--first] [--keep-data]
#   --first     : premier déploiement (config HTTP temporaire, certificat Let's Encrypt, lien nginx).
#   --keep-data : ne pas relire le Sheet ; data/parfums.json part tel qu'il est dans le commit
#                 (retour à une version précédente).
#
# Seuls les fichiers publics et nginx/ partent sur le serveur (liste blanche ci-dessous), par tar + ssh.
# Rien n'est modifié dans l'arbre de travail : __VERSION__ n'est remplacé que dans une copie temporaire.
set -euo pipefail

SSH_HOST="jppoizat.fr"
POLL_SECONDS=2
MAX_POLLS=450   # 15 minutes au plus (certbot compris)
SITE_DIR="/home/projects/jeu-de-dupes"
WHITELIST=(index.html manifest.webmanifest sw.js css js assets data nginx)

FIRST=0
KEEP_DATA=0
for arg in "$@"; do
  case "$arg" in
    --first) FIRST=1 ;;
    --keep-data) KEEP_DATA=1 ;;
    *) echo "Usage : $0 [--first] [--keep-data]" >&2; exit 2 ;;
  esac
done

step() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERREUR : %s\n' "$*" >&2; exit 1; }

cd "$(dirname "${BASH_SOURCE[0]}")/.."

WORK="$(mktemp -d)"
RDIR=""
trap 'rm -rf "$WORK"' EXIT

rssh() { ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 "$SSH_HOST" "$@"; }

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
# Ce qui part en production doit être exactement le commit : une copie de secours modifiée
# par le Sheet est d'abord relue et validée, puis le déploiement est relancé.
step "2/6 Mise à jour de data/parfums.json depuis le Sheet"
if [ "$KEEP_DATA" = 1 ]; then
  echo "--keep-data : data/parfums.json du commit, sans relire le Sheet."
elif node scripts/update-fallback.mjs; then
  if ! git diff --quiet -- data/parfums.json; then
    git --no-pager diff --stat -- data/parfums.json >&2
    die "data/parfums.json a changé depuis le Sheet. Rien n'a été envoyé.
  Relisez le changement : git diff data/parfums.json
  Validez-le :            git add data/parfums.json && git commit -m \"chore: copie de secours du catalogue\"
  Puis relancez :         scripts/deploy.sh"
  fi
else
  echo "Mise à jour impossible (Sheet injoignable ou refusé) : on garde le fichier validé."
fi

# ── 3. Construction de l'archive ──────────────────────────────────────────────
step "3/6 Construction de l'archive (liste blanche : ${WHITELIST[*]})"
VERSION="${COMMIT}-$(date -u +%Y%m%d%H%M%S)"
STAGE="$WORK/stage"
mkdir "$STAGE"
# Fichiers suivis par Git uniquement ; l'arbre est propre (étapes 1 et 2), donc identique au commit.
git ls-files -z -- "${WHITELIST[@]}" | tar --null -T - -cf - | tar -xf - -C "$STAGE"
# Fins de ligne LF dans les fichiers texte (git peut les avoir converties en CRLF sous Windows).
find "$STAGE" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' \
  -o -name '*.webmanifest' -o -name '*.svg' -o -name '*.conf' \) -exec sed -i 's/\r$//' {} +
[ -z "$(find "$STAGE" -type l -print -quit)" ] || die "l'archive contient des liens symboliques : déploiement refusé."
grep -q '__VERSION__' "$STAGE/sw.js" || die "marqueur __VERSION__ introuvable dans sw.js."
sed -i "s/__VERSION__/${VERSION}/" "$STAGE/sw.js"
grep -q "const CACHE = 'dupes-${VERSION}';" "$STAGE/sw.js" || die "remplacement de la version dans sw.js échoué."
for item in "${WHITELIST[@]}"; do
  [ -e "$STAGE/$item" ] || die "élément manquant dans l'archive : $item"
done
tar --owner=0 --group=0 --numeric-owner -czf "$WORK/site.tgz" -C "$STAGE" "${WHITELIST[@]}"
echo "Version du cache : dupes-${VERSION} ($(wc -c < "$WORK/site.tgz") octets)"


# ── 4. Script distant (exécuté sur le serveur, détaché de la session SSH) ─────
cat > "$WORK/remote.sh" <<'REMOTE'
#!/usr/bin/env bash
# Arguments : <dossier du site> <1 si premier déploiement> <dossier de travail>
# Lancé par deploy.sh via setsid : une coupure SSH ne l'interrompt pas. Il journalise dans
# <travail>/log et écrit son code de sortie dans <travail>/exit. Toute sortie anormale
# (erreur, HUP, Ctrl-C, TERM) défait ce qui a été fait (voir finish).
set -euo pipefail

SITE="$1"
FIRST="$2"
RDIR="$3"
OLD="${SITE}.old"
NEW="${SITE}.new"
CACHE_DIR="/var/cache/nginx/dupes"
ENABLED="/etc/nginx/sites-enabled"
BOOT="${ENABLED}/dupes-bootstrap.conf"
LINK="${ENABLED}/dupes.conf"
LOCK="/run/lock/dupes-deploy.lock"

exec >"$RDIR/log" 2>&1

LOCKED=0          # verrou pris : seul celui qui le détient défait quelque chose
SWAPPED=0         # le nouveau dossier est en place
NGINX_TOUCHED=0   # la config nginx active a pu changer
LINK_CREATED=0    # nous avons créé le lien dupes.conf
DONE=0            # tout s'est bien passé : plus de retour arrière

say() { printf '  - %s\n' "$*"; }

reload_nginx() {
  nginx -t </dev/null && systemctl reload nginx </dev/null
}

restore_site() {
  say "restauration de l'ancien dossier"
  rm -rf "$SITE"
  if [ -d "$OLD" ]; then mv "$OLD" "$SITE"; fi
}

finish() {
  local rc=$?
  set +e
  trap - EXIT HUP INT TERM
  if [ "$LOCKED" = 1 ] && [ "$DONE" != 1 ]; then
    if [ "$rc" -eq 0 ]; then rc=1; fi
    echo "ERREUR ou interruption (code $rc) : retour arrière." >&2
    rm -f "$BOOT"
    if [ "$LINK_CREATED" = 1 ]; then rm -f "$LINK"; fi
    if [ "$SWAPPED" = 1 ]; then
      restore_site
    elif [ ! -d "$SITE" ] && [ -d "$OLD" ]; then
      # Signal reçu entre « mv SITE OLD » et SWAPPED=1 : l'ancien dossier revient à sa place.
      say "remise en place de l'ancien dossier"
      mv "$OLD" "$SITE"
    fi
    rm -rf "$NEW"
    if [ "$SWAPPED" = 1 ] || [ "$NGINX_TOUCHED" = 1 ]; then
      reload_nginx || echo "ATTENTION : nginx n'a pas pu être rechargé après le retour arrière." >&2
    fi
  fi
  printf '%s\n' "$rc" > "$RDIR/exit.tmp"
  mv "$RDIR/exit.tmp" "$RDIR/exit"
  exit "$rc"
}
trap finish EXIT
trap 'exit 1' HUP INT TERM

# Un seul déploiement à la fois.
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "ERREUR : un autre déploiement est en cours." >&2
  exit 1
fi
LOCKED=1

# Reprise après un arrêt brutal (SIGKILL) : l'ancien dossier est réputé bon.
if [ ! -d "$SITE" ] && [ -d "$OLD" ]; then mv "$OLD" "$SITE"; fi

say "extraction dans $NEW"
rm -rf "$NEW"
mkdir -p "$NEW"
tar -xzf "$RDIR/site.tgz" -C "$NEW" --no-same-owner
if [ -n "$(find "$NEW" -type l -print -quit)" ]; then
  echo "ERREUR : l'archive contient des liens symboliques." >&2
  exit 1
fi
chown -R root:root "$NEW"
find "$NEW" -type d -exec chmod 755 {} +
find "$NEW" -type f -exec chmod 644 {} +
for required in index.html sw.js nginx/dupes.conf nginx/security-headers.conf; do
  if [ ! -f "$NEW/$required" ]; then
    echo "ERREUR : $required absent de l'archive." >&2
    exit 1
  fi
done

# Cache du proxy opensheet : avant tout nginx -t.
say "dossier de cache $CACHE_DIR"
mkdir -p "$CACHE_DIR"
chown www-data:www-data "$CACHE_DIR"
chmod 700 "$CACHE_DIR"

if [ "$FIRST" = 1 ]; then
  say "config HTTP temporaire pour le défi ACME"
  NGINX_TOUCHED=1
  cat > "$BOOT" <<'EOC'
server {
    listen 80;
    listen [::]:80;
    server_name dupes.jppoizat.fr;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 404; }
}
EOC
  reload_nginx
  say "certbot (webroot /var/www/certbot)"
  certbot certonly --webroot -w /var/www/certbot -d dupes.jppoizat.fr --non-interactive </dev/null
  rm -f "$BOOT"
fi

# Bascule : l'ancien dossier part en .old (supprimé une fois nginx rechargé).
say "bascule de $SITE"
rm -rf "$OLD"
if [ -d "$SITE" ]; then mv "$SITE" "$OLD"; fi
SWAPPED=1
mv "$NEW" "$SITE"

if [ "$FIRST" = 1 ]; then
  say "activation de dupes.conf"
  if [ ! -e "$LINK" ] && [ ! -L "$LINK" ]; then LINK_CREATED=1; fi
  ln -sfn "$SITE/nginx/dupes.conf" "$LINK"
fi

say "nginx -t"
nginx -t </dev/null
NGINX_TOUCHED=1
say "rechargement de nginx"
systemctl reload nginx </dev/null

DONE=1
rm -rf "$OLD"
say "terminé"
REMOTE
bash -n "$WORK/remote.sh" || die "script distant invalide."

# ── 5. Envoi puis exécution détachée ──────────────────────────────────────────
step "4/6 Envoi vers $SSH_HOST"
RDIR="$(rssh "bash -c 'mktemp -d /root/.dupes-deploy.XXXXXX'")"
case "$RDIR" in /root/.dupes-deploy.??????) ;; *) die "dossier distant inattendu : '$RDIR'" ;; esac
rssh "bash -c 'cat > \"${RDIR}/site.tgz\"'" < "$WORK/site.tgz"
rssh "bash -c 'cat > \"${RDIR}/remote.sh\"'" < "$WORK/remote.sh"

step "5/6 Bascule du dossier, nginx -t, rechargement (mode : $([ "$FIRST" = 1 ] && echo premier déploiement || echo mise à jour))"
rssh "bash -c 'cd / && setsid nohup bash \"${RDIR}/remote.sh\" \"${SITE_DIR}\" \"${FIRST}\" \"${RDIR}\" >/dev/null 2>&1 </dev/null &'"

# Lecture du journal distant (reprend seule après une coupure) jusqu'au code de sortie.
step "6/6 Suivi du déploiement distant"
printed=0
polls=0
failures=0
exit_code=""
while [ -z "$exit_code" ] && [ "$polls" -lt "$MAX_POLLS" ]; do
  polls=$((polls + 1))
  if out="$(rssh "bash -c 'tail -n +$((printed + 1)) \"${RDIR}/log\" 2>/dev/null; if [ -f \"${RDIR}/exit\" ]; then echo \"__EXIT__ \$(cat \"${RDIR}/exit\")\"; fi'")"; then
    failures=0
    marker="$(printf '%s\n' "$out" | grep '^__EXIT__ ' || true)"
    body="$(printf '%s\n' "$out" | grep -v '^__EXIT__ ' || true)"
    if [ -n "$body" ]; then
      printf '%s\n' "$body"
      printed=$((printed + $(printf '%s\n' "$body" | wc -l)))
    fi
    if [ -n "$marker" ]; then exit_code="${marker#__EXIT__ }"; fi
  else
    failures=$((failures + 1))
    echo "(connexion SSH perdue, nouvel essai ; le déploiement continue sur le serveur)" >&2
    [ "$failures" -lt 60 ] || break
  fi
  if [ -z "$exit_code" ]; then sleep "$POLL_SECONDS"; fi
done

if [ -z "$exit_code" ]; then
  die "état du déploiement indéterminé : consulter $RDIR/log sur $SSH_HOST."
fi
rssh "bash -c 'rm -rf \"${RDIR}\"'" || echo "(dossier distant $RDIR à supprimer à la main)" >&2
if [ "$exit_code" != 0 ]; then
  die "le déploiement distant a échoué (code $exit_code) ; aucune modification de ce déploiement n'est conservée sur le serveur."
fi

echo
echo "Déploiement terminé (version dupes-${VERSION}). Lancez scripts/check-prod.sh pour contrôler le site."
