// Historique de navigation : retour arrière, Fermer, Échap, lien direct, inactivité.
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const FIXTURE = readFileSync(new URL('./fixtures/parfums.json', import.meta.url), 'utf8');
const SAUVAGE_HASH = '#/dupe/homme/342-sauvage';

/** Erreurs relevées pendant le test, vérifiées à la fin de chaque test. */
let problems = [];

test.beforeEach(async ({ page }) => {
  problems = [];
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
  });
  await page.route('**/api/parfums', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: FIXTURE }));
});

test.afterEach(() => {
  expect(problems).toEqual([]);
});

/** Ligne de parfum dont le talon porte ce numéro. */
function row(page, numero) {
  return page.locator('#results .parfum', {
    has: page.locator('.parfum-stub b', { hasText: new RegExp(`^${numero}$`) }),
  });
}

async function openHome(page, query = '') {
  await page.goto(`/${query}`);
  await expect(page.locator('#screen-home [data-count="femme"]')).toHaveText('7 parfums');
}

const hashOf = (page) => new URL(page.url()).hash;
const historyLength = (page) => page.evaluate(() => history.length);
const historyState = (page) => page.evaluate(() => history.state);

async function expectHome(page) {
  await expect(page.locator('#screen-home')).toBeVisible();
  await expect(page.locator('#screen-list')).toBeHidden();
  await expect(page.locator('#ticket')).toBeHidden();
  expect(hashOf(page)).toBe('');
}

async function expectList(page) {
  await expect(page.locator('#ticket')).toBeHidden();
  await expect(page.locator('#screen-list')).toBeVisible();
  await expect(page.locator('#screen-home')).toBeHidden();
  expect(hashOf(page)).toBe('#/collection');
}

async function openSauvageFromLui(page) {
  await page.locator('#screen-home [data-univers="homme"]').click();
  await expect(page.locator('#screen-list')).toBeVisible();
  await row(page, '342').click();
  await expect(page.locator('#ticket-num')).toHaveText('342');
}

