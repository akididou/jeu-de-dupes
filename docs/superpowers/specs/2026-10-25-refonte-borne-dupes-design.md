# Refonte « Jeux de Dupes » : borne tablette en boutique

Date : 25/10/2026. Statut : en attente de relecture.

## 1. Objectif

Une borne en libre-service, sur tablette en boutique, permet à un client de trouver le numéro de dupe qui
correspond à un parfum de marque qu'il connaît. Elle doit aussi fonctionner sur mobile.

Critères de réussite :
- Un client trouve un numéro en moins de 3 gestes, par la recherche ou en parcourant les collections.
- La borne ne reste jamais vide ou bloquée, même sans réseau.
- Elle revient seule à l'accueil pour le client suivant.

La maquette validée (`maquette/`) sert de référence visuelle.

## 2. Parcours (validé sur maquette)

| Écran | Contenu |
|---|---|
| Accueil | Affiche du film. Étiquettes « Elle » et « Lui » à toucher, avec le nombre de parfums. Titre « Quel parfum aimez-vous ? », barre de recherche, bouton FR/EN. En paysage, l'affiche est à gauche et le panneau à droite ; en portrait et sur mobile, le panneau passe au-dessus. |
| Collection | Retour à l'accueil, sélecteur Elle / Lui / Tous, recherche, onglets « Par marque » et « Par famille » avec leurs filtres, grille de parfums groupés par marque. Chaque ligne montre un talon rouge avec le numéro, puis « Évoque », le nom, la marque et la famille. |
| Recherche | Résultats pendant la frappe, sans accents ni casse, une faute tolérée sur les mots de 4 lettres ou plus. Recherche par numéro, nom, marque, famille et note. Si rien n'est trouvé dans l'univers choisi, la borne montre les résultats de toute la collection et le dit. |
| Fiche (ticket) | « Notre version n°X », nom, marque, univers, sous-famille. « Notes du parfum original » : tête, cœur, fond. Message « Montrez ce ticket à un conseiller ». |
| Inactivité | Après 60 s sans contact : compte à rebours de 10 s, puis retour à l'accueil, recherche vidée, langue repassée en français. |

Identité visuelle : « cinéma rétro » tirée de l'affiche (velours bordeaux, rouge, ivoire, laiton).
Polices : Big Shoulders Display et Figtree, **hébergées avec le site** (aucun appel à Google Fonts). Pastilles
de couleur par famille olfactive. Zones tactiles de 48 px minimum, focus visible, `prefers-reduced-motion`
respecté.

## 3. Données

- **Source principale :** le Google Sheet existant, lu via opensheet. Colonnes actuelles : `categorie`,
  `numero`, `nom`, `marque`. Colonnes ajoutées (facultatives) : `famille`, `sous_famille`, `notes_tete`,
  `notes_coeur`, `notes_fond` (notes séparées par des virgules).
- **Proxy serveur :** le navigateur appelle `/api/parfums`, et nginx relaie vers opensheet avec un cache de
  5 minutes. Si opensheet est en panne, nginx sert la dernière réponse en cache. Le navigateur ne parle donc
  qu'au domaine du site, ce qui permet `connect-src 'self'`.
- **Copie de secours :** `data/parfums.json`, livré avec le site. Il contient les 188 parfums et leurs notes
  issues de la recherche web (`maquette/notes-a-importer.csv`). Il sert si le réseau et les caches
  échouent. Pour chaque parfum, les notes du Sheet priment sur celles du fichier ; la correspondance se fait
  sur catégorie + nom + marque normalisés.
- **Validation :** catégorie `femme`/`homme`, champs obligatoires, longueurs max (nom 200, marque 100,
  numéro 10, note 40, 8 notes par étage), famille limitée à une liste de 10 valeurs. Tout l'affichage
  passe par `textContent` : aucun HTML venant des données n'est interprété.

## 4. Architecture (arborescence actuelle conservée : `index.html`, `css/`, `js/`, `assets/`)

```
index.html                 coquille unique, 4 écrans + dialog
manifest.webmanifest       installation plein écran (application web installable)
sw.js                      service worker : site en cache, réseau d'abord pour /api/parfums
css/style.css              thème + composants (polices déclarées localement)
js/main.js                 point d'entrée : état, navigation, événements
js/data.js                 chargement, validation, fusion des notes (fonctions pures + fetch)
js/search.js               normalisation, Levenshtein, score (fonctions pures)
js/i18n.js                 textes FR/EN
js/idle.js                 minuterie d'inactivité
js/views.js                rendu DOM (lignes, filtres, ticket)
assets/affiche.jpg, assets/fonts/*.woff2, assets/icons/*
data/parfums.json          copie de secours
nginx/dupes.conf           vhost du serveur
nginx/security-headers.conf
scripts/deploy.sh          déploiement (liste blanche de fichiers)
tests/unit/*.test.js       Vitest
tests/e2e/*.spec.js        Playwright
package.json               dépendances de développement uniquement (rien n'est livré en production)
```

Modules ES natifs, aucune compilation. Les fonctions pures de `search.js` et `data.js` n'ont pas de dépendance
au DOM, ce qui les rend testables unitairement.

**Fichiers supprimés :** `TEST-RAPIDE.html`, `start-server.bat`, `start-server.sh`, `netlify.toml`,
`vercel.json` (le site sera hébergé sur ton serveur), `.env.example` (aucun secret) et l'ancien
`js/data.js` (82 entrées obsolètes, remplacé). Le dossier `maquette/` est supprimé une fois la version finale
validée. Le README est réécrit ; les anciens fichiers de `docs/` sont déplacés dans `docs/archive/`.

