# Jeux de Dupes : borne de recherche de parfums

Borne en libre-service pour la boutique. Un client indique un parfum de marque qu'il connaît (ou parcourt les
collections Elle / Lui) et obtient le numéro de notre version « dupe » correspondante, avec les notes
olfactives du parfum original. Elle tourne sur une tablette Android, fonctionne aussi sur mobile, et reste
utilisable sans réseau.

- Site en ligne : <https://dupes.jppoizat.fr>
- Technique : HTML, CSS et modules JavaScript natifs, service worker. Aucune compilation, aucune dépendance
  livrée en production (`package.json` ne contient que des outils de développement).
- Spécification détaillée : `docs/superpowers/specs/2026-10-25-refonte-borne-dupes-design.md`.

## Utilisation en boutique

### Parcours client

1. **Accueil** : touchez « Elle » ou « Lui » (avec le nombre de parfums), ou tapez un parfum ou une marque.
2. **Collection** : parfums groupés par marque ou filtrés par famille olfactive. La recherche tolère les
   accents, la casse et une faute de frappe (mots de 4 lettres ou plus). Si rien n'est trouvé dans l'univers
   choisi, la borne cherche dans toute la collection et l'indique.
3. **Fiche (ticket)** : « Notre version n°X », notes de tête, de cœur et de fond de l'original, et un message
   invitant à montrer le ticket à un conseiller.
4. **Inactivité** : après 60 s sans contact, un compte à rebours de 10 s s'affiche, puis la borne revient à
   l'accueil, vide la recherche et repasse en français. Le bouton FR/EN change la langue de l'interface.

Un petit point discret en bas à droite de l'écran signale au personnel que la borne utilise la copie de
secours (réseau ou Sheet indisponible). Les parfums restent consultables, mais les dernières modifications du
Sheet ne sont pas visibles.

### Installer la borne sur une tablette Android

1. Ouvrir <https://dupes.jppoizat.fr> dans Chrome.
2. Menu de Chrome, puis « Installer l'application » (ou « Ajouter à l'écran d'accueil »).
3. Lancer la borne depuis l'icône ainsi créée : elle s'ouvre en plein écran, sans barre d'adresse.
4. Activer l'épinglage d'écran d'Android : Paramètres, Sécurité, « Épingler l'application » (le nom varie selon
   le fabricant), puis épingler la borne depuis l'écran des applications récentes. Les clients ne peuvent plus
   quitter l'application.
5. Garder l'écran allumé : option développeur « Rester activé » pendant la charge, ou un lanceur de borne.

La première visite met le site en cache : ensuite, la borne démarre même sans connexion. Le cache est
renouvelé à chaque déploiement.

Pour tester le retour automatique à l'accueil sans attendre, ajouter `?idle=N` à l'adresse (N en secondes,
par exemple `?idle=15`). C'est une aide de test, pas un réglage de production.

## Mise à jour du catalogue

Le catalogue vit dans un Google Sheet (identifiant `11QQ55WHs43F2B-M8TdxmKHM42U5h7QoWmHlSBAKt3MI`, premier
onglet). Modifier le Sheet suffit : la borne le relit en ligne, avec un délai d'environ 5 minutes (cache du
serveur).

| Colonne | Obligatoire | Contenu |
|---|---|---|
| `categorie` | oui | `femme` ou `homme` |
| `numero` | oui | numéro de notre version (10 caractères max) |
| `nom` | oui | nom du parfum original (200 max) |
| `marque` | oui | marque de l'original (100 max) |
| `famille` | non | une valeur parmi : Hespéridé, Aquatique, Aromatique, Floral, Chypré, Boisé, Ambré, Gourmand, Cuir, Musqué |
| `sous_famille` | non | texte libre, affiché sur la fiche |
| `notes_tete` | non | notes séparées par des virgules, ex. `Bergamote, Citron, Poivre` |
| `notes_coeur` | non | idem |
| `notes_fond` | non | idem |

Règles :

- Les titres de colonnes sont exactement ceux ci-dessus, en minuscules, sans accent.
- Une note fait 40 caractères au plus, et chaque étage (tête, cœur, fond) 8 notes au plus.
- Les lignes invalides (catégorie inconnue, champ obligatoire vide, texte trop long) sont ignorées.
- Les données olfactives vont ensemble : si `famille` est renseignée sur une ligne du Sheet, famille,
  sous-famille et notes de cette ligne viennent du Sheet (une cellule de notes vide reste vide). Si `famille`
  est vide, le parfum reprend tout le bloc de la copie de secours (correspondance sur catégorie, numéro, nom
  et marque, sans accents ni casse).
- Les 188 parfums sont livrés avec leurs notes dans `data/parfums.json`. Ces notes viennent d'une recherche
  web et **46 lignes sont marquées « à vérifier »** : voir `docs/notes-olfactives-a-relire.csv`
  (colonnes `confiance`, `source` et `remarque`). Une fois relues, recopier les notes corrigées dans le Sheet.

La copie de secours `data/parfums.json` est actualisée automatiquement à chaque déploiement
(`scripts/deploy.sh`) ; on peut aussi la régénérer à la main avec `node scripts/update-fallback.mjs`.

## Développement local et tests

Prérequis : Node.js récent (testé avec Node 24).

