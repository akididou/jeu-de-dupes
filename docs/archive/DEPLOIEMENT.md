# 🚀 GUIDE DE DÉPLOIEMENT - JEU DE DUPES

Guide complet pour déployer l'application en production.

---

## 📋 PRÉ-REQUIS

- [ ] Tous les tests passés (voir [GUIDE-TESTS.md](GUIDE-TESTS.md))
- [ ] Score Lighthouse Accessibilité >= 90
- [ ] Navigation clavier validée
- [ ] Responsive testé sur mobile/tablette/desktop
- [ ] Code versionné sur Git
- [ ] README.md à jour

---

## 🎯 OPTIONS DE DÉPLOIEMENT

### Option 1: Vercel (Recommandé) ⭐

**Avantages:**
- Déploiement en 1 clic
- HTTPS automatique
- CDN global
- Preview deployments
- Headers de sécurité configurés

**Étapes:**

1. **Créer un compte** sur [vercel.com](https://vercel.com)

2. **Installer Vercel CLI** (optionnel)
```bash
npm install -g vercel
```

3. **Déployer depuis le dossier du projet**
```bash
cd E:\Webmastering\Apps\jeu-de-dupes
vercel
```

4. **Suivre les instructions** dans le terminal

5. **Configuration automatique:**
   - Le fichier `vercel.json` est déjà configuré
   - Headers de sécurité ajoutés
   - Cache optimisé pour assets

**Déploiement via GitHub:**

1. **Push** le code sur GitHub
```bash
git remote add origin https://github.com/votre-username/jeu-de-dupes.git
git push -u origin master
```

2. **Importer** sur Vercel:
   - Se connecter sur vercel.com
   - "New Project" → "Import Git Repository"
   - Sélectionner le repo
   - Déployer automatiquement

**URL de production:** `https://jeu-de-dupes.vercel.app`

---

### Option 2: Netlify

**Avantages:**
- Déploiement continu
- Formulaires (si ajoutés plus tard)
- Functions serverless
- Headers configurés

**Étapes:**

1. **Créer un compte** sur [netlify.com](https://netlify.com)

2. **Méthode A - Drag & Drop:**
   - Se connecter sur Netlify
   - "Add new site" → "Deploy manually"
   - Glisser-déposer le dossier du projet

3. **Méthode B - Git:**
   - Push sur GitHub
   - "New site from Git"
   - Sélectionner le repo
   - Configuration automatique via `netlify.toml`

**Configuration:**
- Le fichier `netlify.toml` est déjà configuré
- Headers de sécurité inclus
- Cache optimisé

**URL de production:** `https://jeu-de-dupes.netlify.app`

---

### Option 3: GitHub Pages

**Avantages:**
- Gratuit
- Intégration GitHub
- Simple

**Limitations:**
- Pas de headers personnalisés
- Pas de redirections serveur
- HTTPS obligatoire sur custom domain

**Étapes:**

1. **Push** sur GitHub
```bash
git remote add origin https://github.com/votre-username/jeu-de-dupes.git
git push -u origin master
```

2. **Activer GitHub Pages:**
   - Aller dans Settings → Pages
   - Source: Deploy from branch
   - Branch: master / (root)
   - Save

3. **Attendre** quelques minutes

**URL:** `https://votre-username.github.io/jeu-de-dupes`

**Note:** Vous devrez ajouter les headers de sécurité manuellement via un service worker ou un CDN.

---

### Option 4: Serveur personnel (VPS/Hébergement web)

**Pour Apache:**

1. **Créer** un fichier `.htaccess`:
```apache
# Headers de sécurité
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
</IfModule>

# Cache pour assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
</IfModule>

# Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css application/javascript
</IfModule>
```

2. **Uploader** les fichiers via FTP

**Pour Nginx:**

```nginx
server {
    listen 80;
    server_name jeu-de-dupes.example.com;
    root /var/www/jeu-de-dupes;
    index index.html;

    # Headers de sécurité
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Cache
    location ~* \.(css|js|jpg|jpeg|png|gif)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Compression
    gzip on;
    gzip_types text/plain text/css application/javascript image/svg+xml;
}
```

---

## 🔒 SÉCURITÉ EN PRODUCTION

### Headers HTTP à vérifier

Après le déploiement, tester avec https://securityheaders.com:

- ✅ **X-Content-Type-Options:** nosniff
- ✅ **X-Frame-Options:** DENY
- ✅ **X-XSS-Protection:** 1; mode=block
- ✅ **Referrer-Policy:** strict-origin-when-cross-origin
- ✅ **Content-Security-Policy:** (déjà dans le HTML via meta tag)
- ⚠️ **Strict-Transport-Security:** (HSTS - recommandé)

### HTTPS obligatoire

Tous les hébergeurs modernes (Vercel, Netlify, GitHub Pages) fournissent HTTPS automatiquement.

Si vous utilisez un serveur personnel:
- Utiliser [Let's Encrypt](https://letsencrypt.org/) (gratuit)
- Installer Certbot pour automatiser

---

## ✅ CHECKLIST POST-DÉPLOIEMENT

### Vérifications fonctionnelles

- [ ] Site accessible via HTTPS
- [ ] Image de l'affiche se charge
- [ ] Clic sur zones ouvre les modales
- [ ] Données des parfums s'affichent
- [ ] Navigation au clavier fonctionne
- [ ] Fermeture modales (×, Échap, clic dehors)

### Tests de performance

- [ ] **Lighthouse** sur l'URL de production:
  ```bash
  npx lighthouse https://votre-site.com --view
  ```
  - Performance >= 90
  - Accessibility >= 90
  - Best Practices >= 90
  - SEO >= 90

- [ ] **WebPageTest**: https://www.webpagetest.org
  - First Contentful Paint < 1.5s
  - Time to Interactive < 3s

### Tests de sécurité

- [ ] **Security Headers**: https://securityheaders.com
  - Score A ou A+

- [ ] **SSL Test**: https://www.ssllabs.com/ssltest/
  - Grade A ou A+

### Tests responsive

- [ ] Tester sur vrais appareils:
  - iPhone/Android
  - iPad
  - Desktop

### Tests accessibilité

- [ ] **WAVE**: https://wave.webaim.org
  - 0 erreurs

- [ ] **aXe DevTools** sur production
  - 0 violations critiques

---

## 📊 MONITORING

### Google Analytics (optionnel)

1. **Créer** une propriété GA4

2. **Ajouter** le script dans `index.html` (avant `</head>`):
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

3. **Mettre à jour** le CSP:
```html
content="default-src 'self';
         script-src 'self' https://www.googletagmanager.com;
         connect-src 'self' https://opensheet.elk.sh https://www.google-analytics.com;">
```

### Plausible Analytics (Alternative respectueuse de la vie privée)

Plus simple et respectueux du RGPD:
- https://plausible.io
- Pas de cookies, pas de consentement nécessaire
- Script léger (< 1kb)

---

## 🔄 DÉPLOIEMENT CONTINU (CI/CD)

### GitHub Actions (pour GitHub Pages/Vercel/Netlify)

**Créer** `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [ master ]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Run tests
      run: |
        echo "Tests passed"

    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v20
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## 🎯 DOMAINE PERSONNALISÉ

### Avec Vercel

1. **Acheter** un domaine (Namecheap, Google Domains, etc.)

2. **Sur Vercel:**
   - Project Settings → Domains
   - Ajouter votre domaine
   - Suivre les instructions DNS

3. **Configurer DNS:**
   - Type: A
   - Name: @
   - Value: 76.76.21.21

### Avec Netlify

1. **Sur Netlify:**
   - Site Settings → Domain management
   - Add custom domain

2. **Configurer DNS:**
   - Netlify DNS (recommandé)
   - Ou pointer vers les nameservers Netlify

---

## 🐛 DÉPANNAGE

### Site ne se charge pas

1. Vérifier les logs du déploiement
2. Vérifier la console navigateur (F12)
3. Vérifier que tous les fichiers sont présents

### Erreurs CSP

1. Vérifier la console pour les violations CSP
2. Ajuster le CSP dans `index.html` si nécessaire
3. Redéployer

### Données ne se chargent pas

1. Vérifier que l'API `opensheet.elk.sh` est accessible
2. Vérifier le CSP: `connect-src` doit inclure opensheet.elk.sh
3. Vérifier la console Network (F12)

---

## 📈 PROCHAINES AMÉLIORATIONS

### Court terme
- [ ] Ajouter Google Analytics ou Plausible
- [ ] Configurer un domaine personnalisé
- [ ] Mettre en place monitoring (Uptime Robot)

### Moyen terme
- [ ] Ajouter un service worker pour PWA
- [ ] Optimiser les images (WebP, lazy loading)
- [ ] Ajouter des tests E2E (Playwright)

### Long terme
- [ ] Backend Node.js pour cache serveur
- [ ] API REST pour les données
- [ ] Dashboard admin pour gérer les parfums

---

**Dernière mise à jour:** 12 août 2026

**Besoin d'aide?** Consultez la [documentation](../README.md)