test('accueil → Lui → filtre → SAUVAGE : adresse lisible, retour à la liste filtrée puis à l\'accueil', async ({ page }) => {
  await openHome(page);
  await page.locator('#screen-home [data-univers="homme"]').click();
  expect(hashOf(page)).toBe('#/collection');
  await page.locator('#brand-rail .chip', { hasText: 'Christian Dior' }).click();
  await expect(page.locator('#list-title')).toHaveText('Christian Dior');
  await expect(page.locator('#results .parfum')).toHaveCount(4);

  await row(page, '342').click();
  await expect(page.locator('#ticket')).toBeVisible();
  expect(hashOf(page)).toBe(SAUVAGE_HASH);
  expect(await historyState(page)).toEqual({ screen: 'dupe', depth: 2 });

  await page.goBack();
  await expectList(page);
  await expect(page.locator('#list-title')).toHaveText('Christian Dior');
  await expect(page.locator('#brand-rail .chip', { hasText: 'Christian Dior' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.segmented [data-univers="homme"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#results .parfum')).toHaveCount(4);

  await page.goBack();
  await expectHome(page);
  expect(new URL(page.url()).pathname).toBe('/');
});

test('dans la liste, recherche, univers et filtres n\'ajoutent aucune entrée : un retour mène à l\'accueil', async ({ page }) => {
  await openHome(page);
  const atHome = await historyLength(page);
  await page.locator('#screen-home [data-univers="femme"]').click();
  await page.locator('#list-search').pressSequentially('dior');
  await expect(row(page, '46')).toBeVisible();
  await page.locator('#list-search').fill('');
  await page.locator('.segmented [data-univers="homme"]').click();
  await page.locator('.segmented [data-univers="femme"]').click();
  await page.locator('.segmented [data-univers="tous"]').click();
  await page.locator('#brand-rail .chip', { hasText: 'Christian Dior' }).click();
  await expect(page.locator('#list-title')).toHaveText('Christian Dior');
  expect(await historyLength(page)).toBe(atHome + 1);
  expect(hashOf(page)).toBe('#/collection');

  await page.goBack();
  await expectHome(page);
});

test('une recherche tapée depuis l\'accueil ajoute une seule entrée', async ({ page }) => {
  await openHome(page);
  const atHome = await historyLength(page);
  await page.locator('#home-search').pressSequentially('sauv');
  await expect(page.locator('#screen-list')).toBeVisible();
  await page.locator('#list-search').pressSequentially('age');
  await expect(row(page, '342')).toBeVisible();
  expect(await historyLength(page)).toBe(atHome + 1);

  await page.goBack();
  await expectHome(page);
  await expect(page.locator('#home-search')).toHaveValue('');
});

test('« Fermer » revient à la liste sans accumuler d\'historique, puis retour → accueil', async ({ page }) => {
  await openHome(page);
  await page.locator('#screen-home [data-univers="homme"]').click();
  const lengths = [];
  for (let i = 0; i < 3; i++) {
    await row(page, '342').click();
    await expect(page.locator('#ticket')).toBeVisible();
    expect(hashOf(page)).toBe(SAUVAGE_HASH);
    await page.locator('[data-close-ticket]').click();
    await expectList(page);
    lengths.push(await historyLength(page));
  }
  expect(new Set(lengths).size).toBe(1);

  await page.goBack();
  await expectHome(page);
});

test('« Fermer » puis appui immédiat sur une autre ligne : le nouveau ticket reste ouvert', async ({ page }) => {
  await openHome(page);
  await openSauvageFromLui(page);
  // La ligne est touchée juste après le popstate, avant l'évènement `close` du ticket précédent.
  await page.evaluate(async () => {
    const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    document.querySelector('[data-close-ticket]').click();
    await popped;
    const next = [...document.querySelectorAll('#results .parfum')]
      .find((b) => b.querySelector('.parfum-stub b').textContent === '264');
    next.click();
  });
  await page.waitForTimeout(300);
  await expect(page.locator('#ticket')).toBeVisible();
  await expect(page.locator('#ticket-num')).toHaveText('264');
  expect(hashOf(page)).toBe('#/dupe/homme/264-eau-sauvage');
  expect(await historyState(page)).toEqual({ screen: 'dupe', depth: 2 });
});

test('toucher à côté du ticket revient à la liste', async ({ page }) => {
  await openHome(page);
  await openSauvageFromLui(page);
  // Laisse passer la protection contre le double appui.
  await page.waitForTimeout(600);
  await page.mouse.click(5, 5);
  await expectList(page);
  expect(await historyState(page)).toEqual({ screen: 'list', depth: 1 });
});

test('le bouton « Accueil » de la liste dépile l\'entrée (pas d\'accumulation)', async ({ page }) => {
  await openHome(page);
  const lengths = [];
  for (let i = 0; i < 3; i++) {
    await page.locator('#screen-home [data-univers="femme"]').click();
    await expect(page.locator('#screen-list')).toBeVisible();
    await page.locator('[data-home]').click();
    await expectHome(page);
    expect(await historyState(page)).toEqual({ screen: 'home', depth: 0 });
    lengths.push(await historyLength(page));
  }
  expect(new Set(lengths).size).toBe(1);
});

test('Échap sur le ticket ouvert revient à la liste, pas à l\'accueil', async ({ page }) => {
  await openHome(page);
  await openSauvageFromLui(page);
  await page.keyboard.press('Escape');
  await expectList(page);
  await expect(page.locator('#list-title')).toHaveText('Parfums homme');
});

test('lien direct vers un dupe : ticket sur l\'accueil, retour → accueil', async ({ page }) => {
  await page.goto(`/${SAUVAGE_HASH}`);
  await expect(page.locator('#ticket')).toBeVisible();
  await expect(page.locator('#ticket-num')).toHaveText('342');
  await expect(page.locator('#screen-home')).toBeVisible();
  expect(hashOf(page)).toBe(SAUVAGE_HASH);
  expect(await historyState(page)).toEqual({ screen: 'dupe', depth: 1 });

  await page.goBack();
  await expectHome(page);
  expect(await historyState(page)).toEqual({ screen: 'home', depth: 0 });
});

test('lien direct puis « Fermer » : accueil propre', async ({ page }) => {
  await page.goto(`/?idle=30${SAUVAGE_HASH}`);
  await expect(page.locator('#ticket-num')).toHaveText('342');
  await page.locator('[data-close-ticket]').click();
  await expectHome(page);
  expect(new URL(page.url()).search).toBe('?idle=30');
});

test('hash invalide ou #/collection au chargement : accueil propre, sans erreur', async ({ page }) => {
  const hashes = ['#/dupe/x/999-nope', '#/dupe/homme/999-nope', '#/collection'];
  for (const [i, hash] of hashes.entries()) {
    // Une requête différente à chaque fois : un simple changement de hash ne rechargerait pas la page.
    await page.goto(`/?essai=${i}${hash}`);
    await expect(page.locator('#screen-home [data-count="femme"]')).toHaveText('7 parfums');
    await expectHome(page);
    expect(await historyState(page)).toEqual({ screen: 'home', depth: 0 });
  }
});

test('?idle=3 depuis un ticket : accueil, adresse propre, l\'historique de la session est dépilé', async ({ page }) => {
  await openHome(page, '?idle=3');
  await openSauvageFromLui(page);

  await expect(page.locator('#screen-home')).toBeVisible({ timeout: 6000 });
  await expectHome(page);
  expect(new URL(page.url()).search).toBe('?idle=3');
  expect(await historyState(page)).toEqual({ screen: 'home', depth: 0 });

  // Le client suivant ne retrouve ni la liste ni le ticket du précédent en revenant en arrière.
  await page.goBack();
  await expect(page.locator('#screen-list')).toBeHidden();
  await expect(page.locator('#ticket')).toBeHidden();
});

test('?idle=3&reload=0 depuis un ticket : un seul rechargement, une fois revenu à l\'accueil', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('loads', String(Number(sessionStorage.getItem('loads') || 0) + 1));
    window.addEventListener('pagehide', () => {
      sessionStorage.setItem('unloadedAt', location.href);
      sessionStorage.setItem('unloadedState', JSON.stringify(history.state));
    });
  });
  await openHome(page, '?idle=3&reload=0');
  await page.evaluate(() => { window.__avantRetour = true; });
  await openSauvageFromLui(page);

  await page.waitForEvent('load', { timeout: 8000 });
  await expect(page.locator('#screen-home [data-count="femme"]')).toHaveText('7 parfums');
  await expectHome(page);
  expect(await page.evaluate(() => window.__avantRetour)).toBeUndefined();
  expect(new URL(page.url()).search).toBe('?idle=3&reload=0');

  const unloaded = await page.evaluate(() => ({
    url: sessionStorage.getItem('unloadedAt'),
    state: JSON.parse(sessionStorage.getItem('unloadedState')),
  }));
  expect(new URL(unloaded.url).hash).toBe('');
  expect(unloaded.state).toEqual({ screen: 'home', depth: 0 });

  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => sessionStorage.getItem('loads'))).toBe('2');
});
