// Parcours de la borne : accueil, collections, recherche, familles, ticket, langue, inactivité.
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const FIXTURE = readFileSync(new URL('./fixtures/parfums.json', import.meta.url), 'utf8');

// CSP de la spec §7.5, sans upgrade-insecure-requests (serveur local en HTTP).
const CSP = [
  "default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:",
  "font-src 'self'", "connect-src 'self'", "manifest-src 'self'", "worker-src 'self'",
  "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ');

const MIN_TAP_PX = 48;

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
  // Les compteurs « n parfums » apparaissent une fois les données chargées.
  await expect(page.locator('#screen-home [data-count="femme"]')).toHaveText('7 parfums');
}

async function openElle(page) {
  await openHome(page);
  await page.locator('#screen-home [data-univers="femme"]').click();
  await expect(page.locator('#screen-list')).toBeVisible();
}

test('accueil → Elle → filtre Christian Dior → ticket J\'ADORE', async ({ page }) => {
  await openElle(page);
  await expect(page.locator('#list-title')).toHaveText('Parfums femme');

  await page.locator('#brand-rail .chip', { hasText: 'Christian Dior' }).click();
  await expect(page.locator('#list-title')).toHaveText('Christian Dior');
  await expect(page.locator('#results .parfum')).toHaveCount(3);

  await page.locator('#results .parfum', { hasText: "J'ADORE" }).click();
  const ticket = page.locator('#ticket');
  await expect(ticket).toBeVisible();
  await expect(page.locator('#ticket-num')).toHaveText('46');
  await expect(page.locator('#ticket-notes')).toBeVisible();
  await expect(page.locator('#ticket-notes h3')).toHaveText('Notes du parfum original');

  await page.locator('[data-close-ticket]').click();
  await expect(ticket).toBeHidden();
});

test('dans Elle, « Sauvage » montre les résultats de toute la collection', async ({ page }) => {
  await openElle(page);
  await page.locator('#list-search').fill('Sauvage');
  await expect(page.locator('#list-count')).toContainText('toute la collection');
  await expect(row(page, '342')).toBeVisible();
});

test('une faute de frappe depuis l\'accueil trouve SAUVAGE', async ({ page }) => {
  await openHome(page);
  await page.locator('#home-search').fill('sauvge');
  await expect(page.locator('#screen-list')).toBeVisible();
  await expect(row(page, '342')).toBeVisible();
  await expect(page.locator('#list-search')).toHaveValue('sauvge');
});

test('onglet Par famille → Agrumes : seulement des hespéridés', async ({ page }) => {
  await openElle(page);
  await page.locator('#rail-tabs [data-rail="familles"]').click();
  await page.locator('#brand-rail .chip', { hasText: 'Agrumes' }).click();
  await expect(page.locator('#list-title')).toHaveText('Agrumes');

  const rows = page.locator('#results .parfum');
  await expect(rows).toHaveCount(2);
  await expect(rows.locator('.parfum-meta[data-famille="hesperide"]')).toHaveCount(2);
});