## 5. Hors-ligne et mode borne

- Le service worker met en cache le site (HTML, CSS, JS, polices, affiche, icônes, `data/parfums.json`)
  dès l'installation. `/api/parfums` passe par le réseau d'abord, avec repli sur la dernière réponse en cache.
  La version du cache change à chaque déploiement.
- `manifest.webmanifest` : affichage `fullscreen`, orientation libre, couleurs du thème, icônes 192 et 512.
- Un point discret en bas à droite signale au personnel que la borne tourne sur une copie de secours.
- Le README explique la mise en borne sur Android : installer depuis Chrome, puis épingler l'application
  pour empêcher d'en sortir.

## 6. Déploiement : `https://dupes.jppoizat.fr`

Serveur `jppoizat.fr` (Debian 13, nginx). On suit les conventions déjà en place :
- **Emplacement :** `/home/projects/jeu-de-dupes/`. Le dossier contient aujourd'hui un ancien clone du
  11 août, que nginx ne sert pas. Il sera **sauvegardé** dans `/home/projects/jeu-de-dupes.bak-20261025`, puis
  remplacé.
- **Copie :** `scripts/deploy.sh` copie par `tar` + `ssh` **uniquement** les fichiers publics et le dossier
  `nginx/`. Ni `.git`, ni docs, ni tests, ni maquette ne partent. Les droits sont `root:root` 755/644 ; nginx
  ne peut que lire.
- **Config nginx :** `nginx/dupes.conf` est lié dans `/etc/nginx/sites-enabled/`. La config est testée par
  `nginx -t` avant chaque rechargement. Le serveur héberge d'autres sites : sans un test réussi, on ne
  recharge pas.
- **Certificat :** Let's Encrypt via `certbot certonly --webroot -w /var/www/certbot` (même méthode que les
  autres sous-domaines, renouvellement automatique déjà en place). Le DNS `dupes` pointe déjà sur le serveur.
- **Retour arrière :** supprimer le lien dans `sites-enabled`, recharger nginx, restaurer la sauvegarde.

## 7. Sécurité

Site statique sans formulaire, sans compte et sans écriture côté serveur : la surface d'attaque est faible.
On la réduit encore :

1. **Liste blanche nginx :** seuls `/`, `/index.html`, `/manifest.webmanifest`, `/sw.js`, `/css/`, `/js/`,
   `/assets/`, `/data/parfums.json` et `/api/parfums` répondent. Tout le reste renvoie 404 (fichiers cachés,
   `nginx/`, sauvegardes…). Pas de listage des dossiers.
2. **Méthodes :** GET et HEAD uniquement, les autres renvoient 405. Corps de requête limité à 1 ko.
3. **Limitation de débit :** 10 requêtes par seconde par IP (préfixe /64 en IPv6, comme pour cfpph), avec
   une marge de 40, et 20 connexions par IP. `/api/parfums` est limité à 30 requêtes par minute. Au-delà :
   429.
4. **TLS :** TLS 1.2 et 1.3 uniquement, chiffrements Mozilla « intermediate », HTTP renvoyé vers HTTPS, HSTS
   2 ans.
5. **En-têtes**, dans un snippet inclus dans chaque bloc `location`, car nginx n'hérite pas des `add_header`
   :
   - `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:;
     font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none';
     form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests`
   - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`
   - `Permissions-Policy` : caméra, micro, géolocalisation, paiement, USB et autres capteurs désactivés
   - `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`
   - `server_tokens off` (déjà actif sur le serveur)
6. **Proxy opensheet :** URL d'amont figée dans la config (aucun paramètre client relayé, pas de SSRF
   possible), délais courts, en-têtes client non transmis, réponse limitée au JSON.
7. **fail2ban :** le site écrit aussi dans `/var/log/nginx/access.log`, que surveillent déjà les règles
   `nginx-botsearch`, `nginx-bad-request` et `nginx-4xx`. Les scanners sont donc bannis automatiquement.
8. **Côté client :** aucun script tiers, aucun `innerHTML` avec des données, validation stricte des données.
9. **Secrets :** aucun. La clé Google présente dans l'historique Git public doit être révoquée par le
   propriétaire (action manuelle dans la console Google Cloud).

Contrôle après mise en ligne : en-têtes vérifiés avec `curl -I`, 404 sur `/nginx/dupes.conf`, `/.git/`,
`/README.md` et `/maquette/`, 405 sur un POST, TLS vérifié, parcours testé sur le site en ligne.

## 8. Tests

- **Unitaires (Vitest) :** normalisation, Levenshtein, score et classement (exact, préfixe, contenu, note,
  faute), validation et nettoyage des données, lecture des notes, fusion Sheet + copie de secours, mise en
  forme des marques. Objectif : 80 % de couverture ou plus sur `search.js` et `data.js`.
- **Parcours (Playwright), tablette paysage, portrait et mobile :**
  - accueil → Elle → filtre par marque → ticket ;
  - recherche avec faute de frappe ;
  - recherche hors univers avec repli ;
  - filtre par famille ;
  - bascule FR/EN ;
  - retour automatique à l'accueil (`?idle=` court) ;
  - fonctionnement hors-ligne après la première visite ;
  - aucune erreur console ni violation CSP.

## 9. Hors périmètre

Back-office d'édition (le Sheet suffit), statistiques de consultation, photos des flacons, autres langues que
FR/EN.
