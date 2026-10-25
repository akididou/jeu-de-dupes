# 🧪 GUIDE DE TESTS - JEU DE DUPES

Guide complet pour tester l'application avant mise en production.

**Date:** 12 août 2026
**Version testée:** 0.2.0

---

## 📋 CHECKLIST RAPIDE

- [ ] Lancement de l'application
- [ ] Navigation au clavier
- [ ] Lecteur d'écran
- [ ] Tests responsive
- [ ] Lighthouse audit
- [ ] Tests de sécurité

---

## 🚀 1. LANCEMENT DE L'APPLICATION

### Option A: Serveur Python (Recommandé)
```bash
cd E:\Webmastering\Apps\jeu-de-dupes
python -m http.server 8000
```

Ouvrir: http://localhost:8000

### Option B: Serveur Node.js
```bash
npx serve
```

### Option C: Serveur PHP
```bash
php -S localhost:8000
```

### Option D: Extension VS Code
- Installer "Live Server"
- Clic droit sur index.html → "Open with Live Server"

---

## ⌨️ 2. TESTS DE NAVIGATION AU CLAVIER

### Test 1: Skip-to-content link
1. **Rafraîchir** la page
2. **Appuyer sur Tab** (une seule fois)
3. ✅ **Vérifier:** Un lien "Aller au contenu principal" apparaît en haut à gauche
4. **Appuyer sur Enter**
5. ✅ **Vérifier:** Le focus saute directement au contenu principal

