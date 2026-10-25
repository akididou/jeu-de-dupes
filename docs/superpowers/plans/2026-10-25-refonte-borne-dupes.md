# Refonte borne « Jeux de Dupes » : plan d'implémentation

> **Pour les agents :** sous-skill requis : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** remplacer le site actuel par la borne validée sur maquette (recherche, collections, familles olfactives, ticket, FR/EN, retour auto, hors-ligne), puis la déployer de façon sécurisée sur `https://dupes.jppoizat.fr`.

**Architecture :** site statique en modules ES natifs, sans compilation. Les fonctions pures (`search.js`, `data.js`, `format.js`, `idle.js`) sont séparées du rendu DOM (`views.js`) et de l'orchestration (`main.js`). Un service worker gère le hors-ligne. nginx sert une liste blanche de fichiers et relaie le Google Sheet via `/api/parfums`.

**Pile technique :** HTML/CSS/JS ES2022, Vitest + @vitest/coverage-v8 (tests unitaires), @playwright/test (parcours), http-server (serveur de dev), nginx + certbot (production).

**Spec :** `docs/superpowers/specs/2026-10-25-refonte-borne-dupes-design.md`. La maquette de référence est `maquette/` (`app.js`, `style.css`, `index.html`) : porter son code plutôt que le réécrire.

## Contraintes globales