```bash
npm install            # outils de développement uniquement
npm run serve          # site sur http://localhost:4173
npm test               # tests unitaires (Vitest)
npm run test:coverage  # idem avec couverture, seuil de 80 % sur search.js, data.js, format.js, idle.js
npm run test:e2e       # parcours Playwright (tablette paysage, portrait, mobile)
```

Remarques :

- Le navigateur de Playwright s'installe une fois avec `npx playwright install chromium`.
- En local, `/api/parfums` n'existe pas (c'est un proxy nginx) : le site utilise alors `data/parfums.json`. Les
  tests de parcours s'appuient sur ce comportement.
- Les tests de parcours sont limités à 2 processus en parallèle, car `http-server` sature au-delà.
- Les contraintes à respecter : aucun script ni ressource tiers, pas de `style=""` ni de `<script>` inline,
  pas de `innerHTML` avec des données (affichage par `textContent`). La politique CSP du serveur les bloquerait.

## Déploiement et retour arrière

Le site est servi par nginx sur le serveur `jppoizat.fr`, dossier `/home/projects/jeu-de-dupes`. Le vhost
`nginx/dupes.conf` est lié dans `/etc/nginx/sites-enabled/`.

```bash
scripts/deploy.sh          # mise à jour
scripts/deploy.sh --first  # tout premier déploiement uniquement (config HTTP temporaire + certificat)
scripts/check-prod.sh      # contrôle du site en ligne (ou : scripts/check-prod.sh https://autre.exemple)
```

`deploy.sh` :

- refuse de partir si l'arbre Git a des modifications non validées (commit d'abord) ;
- met à jour `data/parfums.json` depuis le Sheet (sans bloquer si le Sheet est injoignable) ;
- n'envoie que les fichiers publics et `nginx/` (liste blanche : `index.html`, `manifest.webmanifest`,
  `sw.js`, `css/`, `js/`, `assets/`, `data/`, `nginx/`), par `tar` et `ssh` ;
- change la version du cache du service worker, teste la configuration avec `nginx -t`, puis recharge nginx ;
- en cas d'erreur ou d'interruption, remet automatiquement l'ancien dossier et l'ancienne configuration.

`check-prod.sh` vérifie les en-têtes de sécurité, les 404 sur les chemins interdits, le 405 sur un POST, la
redirection HTTPS et le TLS. Son code de sortie est le nombre de contrôles en échec (0 = tout est bon).

**Retour arrière manuel** :

- désactiver le site : sur le serveur,
  `rm /etc/nginx/sites-enabled/dupes.conf && nginx -t && systemctl reload nginx` ;
- ou revenir à une version précédente : `git checkout <commit>` puis `scripts/deploy.sh`.

Le certificat Let's Encrypt se renouvelle seul (timer certbot). Journaux : `/var/log/nginx/dupes.access.log`
et `/var/log/nginx/access.log` (ce dernier est surveillé par fail2ban).

## Sécurité

Site statique : pas de formulaire, pas de compte, aucune écriture côté serveur. Mesures en place :

- **Liste blanche nginx** : seuls `/`, `/index.html`, `/manifest.webmanifest`, `/sw.js`, `/css/`, `/js/`,
  `/assets/`, `/data/parfums.json` et `/api/parfums` répondent ; le reste renvoie 404, sans listage de dossiers.
- **Méthodes** GET et HEAD uniquement (405 sinon), corps de requête limité à 1 ko.
- **Limitation de débit** par IP (429 au-delà) : 10 requêtes/s avec une marge de 40, 20 connexions, et
  30 requêtes/minute sur `/api/parfums`.
- **TLS** 1.2 et 1.3, HTTP redirigé vers HTTPS, HSTS.
- **En-têtes** : CSP stricte (`default-src 'none'`, scripts, styles, polices, images et connexions limités à
  `'self'`), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy` et `Cross-Origin-Resource-Policy`.
- **Proxy `/api/parfums`** : l'adresse d'opensheet est figée dans la configuration, aucun paramètre du client
  n'est relayé.
- **fail2ban** bannit automatiquement les scanners à partir des journaux nginx.
- **Côté client** : aucun script tiers, polices hébergées avec le site, affichage des données par
  `textContent`, validation stricte du contenu du Sheet.

**À faire par le propriétaire : révoquer la clé Google.** Une clé d'API Google figure dans l'historique Git
public (commit « add api key »). Elle doit être révoquée dans la console Google Cloud (API et services,
Identifiants). Le code actuel n'utilise aucune clé, et il n'existe plus de fichier `.env`.

## Structure du projet

```
index.html                 coquille unique : 4 écrans et une boîte de dialogue
manifest.webmanifest       installation plein écran
sw.js                      service worker : site en cache, réseau d'abord pour /api/parfums
css/style.css              thème et composants
js/main.js                 point d'entrée : état, navigation, événements
js/data.js                 chargement, validation, fusion des notes
js/search.js               normalisation, distance de Levenshtein, classement
js/format.js               mise en forme des marques
js/i18n.js                 textes français et anglais
js/idle.js                 minuterie d'inactivité
js/views.js                rendu DOM (lignes, filtres, ticket)
assets/                    affiche, polices (woff2), icônes
data/parfums.json          copie de secours (188 parfums avec notes)
nginx/                     vhost et en-têtes de sécurité
scripts/                   deploy.sh, check-prod.sh, update-fallback.mjs
tests/unit/, tests/e2e/    tests Vitest et Playwright
docs/                      spécification, plan, notes à relire, anciens documents (docs/archive/)
```