test('le bouton EN passe l\'interface en anglais', async ({ page }) => {
  await openHome(page);
  await page.locator('#screen-home [data-lang-toggle]').click();
  await expect(page.locator('#home-title')).toHaveText('Which fragrance do you love?');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('?idle=3 : retour à l\'accueil en français après inactivité', async ({ page }) => {
  await openHome(page, '?idle=3');
  await page.locator('#screen-home [data-lang-toggle]').click();
  await page.locator('#screen-home [data-univers="femme"]').click();
  await expect(page.locator('#screen-list')).toBeVisible();

  await page.waitForTimeout(4000);
  await expect(page.locator('#screen-home')).toBeVisible();
  await expect(page.locator('#screen-list')).toBeHidden();
  await expect(page.locator('#idle')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('#home-title')).toHaveText('Quel parfum aimez-vous ?');
});

test('un double clic rapide n\'ouvre qu\'un seul ticket, sans erreur', async ({ page }) => {
  await openElle(page);
  await row(page, '46').dblclick();
  await expect(page.locator('#ticket')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(1);

  // Deux appels synchrones : le second ne doit ni lever d'erreur ni rouvrir le ticket.
  await page.locator('[data-close-ticket]').click();
  await row(page, '193').evaluate((btn) => { btn.click(); btn.click(); });
  await expect(page.locator('#ticket-num')).toHaveText('193');
  await expect(page.locator('dialog[open]')).toHaveCount(1);
});

test('une recherche faite d\'espaces et de tirets n\'affiche pas « Aucun parfum »', async ({ page }) => {
  await openHome(page);
  await page.locator('#home-search').fill('  -- ');
  await expect(page.locator('.empty')).toHaveCount(0);

  await page.locator('#screen-home [data-univers="femme"]').click();
  await page.locator('#list-search').fill('  -- ');
  await expect(page.locator('#results .parfum')).toHaveCount(7);
  await expect(page.locator('.empty')).toHaveCount(0);
  await expect(page.getByText('Aucun parfum')).toHaveCount(0);
});

test('le ticket d\'un nom long ne crée pas de défilement horizontal', async ({ page }) => {
  await openHome(page);
  await page.locator('#home-search').fill('smocking');
  await page.locator('#results .parfum', { hasText: 'ROUGE SMOCKING EXTRAIT' }).click();
  await expect(page.locator('#ticket')).toBeVisible();
  await expect(page.locator('#ticket-num')).toHaveText('677');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await page.locator('#ticket').boundingBox();
  const viewport = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
});

test('pas de défilement horizontal sur l\'accueil et la collection', async ({ page }) => {
  await openHome(page);
  const overflowOf = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflowOf()).toBeLessThanOrEqual(0);
  await page.locator('#screen-home [data-univers="homme"]').click();
  await expect(page.locator('#results .parfum').first()).toBeVisible();
  expect(await overflowOf()).toBeLessThanOrEqual(0);
});

test('les zones tactiles de la collection font au moins 48 px', async ({ page }) => {
  await openElle(page);
  const small = await page.evaluate((min) => {
    // Les puces défilent horizontalement : seules celles dans l'écran comptent.
    return Array.from(document.querySelectorAll('#screen-list button, #screen-home button'))
      .map((b) => ({ b, r: b.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && r.left < window.innerWidth)
      .filter(({ r }) => r.width < min || r.height < min)
      .map(({ b, r }) => `${b.className || b.textContent.trim()} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }, MIN_TAP_PX);
  expect(small).toEqual([]);
});

test('aucune violation CSP ni erreur console sur tout le parcours', async ({ page }) => {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  await page.route((url) => url.pathname === '/' || url.pathname === '/index.html', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': CSP },
    });
  });

  await openHome(page);
  await page.locator('#screen-home [data-lang-toggle]').click();
  await page.locator('#screen-home [data-lang-toggle]').click();
  await page.locator('#screen-home [data-univers="femme"]').click();
  await page.locator('#rail-tabs [data-rail="familles"]').click();
  await page.locator('#brand-rail .chip', { hasText: 'Floral' }).click();
  await page.locator('#results .parfum').first().click();
  await expect(page.locator('#ticket')).toBeVisible();
  await page.locator('[data-close-ticket]').click();
  await page.locator('#list-search').fill('zzzzqqq');
  await expect(page.locator('.empty')).toBeVisible();
  await page.locator('[data-home]').click();
  await expect(page.locator('#screen-home')).toBeVisible();

  // Les polices doivent être chargées depuis le site.
  const loadedFamilies = await page.evaluate(async () => {
    await document.fonts.ready;
    const loaded = Array.from(document.fonts).filter((f) => f.status === 'loaded');
    return [...new Set(loaded.map((f) => f.family.replace(/"/g, '')))].sort();
  });
  expect(loadedFamilies).toEqual(['Big Shoulders Display', 'Figtree']);
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
});