- Aucune dépendance livrée en production ; `package.json` contient uniquement des `devDependencies`.
- Aucun script ni ressource tiers à l'exécution (polices hébergées avec le site). La CSP de la spec §7.5 doit passer sans violation : pas de `style=""` inline, pas de `<script>` inline, pas de `innerHTML` avec des données.
- Données affichées uniquement via `textContent` / `createElement`.
- Limites de validation : nom ≤ 200, marque ≤ 100, numéro ≤ 10, note ≤ 40, 8 notes max par étage. Catégories `femme` | `homme`.
- `FAMILLES` (ordre d'affichage) : `Hespéridé, Aquatique, Aromatique, Floral, Chypré, Boisé, Ambré, Gourmand, Cuir, Musqué`.
- Inactivité : 60 s au total, avertissement à 10 s. Le paramètre `?idle=N` surcharge la durée.
- Délai réseau : 6000 ms. Source principale : `/api/parfums` ; copie de secours : `data/parfums.json`.
- Zones tactiles ≥ 48 px ; `prefers-reduced-motion` respecté ; pas de défilement horizontal à 390 px.
- Commits conventionnels en français, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Travail sur la branche `refonte-borne`.

## Points de vigilance

1. **opensheet renvoie un objet d'erreur** (`{"error": ...}`) ou un tableau vide au lieu des données : bascule sur la copie de secours, sans plantage. Test dans la tâche 3.
2. **Double tap rapide sur une ligne** : `showModal()` sur un dialog déjà ouvert lève `InvalidStateError`. La fonction `openTicket` ne doit rien faire si le dialog est ouvert. Test e2e dans la tâche 5.
3. **Requête faite uniquement d'espaces ou de ponctuation** (`"  -- "`) : elle est traitée comme une recherche vide, sans écran « aucun résultat ». Tests dans les tâches 2 et 5.
4. **Ancienne version servie par le service worker après un déploiement** : le nom du cache contient une version que `deploy.sh` remplace à chaque envoi. Test dans la tâche 6.
5. **Noms longs sur mobile** (ex. « ROUGE SMOCKING EXTRAIT », « Francis Kurkdjian ») : pas de débordement horizontal du ticket ni de la page à 390 px. Test e2e dans la tâche 5.

---

### Tâche 1 : outillage et nettoyage

**Fichiers :**
- Créer : `package.json`, `vitest.config.js`, `playwright.config.js`
- Supprimer : `TEST-RAPIDE.html`, `start-server.bat`, `start-server.sh`, `netlify.toml`, `vercel.json`, `.env.example`, `js/data.js` (ancien), `js/main.js` (ancien)
- Déplacer : `docs/*.md` → `docs/archive/`

**Interfaces :**
- Produit : `npm test` (Vitest, `tests/unit/**/*.test.js`, environnement `node`), `npm run test:coverage` (seuils de 80 % sur `js/search.js`, `js/data.js`, `js/format.js`, `js/idle.js`), `npm run test:e2e` (Playwright, `tests/e2e`, webServer `http-server . -p 4173 -c-1 -s`, `baseURL http://localhost:4173`, projets `tablette-paysage` 1180×820, `tablette-portrait` 820×1180, `mobile` 390×844, Chromium), `npm run serve` (même serveur).

- [ ] **Étape 1 :** `npm init -y`, puis `"type": "module"`, `"private": true` et les scripts ci-dessus. `npm i -D vitest @vitest/coverage-v8 @playwright/test http-server`, puis `npx playwright install chromium`.
- [ ] **Étape 2 :** supprimer et déplacer les fichiers listés (`git rm`, `git mv`).
- [ ] **Étape 3 :** `npm test` doit sortir proprement avec « No test files found » (code 0 grâce à `passWithNoTests: true`).
- [ ] **Étape 4 :** commit `chore: outillage de tests et nettoyage des fichiers obsolètes`.

### Tâche 2 : moteur de recherche (`js/search.js`)

**Fichiers :** créer `js/search.js` et `tests/unit/search.test.js`.

**Interfaces :**
- Produit :
  - `normalize(text: string): string` : NFD, suppression des diacritiques, minuscules, tout caractère hors `[a-z0-9]` remplacé par un espace, espaces fusionnés, `trim`.
  - `levenshtein(a: string, b: string): number` : renvoie `2` dès que les longueurs diffèrent de plus de 1.
  - `buildIndex(p: {nom, marque, famille, sousFamille, tete, coeur, fond}): {words: string[], compact: string, nomCompact: string, noteWords: string[]}`.
  - `search(query: string, parfums: Parfum[]): Parfum[]`, où chaque `Parfum` porte un champ `index` issu de `buildIndex`.
- Score par mot de la requête (même algorithme que `maquette/app.js` `tokenScore`) : numéro exact 100 ; mot exact 80 ; début de mot 60 ; inclus dans `compact` 40 ; début d'une note, famille ou sous-famille (mot de 3 lettres ou plus) 30 ; faute tolérée (mot de 4 lettres ou plus, distance ≤ 1 avec un mot entier ou avec son préfixe de même longueur) 20 ; sinon 0. Chaque mot doit marquer des points, sauf si la requête entière collée est incluse dans `compact`. Bonus +50 si `nomCompact` est égal à la requête collée. Tri par score décroissant, puis marque, puis nom (`localeCompare` en `fr`).

- [ ] **Étape 1 :** écrire les tests :
  - `normalize("J'ADORE  Éclat")` → `"j adore eclat"` ; `normalize("  -- ")` → `""` ;
  - `levenshtein("sauvge","sauvage")` → 1 ; `levenshtein("abc","abcdef")` → 2 ;
  - `search("jadore", P)` → J'ADORE en premier ;
  - `search("sauvge", P)` contient SAUVAGE et EAU SAUVAGE ;
  - `search("127", P)[0].numero` → `"127"` ;
  - `search("vanille", P)` contient un parfum qui n'a la vanille qu'en `fond` ;
  - `search("chanel coco", P)` ne contient que des Chanel ;
  - `search("  -- ", P)` → `[]` ;
  - `search("zzzz", P)` → `[]`.

  `P` est une petite liste fixe construite dans le test, passée par `buildIndex`.
- [ ] **Étape 2 :** `npx vitest run tests/unit/search.test.js` → ÉCHEC (module introuvable).
- [ ] **Étape 3 :** implémenter en portant les fonctions de `maquette/app.js`.
- [ ] **Étape 4 :** les tests passent.
- [ ] **Étape 5 :** commit `feat: moteur de recherche tolérant (accents, fautes, notes)`.

### Tâche 3 : données (`js/data.js`, `js/format.js`, `data/parfums.json`, `scripts/update-fallback.mjs`)

**Fichiers :**
- Créer : `js/data.js`, `js/format.js`, `scripts/update-fallback.mjs`, `data/parfums.json`, `tests/unit/data.test.js`, `tests/unit/format.test.js`

**Interfaces :**
- Consomme : `buildIndex` (tâche 2).
- Produit :
  - `FAMILLES: string[]` (ordre des contraintes globales).
  - `parseNotes(value: string | string[] | undefined): string[]` : découpe sur `,`, `trim`, retire les vides et les notes de plus de 40 caractères, garde 8 notes au maximum.
  - `notesKey(categorie, nom, marque): string` = `normalize(\`${categorie} ${nom} ${marque}\`)`.
  - `indexNotes(rows: unknown[]): Map<string, object>` : seulement les lignes qui ont une `famille`.
  - `sanitize(entries: unknown, notes: Map): Parfum[]` : non-tableau → `[]`. Les champs olfactifs de la ligne priment si `famille` est remplie, sinon on prend ceux de `notes`. Une famille hors `FAMILLES` devient `''`. Chaque `Parfum` = `{categorie, numero, nom, marque, famille, sousFamille, tete, coeur, fond, index}`.
  - `loadParfums({fetchJson}?): Promise<{parfums: Parfum[], backup: boolean}>`. Par défaut, `fetchJson(url)` fait un `fetch` avec `AbortController` à 6000 ms et lève une erreur si `!res.ok`. Ordre : lire `data/parfums.json` (sert de notes et de secours) ; essayer `/api/parfums`. Si le résultat assaini n'est pas vide → `backup: false`. Sinon → copie de secours assainie, `backup: true`. Si les deux échouent → lever une `Error`.
  - `format.js` : `prettyBrand(marque: string): string`. Mot ≤ 3 lettres gardé en majuscules ; particules `DE`, `DI`, `DU` hors première position en minuscules ; sinon première lettre majuscule et le reste en minuscules.
- `data/parfums.json` : tableau au format des lignes du Sheet. Clés `categorie, numero, nom, marque, famille, sous_famille, notes_tete, notes_coeur, notes_fond`, notes en chaînes séparées par des virgules. Généré une fois à partir de `maquette/parfums.json` et `maquette/notes.json`.
- `scripts/update-fallback.mjs` : `node scripts/update-fallback.mjs`. Récupère `https://opensheet.elk.sh/11QQ55WHs43F2B-M8TdxmKHM42U5h7QoWmHlSBAKt3MI/1`, complète les notes manquantes depuis le `data/parfums.json` existant (via `notesKey`), réécrit le fichier si au moins une ligne valide est obtenue, et sort avec un code 1 sans rien toucher sinon. Doit importer `js/data.js`, qui ne doit donc contenir aucun accès au DOM.

- [ ] **Étape 1 :** écrire les tests :
  - `parseNotes("Bergamote, Poivre ,,")` → `["Bergamote","Poivre"]` ;
  - `parseNotes(Array(12).fill("Rose")).length` → 8 ;
  - `sanitize({error:"x"}, new Map())` → `[]` ;
  - `sanitize([{categorie:" Femme ", numero:"1", nom:"N°5", marque:"CHANEL"}], new Map())[0].categorie` → `"femme"` ;
  - une ligne avec `nom` de 201 caractères est rejetée ;
  - `famille:"Inconnue"` donne `famille === ""` ;
  - les notes de la ligne priment sur `notes` ;
  - les notes de secours sont appliquées quand la ligne n'a pas de famille ;
  - avec `loadParfums` et un faux `fetchJson` : l'API renvoie `{error}` → `backup: true` avec les parfums de secours ; l'API lève une erreur → `backup: true` ; l'API est valide → `backup: false` ; tout lève une erreur → rejet ;
  - `prettyBrand("ACQUA DI PARMA")` → `"Acqua di Parma"` ; `prettyBrand("BDK PARFUMS")` → `"BDK Parfums"`.
- [ ] **Étape 2 :** lancer les tests → ÉCHEC.
- [ ] **Étape 3 :** implémenter `js/data.js` et `js/format.js`.
- [ ] **Étape 4 :** générer `data/parfums.json` (script ponctuel dans le dossier de travail, non commité).
- [ ] **Étape 5 :** écrire `scripts/update-fallback.mjs`, puis le lancer : il doit afficher « 188 parfums » (ou le nombre actuel) et le fichier doit garder ses notes.
- [ ] **Étape 6 :** `npm test` passe.
- [ ] **Étape 7 :** commit `feat: chargement des données avec proxy, secours et notes olfactives`.

### Tâche 4 : textes et inactivité (`js/i18n.js`, `js/idle.js`)

**Fichiers :** créer `js/i18n.js`, `js/idle.js` et `tests/unit/idle.test.js`.

**Interfaces :**
- Produit :
  - `TEXTS = { fr, en }` : textes repris tels quels de `maquette/app.js`, y compris `familles`, `foundElsewhere` et `notesTitle`.
  - `translate(lang: 'fr'|'en', key: string)` : renvoie la valeur (chaîne, fonction ou objet).
  - `createIdleTimer({ totalSeconds, warningSeconds, isActive: () => boolean, onWarn: (remaining: number) => void, onExpire: () => void }): { reset(): void, stop(): void }`. `reset()` annule tout. Si `isActive()` est faux, il ne programme rien. Sinon `onWarn(warningSeconds)` est appelé après `totalSeconds - warningSeconds` secondes, puis chaque seconde avec le temps restant, puis `onExpire()` à 0.

- [ ] **Étape 1 :** écrire les tests avec `vi.useFakeTimers()` :
  - avec 60/10 et `isActive` vrai, `onWarn` n'est pas appelé à 49 s, il est appelé avec 10 à 50 s et avec 9 à 51 s, et `onExpire` est appelé une fois à 60 s ;
  - un `reset()` à 55 s repousse l'expiration à 115 s ;
  - avec `isActive` faux, rien n'est appelé après 120 s.
- [ ] **Étape 2 :** lancer les tests → ÉCHEC.
- [ ] **Étape 3 :** implémenter.
- [ ] **Étape 4 :** les tests passent.
- [ ] **Étape 5 :** commit `feat: textes FR/EN et minuterie d'inactivité`.

### Tâche 5 : interface (`index.html`, `css/style.css`, `js/views.js`, `js/main.js`, polices, icônes)

**Fichiers :**
- Réécrire : `index.html`, `css/style.css`
- Créer : `js/views.js`, `js/main.js`, `assets/fonts/*.woff2`, `assets/icons/icon.svg`, `assets/icons/icon-192.png`, `assets/icons/icon-512.png`, `assets/icons/icon-maskable-512.png`, `tests/e2e/parcours.spec.js`, `tests/e2e/fixtures/parfums.json`

**Interfaces :**
- Consomme : tâches 2 à 4.
- Produit : `index.html` porté de `maquette/index.html`, avec `<script type="module" src="js/main.js">`, `<link rel="manifest">` (le fichier arrive à la tâche 6), une meta `theme-color`, et sans lien vers Google Fonts. Mêmes `id` et attributs `data-*` que la maquette : `#screen-home`, `#screen-list`, `#home-search`, `#list-search`, `#rail-tabs`, `#brand-rail`, `#results`, `#list-title`, `#list-count`, `#ticket`, `#ticket-num`, `#ticket-notes`, `#idle`, `#data-dot`, `[data-univers]`, `[data-lang-toggle]`, `[data-clear]`, `[data-home]`.
- `views.js` exporte `renderTexts(state, parfums)`, `renderList(state, parfums, actions)` et `openTicket(parfum, lang)`. Ce dernier ne fait rien si `#ticket` est déjà ouvert. `main.js` contient l'état, les actions et le démarrage. Les deux sont portés de `maquette/app.js`.
- Polices : `@fontsource-variable/figtree` et `@fontsource-variable/big-shoulders-display` (dev). Copier les fichiers `*-latin-wght-normal.woff2` et `*-latin-ext-wght-normal.woff2` dans `assets/fonts/`. `@font-face` dans `style.css` avec `font-display: swap` et les mêmes `unicode-range` que fontsource ; latin-ext est nécessaire pour « Œ » et « œ ».
- Icônes : talon de ticket rouge `#D7262E` sur fond `#2A0D14`, texte « n° » ivoire `#F5EAD7`. `icon.svg` est la source ; les PNG sont générés avec Pillow (script ponctuel). La version maskable garde une marge de sécurité de 20 %.

- [ ] **Étape 1 :** écrire `tests/e2e/parcours.spec.js`. Chaque test intercepte `**/api/parfums` avec `page.route` vers la fixture : 12 parfums réels de `maquette/notes.json`, dont SAUVAGE (homme, 342), J'ADORE (femme), un nom long, et des parfums de 3 familles. Tests :
  - accueil → toucher « Elle » → filtre marque « Christian Dior » → ouvrir J'ADORE → le ticket montre le numéro et « Notes du parfum original » ;
  - dans Elle, taper « Sauvage » → le texte de `#list-count` contient « toute la collection » et la ligne 342 est visible ;
  - taper « sauvge » depuis l'accueil → la ligne 342 est visible ;
  - onglet « Par famille » → pastille « Agrumes » → seuls des parfums hespéridés ;
  - bouton EN → titre « Which fragrance do you love? » ;
  - `?idle=3` → après 4 s, retour à l'accueil et langue FR ;
  - double clic rapide sur une ligne → un seul dialog ouvert, aucune erreur de page (`page.on('pageerror')`) ;
  - recherche `"  -- "` → pas d'écran « Aucun parfum » ;
  - en mobile, avec le ticket du nom long ouvert, `document.documentElement.scrollWidth <= innerWidth` ;
  - aucune violation CSP ni erreur console. La CSP de la spec §7.5 est injectée via une meta dans un test dédié, ou les en-têtes sont ajoutés par `page.route` sur le document.
- [ ] **Étape 2 :** `npm run test:e2e` → ÉCHEC.
- [ ] **Étape 3 :** porter le HTML, le CSS et le JS de la maquette dans les modules, puis ajouter les polices et les icônes.
- [ ] **Étape 4 :** `npm run test:e2e` passe sur les 3 projets.
- [ ] **Étape 5 :** vérification visuelle par captures d'écran (Playwright) en tablette paysage, portrait et mobile ; le rendu doit correspondre à la maquette.
- [ ] **Étape 6 :** commit `feat: nouvelle interface borne (accueil, collections, familles, ticket)`.

### Tâche 6 : application installable et hors-ligne (`manifest.webmanifest`, `sw.js`)

**Fichiers :** créer `manifest.webmanifest`, `sw.js` et `tests/e2e/hors-ligne.spec.js` ; modifier `js/main.js`.

**Interfaces :**
- Produit :
  - `sw.js` déclare `const CACHE = 'dupes-__VERSION__';`. `deploy.sh` (tâche 7) remplace `__VERSION__` par le hash Git court plus un horodatage. Le service worker précache `./`, `index.html`, `manifest.webmanifest`, tous les CSS, JS, polices et icônes, `assets/affiche.jpg` et `data/parfums.json`. Il supprime les anciens caches `dupes-*` à l'activation. `/api/parfums` passe par le réseau d'abord avec repli sur le cache ; le reste est servi depuis le cache, avec repli sur le réseau ; seules les requêtes GET de même origine sont traitées.
  - Le manifest déclare `name` « Jeux de Dupes : trouvez votre parfum », `short_name` « Dupes », `display` `fullscreen`, `orientation` `any`, `background_color` et `theme_color` `#2A0D14`, `start_url` et `scope` `./`, et les icônes de la tâche 5 (`purpose` `any`, ou `maskable` pour la variante).
  - `main.js` enregistre le service worker si `'serviceWorker' in navigator`, sans bloquer l'affichage.

- [ ] **Étape 1 :** écrire les tests :
  - après le premier chargement et l'attente de `navigator.serviceWorker.ready`, `context.setOffline(true)` puis rechargement → l'accueil s'affiche, on peut toucher « Lui » et la liste n'est pas vide ;
  - `sw.js` brut contient `dupes-__VERSION__` (le test vérifie que le marqueur est présent, pour que `deploy.sh` puisse le remplacer).
- [ ] **Étape 2 :** les tests échouent.
- [ ] **Étape 3 :** implémenter.
- [ ] **Étape 4 :** les tests passent, y compris ceux de la tâche 5.
- [ ] **Étape 5 :** commit `feat: application installable et fonctionnement hors-ligne`.

### Tâche 7 : configuration serveur et script de déploiement

**Fichiers :** créer `nginx/dupes.conf`, `nginx/security-headers.conf`, `scripts/deploy.sh` et `scripts/check-prod.sh`.

**Interfaces :**
- `dupes.conf`, sur le modèle de `/home/projects/revision-cfpph/nginx/cfpph.conf` (même bloc TLS, même `map` IPv6 /64 nommé `$dupes_client`) :
  - zones : `limit_req_zone $dupes_client zone=dupes_site:10m rate=10r/s;`, `zone=dupes_api:1m rate=30r/m` et `limit_conn_zone $dupes_client zone=dupes_conn:10m`.
  - `proxy_cache_path /var/cache/nginx/dupes levels=1:2 keys_zone=dupes_sheet:1m max_size=10m inactive=7d use_temp_path=off;`
  - Serveur 80 : dossier ACME `/var/www/certbot` et redirection 301 vers HTTPS.
  - Serveur 443 :
    - `root /home/projects/jeu-de-dupes` ; `limit_req zone=dupes_site burst=40 nodelay` ; `limit_conn dupes_conn 20` ; `limit_req_status 429` ; `client_max_body_size 1k`.
    - Deux `access_log` : `/var/log/nginx/dupes.access.log` et `/var/log/nginx/access.log`.
    - `if ($request_method !~ ^(GET|HEAD)$) { return 405; }`
    - Locations en liste blanche : `= /`, `= /index.html`, `= /manifest.webmanifest`, `= /sw.js` (`Cache-Control: no-cache`), `^~ /css/`, `^~ /js/`, `^~ /assets/`, `= /data/parfums.json`, `= /api/parfums`, `location / { return 404; }`.
    - `/api/parfums` : `proxy_pass https://opensheet.elk.sh/11QQ55WHs43F2B-M8TdxmKHM42U5h7QoWmHlSBAKt3MI/1;`, `proxy_ssl_server_name on`, `proxy_set_header Host opensheet.elk.sh`, `proxy_set_header Cookie ""`, `proxy_set_header Authorization ""`, `proxy_hide_header Set-Cookie`, `proxy_cache dupes_sheet`, `proxy_cache_valid 200 5m`, `proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504`, `proxy_cache_lock on`, `proxy_connect_timeout 5s`, `proxy_read_timeout 8s`, `limit_req zone=dupes_api burst=20 nodelay`, `default_type application/json`.
    - `include /home/projects/jeu-de-dupes/nginx/security-headers.conf;` dans **chaque** location qui ajoute un en-tête, ainsi qu'au niveau `server`.
- `security-headers.conf` : les en-têtes de la spec §7.5 tels quels, plus HSTS `max-age=63072000; includeSubDomains; preload`, tous avec `always`. `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()`.
- `deploy.sh [--first]`, en bash `set -euo pipefail` :
  1. vérifie que l'arbre Git est propre ;
  2. lance `node scripts/update-fallback.mjs` (un échec n'est pas bloquant, on garde le fichier actuel) ;
  3. construit un tar à partir de la **liste blanche** `index.html manifest.webmanifest sw.js css js assets data nginx`, dans un dossier temporaire où `__VERSION__` de `sw.js` est remplacé ;
  4. l'envoie par `ssh jppoizat.fr`, l'extrait dans `/home/projects/jeu-de-dupes.new`, applique `chown -R root:root`, `find -type d -exec chmod 755` et `find -type f -exec chmod 644` ;
  5. remplace `/home/projects/jeu-de-dupes` (l'ancien dossier part en `.old`, supprimé en fin de script) ;
  6. lance `nginx -t && systemctl reload nginx` ; en cas d'échec de `nginx -t`, restaure `.old` et sort avec le code 1.

  Avec `--first`, le script crée aussi `/var/cache/nginx/dupes`, installe une config temporaire HTTP seule pour le challenge ACME, lance `certbot certonly --webroot -w /var/www/certbot -d dupes.jppoizat.fr --non-interactive` (le compte certbot déjà enregistré sur le serveur est réutilisé), puis lie `dupes.conf`.
- `check-prod.sh` : à partir de `curl` sur `https://dupes.jppoizat.fr`, il affiche OK ou ÉCHEC pour chaque contrôle :
  - 200 sur `/`, `/js/main.js`, `/data/parfums.json`, `/api/parfums` (JSON non vide) ;
  - 404 sur `/nginx/dupes.conf`, `/.git/config`, `/README.md`, `/maquette/`, `/package.json`, `/scripts/deploy.sh` ;
  - 405 sur un POST vers `/` ;
  - en-têtes CSP, HSTS, `nosniff`, `DENY` et `Permissions-Policy` présents ;
  - `http://` renvoie un 301 ;
  - aucun en-tête `Server` avec numéro de version.

- [ ] **Étape 1 :** écrire les fichiers.
- [ ] **Étape 2 :** `bash -n scripts/deploy.sh scripts/check-prod.sh` sans erreur.
- [ ] **Étape 3 :** relecture de sécurité ciblée par un agent `security-reviewer` sur `nginx/` et `scripts/`. Corriger les points CRITICAL et HIGH.
- [ ] **Étape 4 :** commit `feat: configuration nginx sécurisée et script de déploiement`.

### Tâche 8 : mise en production

- [ ] **Étape 1 :** sur le serveur, `rm -rf /home/projects/jeu-de-dupes` (ancien clone ; suppression validée par le propriétaire).
- [ ] **Étape 2 :** `bash scripts/deploy.sh --first` → certificat obtenu, `nginx -t` OK, nginx rechargé.
- [ ] **Étape 3 :** `bash scripts/check-prod.sh` → tous les contrôles OK. Vérifier aussi que les autres sites répondent encore : `curl -sI https://cfpph.jppoizat.fr` et `curl -sI https://nextcloud.jppoizat.fr` doivent répondre 200, 301 ou 302.
- [ ] **Étape 4 :** test du parcours en ligne avec Playwright sur `https://dupes.jppoizat.fr` (variable `BASE_URL`, sans interception de route) : accueil, recherche, ticket, aucune erreur console.
- [ ] **Étape 5 :** si un contrôle échoue, revenir en arrière (suppression du lien dans `sites-enabled` puis rechargement), corriger, redéployer.

### Tâche 9 : documentation et clôture

**Fichiers :** réécrire `README.md` ; supprimer `maquette/`.

- [ ] **Étape 1 :** écrire le README :
  - présentation ;
  - lancement local (`npm run serve`) et tests ;
  - colonnes du Sheet (actuelles + notes olfactives, format des notes) ;
  - déploiement (`scripts/deploy.sh`, `check-prod.sh`, retour arrière) ;
  - mise en borne Android (installer depuis Chrome, épingler l'application) ;
  - mesures de sécurité ;
  - rappel sur la clé Google à révoquer.
- [ ] **Étape 2 :** supprimer `maquette/` après avoir conservé le CSV de relecture des notes dans `docs/notes-olfactives-a-relire.csv`.
- [ ] **Étape 3 :** `npm run test:coverage` (80 % ou plus sur les modules purs) et `npm run test:e2e` passent.
- [ ] **Étape 4 :** relecture finale de toute la branche par un agent `code-reviewer`. Corriger les points CRITICAL et HIGH.
- [ ] **Étape 5 :** commit `docs: README de la borne`. Fusion dans `master` et tag `v2.0.0` uniquement après accord du propriétaire.
