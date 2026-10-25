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
  await expect(ticket).toHaveAccessibleName("Notre version n°46, évoque J'ADORE");
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

  // Les libellés accessibles des groupes de la collection suivent la langue.
  await page.locator('#screen-home [data-univers="femme"]').click();
  await expect(page.locator('.segmented')).toHaveAttribute('aria-label', 'Collection');
  await expect(page.locator('#rail-tabs')).toHaveAttribute('aria-label', 'Filter by');
  await expect(page.locator('#brand-rail')).toHaveAttribute('aria-label', 'Filters');
  await page.locator('#screen-list [data-lang-toggle]').click();
  await expect(page.locator('#rail-tabs')).toHaveAttribute('aria-label', 'Filtrer par');
  await expect(page.locator('#brand-rail')).toHaveAttribute('aria-label', 'Filtres');
});

test('?idle=3 : retour à l\'accueil en français après inactivité, sans rechargement avant 10 min', async ({ page }) => {
  await openHome(page, '?idle=3');
  await page.evaluate(() => { window.__avantRetour = true; });
  await page.locator('#screen-home [data-lang-toggle]').click();
  await page.locator('#screen-home [data-univers="femme"]').click();
  await expect(page.locator('#screen-list')).toBeVisible();

  await expect(page.locator('#idle')).toBeVisible();
  await expect(page.locator('#screen-home')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#screen-list')).toBeHidden();
  await expect(page.locator('#idle')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('#home-title')).toHaveText('Quel parfum aimez\u2011vous ?');
  // Moins de 10 minutes depuis le chargement : simple retour, la page n'est pas rechargée.
  expect(await page.evaluate(() => window.__avantRetour)).toBe(true);
});

test('?idle=3&reload=0 : à l\'expiration, la page se recharge (données et code frais) sur l\'accueil', async ({ page }) => {
  await openHome(page, '?idle=3&reload=0');
  await page.evaluate(() => { window.__avantRetour = true; });
  await page.locator('#screen-home [data-univers="femme"]').click();
  await expect(page.locator('#screen-list')).toBeVisible();

  await page.waitForEvent('load', { timeout: 8000 });
  await expect(page.locator('#screen-home')).toBeVisible();
  await expect(page.locator('#screen-home [data-count="femme"]')).toHaveText('7 parfums');
  expect(await page.evaluate(() => window.__avantRetour)).toBeUndefined();
  expect(new URL(page.url()).search).toBe('?idle=3&reload=0');
});

test('Échap sur l\'avertissement d\'inactivité le ferme et relance la minuterie', async ({ page }) => {
  // 13 s : 3 s d'attente puis 10 s d'avertissement.
  await openHome(page, '?idle=13');
  await page.locator('#screen-home [data-univers="femme"]').click();
  const idle = page.locator('#idle');
  await expect(idle).toBeVisible({ timeout: 6000 });

  await page.keyboard.press('Escape');
  await expect(idle).toBeHidden();
  // Sans remise à zéro, le décompte continuerait et rouvrirait l'avertissement dans la seconde.
  await page.waitForTimeout(1800);
  await expect(idle).toBeHidden();
  await expect(page.locator('#screen-list')).toBeVisible();
});

test('avant l\'arrivée des données, la collection affiche « Chargement… » et pas « 0 parfums »', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/parfums', async (route) => {
    await gate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: FIXTURE });
  });
  await page.route('**/data/parfums.json', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('#screen-home [data-count="femme"]')).toHaveText('');

  await page.locator('#screen-home [data-univers="femme"]').click();
  await expect(page.locator('#results')).toHaveText('Chargement…');
  await expect(page.locator('#list-count')).toHaveText('');
  await page.locator('#list-search').fill('sauvage');
  await expect(page.locator('#results')).toHaveText('Chargement…');
  await expect(page.getByText('Aucun parfum')).toHaveCount(0);
  await page.locator('#screen-list [data-lang-toggle]').click();
  await expect(page.locator('#results')).toHaveText('Loading…');

  release();
  await expect(row(page, '342')).toBeVisible();
});