### Test 2: Navigation vers les zones cliquables
1. **Appuyer sur Tab** plusieurs fois
2. ✅ **Vérifier:** Le focus visible (outline bleu 3px) apparaît sur:
   - Le bouton "Parfums masculins" (côté droit de l'affiche)
   - Le bouton "Parfums féminins" (côté gauche de l'affiche)

### Test 3: Ouverture de la modale au clavier
1. **Naviguer** jusqu'au bouton "Parfums masculins"
2. **Appuyer sur Enter** ou **Espace**
3. ✅ **Vérifier:** La modale s'ouvre
4. ✅ **Vérifier:** Le focus est automatiquement placé sur le bouton "×" (fermer)

### Test 4: Focus trap dans la modale
1. **Modale ouverte**, appuyer sur **Tab** plusieurs fois
2. ✅ **Vérifier:** Le focus reste dans la modale (ne sort pas)
3. **Appuyer sur Tab** jusqu'au dernier élément
4. **Appuyer encore sur Tab**
5. ✅ **Vérifier:** Le focus revient au premier élément (bouton fermer)

### Test 5: Navigation inverse (Shift+Tab)
1. **Modale ouverte**, focus sur le bouton "×"
2. **Appuyer sur Shift+Tab**
3. ✅ **Vérifier:** Le focus va au dernier élément de la modale
4. **Continuer Shift+Tab**
5. ✅ **Vérifier:** Le focus reste piégé dans la modale

### Test 6: Fermeture de la modale au clavier
1. **Méthode 1:** Appuyer sur **Échap**
   - ✅ **Vérifier:** La modale se ferme
   - ✅ **Vérifier:** Le focus revient au bouton qui a ouvert la modale

2. **Méthode 2:** Naviguer jusqu'au bouton "×" et appuyer sur **Enter**
   - ✅ **Vérifier:** La modale se ferme
   - ✅ **Vérifier:** Le focus revient au bouton qui a ouvert la modale

### Test 7: Fermeture en cliquant en dehors
1. **Ouvrir** une modale
2. **Cliquer** sur le fond noir (en dehors de la modale)
3. ✅ **Vérifier:** La modale se ferme

---

## 🎤 3. TESTS AVEC LECTEUR D'ÉCRAN

### Configuration Windows - NVDA (Gratuit)

**Installation:**
1. Télécharger NVDA: https://www.nvaccess.org/download/
2. Installer et lancer NVDA
3. Naviguer vers http://localhost:8000

**Raccourcis NVDA:**
- **Ctrl** - Arrêter la lecture
- **Insert + Flèche bas** - Lire tout
- **H** - Aller au titre suivant
- **B** - Aller au bouton suivant
- **L** - Aller à la liste suivante

### Test 1: Annonce du titre de la page
1. **Ouvrir** la page
2. ✅ **Écouter:** "Parfums des Personnages - Jeux de Dupes"

### Test 2: Skip link
1. **Appuyer sur Tab**
2. ✅ **Écouter:** "Aller au contenu principal, lien"

### Test 3: Zones cliquables
1. **Naviguer** avec Tab ou B (boutons)
2. ✅ **Écouter:** "Découvrir les parfums masculins du personnage homme, bouton"
3. ✅ **Écouter:** "Découvrir les parfums féminins du personnage femme, bouton"

### Test 4: Ouverture modale
1. **Appuyer sur Enter** sur un bouton
2. ✅ **Écouter:** "Collection de Parfums Masculins, dialogue" (ou Féminins)
3. ✅ **Écouter:** "Fermer la fenêtre des parfums masculins, bouton"

### Test 5: Liste des parfums
1. **Modale ouverte**, appuyer sur **L** (liste)
2. ✅ **Écouter:** "Liste avec X éléments"
3. **Naviguer** dans la liste
4. ✅ **Écouter:** Pour chaque parfum:
   - "Numéro XXX"
   - "Évoque [Nom du parfum]"
   - "[Marque]"

### Test 6: Annonces dynamiques
1. **Ouvrir** une modale
2. ✅ **Écouter:** Une annonce comme "42 parfums masculins affichés, triés par marque"

### Test 7: Fermeture modale
1. **Appuyer sur Échap**
2. ✅ **Vérifier:** Pas d'annonce d'erreur
3. ✅ **Vérifier:** Le focus revient correctement

---

## 📱 4. TESTS RESPONSIVE

### Test 1: Chrome DevTools - Device Toolbar

1. **Ouvrir** Chrome DevTools (F12)
2. **Activer** Device Toolbar (Ctrl+Shift+M)
3. **Tester** les dimensions suivantes:

#### 320x568 (iPhone SE)
- ✅ Modal prend 95% de la largeur
- ✅ Texte lisible (pas trop petit)
- ✅ Bouton "×" est cliquable (44x44px)
- ✅ Pas de scroll horizontal
- ✅ Instructions visibles

#### 375x667 (iPhone 8)
- ✅ Layout correct
- ✅ Modal responsive
- ✅ Touch targets >= 44px

#### 414x896 (iPhone 11 Pro Max)
- ✅ Utilisation optimale de l'espace
- ✅ Modal centrée

#### 768x1024 (iPad)
- ✅ Modal max-width: 500px
- ✅ Centrage correct
- ✅ Espacement approprié

#### 1920x1080 (Desktop)
- ✅ Container limité à 1200px
- ✅ Modal centrée
- ✅ Pas d'étirement excessif

### Test 2: Orientation paysage

1. **Appareil:** iPhone (simulé)
2. **Rotation** en mode paysage
3. ✅ **Vérifier:** Modal ajustée (max-height: 95vh)
4. ✅ **Vérifier:** Titre plus petit
5. ✅ **Vérifier:** Padding réduit
6. ✅ **Vérifier:** Scroll fonctionnel si nécessaire

### Test 3: Zoom 200%

1. **Navigateur:** Chrome ou Firefox
2. **Appuyer sur Ctrl + Plus** 5-6 fois (zoom 200%)
3. ✅ **Vérifier:** Texte lisible
4. ✅ **Vérifier:** Pas de débordement horizontal
5. ✅ **Vérifier:** Modal utilisable
6. ✅ **Vérifier:** Boutons cliquables

### Test 4: Appareils réels (si disponibles)

**iPhone/Android:**
- ✅ Touch sur les zones cliquables fonctionne
- ✅ Modal responsive
- ✅ Défilement fluide
- ✅ Pas de bugs d'affichage

---

## 🔍 5. LIGHTHOUSE AUDIT

### Lancer Lighthouse

1. **Ouvrir** Chrome DevTools (F12)
2. **Aller** dans l'onglet "Lighthouse"
3. **Sélectionner:**
   - ✅ Performance
   - ✅ Accessibility
   - ✅ Best Practices
   - ✅ SEO
4. **Device:** Desktop et Mobile
5. **Cliquer** sur "Analyze page load"

### Scores attendus

| Catégorie | Score minimum | Score visé |
|-----------|---------------|------------|
| Performance | 70 | 90+ |
| **Accessibility** | **85** | **90+** |
| Best Practices | 80 | 90+ |
| SEO | 80 | 90+ |

### Vérifications spécifiques Accessibilité

- ✅ **0 erreurs** dans "Accessibility" (panneau de gauche)
- ✅ **Passed audits:**
  - [aria-*] attributes are valid
  - [role] attributes are valid
  - Button elements have accessible names
  - Elements with [aria-label] have accessible names
  - Form elements have associated labels (N/A car pas de form)
  - Touch targets have sufficient size
  - Heading elements are in sequentially-descending order
  - Image elements have [alt] attributes

---

## 🔒 6. TESTS DE SÉCURITÉ

### Test 1: Content Security Policy

1. **Ouvrir** DevTools Console (F12)
2. **Rafraîchir** la page
3. ✅ **Vérifier:** Aucune erreur CSP dans la console

### Test 2: XSS - Injection dans les données

**Note:** Test en environnement de dev uniquement

1. **Modifier** temporairement `js/main.js` pour injecter du HTML:
```javascript
// Test XSS
parfumsData.homme.push({
    numero: '<script>alert("XSS")</script>',
    nom: '<img src=x onerror="alert(\'XSS\')">',
    marque: 'Test'
});
```

2. **Ouvrir** la modale
3. ✅ **Vérifier:** Aucune alerte JavaScript ne s'affiche
4. ✅ **Vérifier:** Le HTML est affiché comme texte brut
5. **Restaurer** le code original

### Test 3: Clés API exposées

1. **Ouvrir** DevTools → Network
2. **Rafraîchir** la page
3. **Cliquer** sur la requête vers opensheet.elk.sh
4. ✅ **Vérifier:** Aucune clé API dans l'URL
5. ✅ **Vérifier:** Pas de headers Authorization

### Test 4: Validation des données

1. **Observer** la console pendant le chargement
2. ✅ **Vérifier:** Aucune erreur de validation
3. ✅ **Vérifier:** Les données sont bien filtrées

---

## 🎨 7. TESTS D'ANIMATION

### Test 1: prefers-reduced-motion

1. **Windows:**
   - Paramètres → Accessibilité → Affichage
   - Activer "Afficher les animations dans Windows"

2. **Chrome DevTools:**
   - F12 → Menu ⋮ → More tools → Rendering
   - "Emulate CSS media feature prefers-reduced-motion" → reduced

3. **Rafraîchir** la page
4. ✅ **Vérifier:** Pas d'animations/transitions visibles
5. ✅ **Vérifier:** Ouverture modale instantanée

---

## 🐛 8. TESTS DE RÉGRESSION

### Test 1: Chargement initial
- ✅ Image de l'affiche se charge
- ✅ Instructions visibles
- ✅ Zones cliquables réactives

### Test 2: Chargement des données
- ✅ Modale affiche "X parfums masculins/féminins"
- ✅ Parfums triés par marque
- ✅ Format correct: "Numéro | Évoque Nom | Marque"

### Test 3: Interactions
- ✅ Clic sur zone ouvre modale
- ✅ Clic sur × ferme modale
- ✅ Clic hors modale ferme modale
- ✅ Échap ferme modale

### Test 4: Messages d'erreur
1. **Simuler** une erreur réseau (DevTools → Network → Offline)
2. **Rafraîchir** la page
3. ✅ **Vérifier:** Message d'erreur accessible s'affiche
4. ✅ **Vérifier:** Message disparaît après 5 secondes

---

## 📊 9. RAPPORT DE TESTS

### Template de rapport

```markdown
## Rapport de tests - [Date]

**Testeur:** [Nom]
**Version:** 0.2.0
**Navigateur:** [Chrome/Firefox/Safari] [Version]

### Navigation clavier
- [ ] Skip-to-content: ✅ / ❌
- [ ] Focus visible: ✅ / ❌
- [ ] Focus trap: ✅ / ❌
- [ ] Fermeture Échap: ✅ / ❌

### Lecteur d'écran (NVDA/JAWS)
- [ ] Annonces correctes: ✅ / ❌
- [ ] Navigation fluide: ✅ / ❌
- [ ] Labels descriptifs: ✅ / ❌

### Responsive
- [ ] Mobile 320px: ✅ / ❌
- [ ] Tablette 768px: ✅ / ❌
- [ ] Desktop 1920px: ✅ / ❌
- [ ] Zoom 200%: ✅ / ❌

### Lighthouse
- Performance: ___/100
- Accessibility: ___/100
- Best Practices: ___/100
- SEO: ___/100

### Sécurité
- [ ] Aucune erreur CSP: ✅ / ❌
- [ ] XSS bloqué: ✅ / ❌

### Bugs trouvés
- [Liste des bugs]

### Commentaires
- [Observations]
```

---

## ✅ 10. CRITÈRES D'ACCEPTATION

### Must-have (Bloquant)
- ✅ Navigation clavier complète fonctionne
- ✅ Lecteur d'écran annonce correctement
- ✅ Lighthouse Accessibility >= 85
- ✅ Responsive sur mobile/tablette/desktop
- ✅ Aucune erreur console critique

### Should-have (Important)
- ✅ Focus trap dans modales
- ✅ Zoom 200% fonctionnel
- ✅ prefers-reduced-motion respecté
- ✅ Touch targets >= 44px

### Nice-to-have (Bonus)
- ✅ Lighthouse tous >= 90
- ✅ Aucun warning console
- ✅ Performance optimale

---

## 🚀 MISE EN PRODUCTION

Une fois tous les tests validés:

1. **Créer** une branche release
```bash
git checkout -b release/v0.2.0
```

2. **Mettre à jour** la version dans les docs

3. **Créer** un tag
```bash
git tag -a v0.2.0 -m "Version 0.2.0 - Production ready"
```

4. **Merger** dans main/master
```bash
git checkout master
git merge release/v0.2.0
```

5. **Push** vers origin
```bash
git push origin master --tags
```

6. **Déployer** (Netlify/Vercel/autre)

---

**Dernière mise à jour:** 12 août 2026