test('?idle=3 : l\'avertissement passe au-dessus du ticket et reste cliquable', async ({ page }) => {
  await openHome(page, '?idle=3');
  await page.locator('#screen-home [data-univers="femme"]').click();
  await row(page, '46').click();
  await expect(page.locator('#ticket')).toBeVisible();

  const idle = page.locator('#idle');
  await expect(page.locator('[data-idle-continue]')).toBeVisible();
  await expect(idle).toHaveAccessibleName(/Retour à l’accueil dans \d+ s/);
  await page.locator('[data-idle-continue]').click();
  await expect(idle).toBeHidden();
  await expect(page.locator('#ticket')).toBeVisible();
  await expect(page.locator('#ticket-num')).toHaveText('46');

  // Sans nouvelle action, l'expiration ferme les deux et revient à l'accueil.
  await expect(page.locator('#screen-home')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test.describe('écran tactile', () => {
  test.use({ hasTouch: true });

  test('?idle=3 : toucher « Continuer » garde le ticket ouvert (pas de clic sur le fond)', async ({ page }) => {
    await openHome(page, '?idle=3');
    await page.locator('#screen-home [data-univers="femme"]').tap();
    await row(page, '46').tap();
    await expect(page.locator('#ticket')).toBeVisible();

    const idle = page.locator('#idle');
    const button = page.locator('[data-idle-continue]');
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    // Séquence tactile réelle : pointerdown, pointerup puis clic synthétisé à la position touchée.
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

    await expect(idle).toBeHidden();
    await expect(page.locator('#ticket')).toBeVisible();
    await expect(page.locator('#ticket-num')).toHaveText('46');
  });
});

test('un double clic rapide n\'ouvre qu\'un seul ticket, sans erreur', async ({ page }) => {
  await page.addInitScript(() => {
    window.__showModalCalls = [];
    const original = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function showModal() {
      window.__showModalCalls.push(this.id);
      return original.call(this);
    };
  });
  const ticketCalls = () => page.evaluate(() => window.__showModalCalls.filter((id) => id === 'ticket').length);

  await openElle(page);
  await row(page, '46').dblclick();
  await expect(page.locator('#ticket')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  expect(await ticketCalls()).toBe(1);

  // Deux appels synchrones : le second ne doit ni lever d'erreur ni rappeler showModal.
  await page.locator('[data-close-ticket]').click();
  await row(page, '193').evaluate((btn) => { btn.click(); btn.click(); });
  await expect(page.locator('#ticket-num')).toHaveText('193');
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  expect(await ticketCalls()).toBe(2);
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
  await page.locator('#home-search').fill('majesty');
  await page.locator('#results .parfum', { hasText: 'FLEUR MAJESTY ROSE ROYALE' }).click();
  await expect(page.locator('#ticket')).toBeVisible();
  await expect(page.locator('#ticket-num')).toHaveText('648');

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

test('sans API ni copie de secours, la collection affiche un message au visiteur', async ({ page }) => {
  await page.route('**/api/parfums', (route) => route.fulfill({ status: 500, body: 'erreur' }));
  await page.route('**/data/parfums.json', (route) => route.fulfill({ status: 404, body: 'absent' }));
  await page.goto('/');
  await expect(page.locator('#data-dot')).toBeVisible();

  await page.locator('#screen-home [data-univers="femme"]').click();
  await expect(page.locator('#results .empty')).toHaveText(
    'La collection est momentanément indisponible. Demandez à un conseiller.');
  await expect(page.locator('#brand-rail')).toBeHidden();
  await page.locator('#list-search').fill('sauvage');
  await expect(page.locator('#results .empty')).toContainText('momentanément indisponible');

  await page.locator('[data-lang-toggle]').last().click();
  await expect(page.locator('#results .empty')).toContainText('temporarily unavailable');

  // Les deux échecs réseau voulus apparaissent en console ; aucune autre erreur n'est admise.
  problems = problems.filter((p) => !p.startsWith('console: Failed to load resource'));
  expect(problems.filter((p) => p.startsWith('pageerror'))).toEqual([]);
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
