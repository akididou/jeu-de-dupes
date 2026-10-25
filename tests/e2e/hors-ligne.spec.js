// Application installable : le service worker rend la borne utilisable sans réseau.
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const FIXTURE = readFileSync(new URL('./fixtures/parfums.json', import.meta.url), 'utf8');

test.use({ serviceWorkers: 'allow' });

/** Attend que le service worker soit actif et contrôle la page (recharge une fois si besoin). */
async function waitForControlledPage(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  const controlled = () => page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  if (!(await controlled())) await page.reload();
  await expect.poll(controlled).toBe(true);
}

test('le manifest est déclaré dans la page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
});

test('sans réseau, l\'accueil s\'affiche et « Lui » ouvre une liste non vide', async ({ page, context }) => {
  await page.route('**/api/parfums', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: FIXTURE }));
  await page.goto('/');
  await waitForControlledPage(page);

  await context.setOffline(true);
  await page.reload();

  await expect(page.locator('#screen-home')).toBeVisible();
  await expect(page.locator('#screen-home [data-count="homme"]')).not.toBeEmpty();
  await page.locator('#screen-home [data-univers="homme"]').click();
  await expect(page.locator('#screen-list')).toBeVisible();
  expect(await page.locator('#results .parfum').count()).toBeGreaterThan(0);
});

test('hors ligne, la liste du Sheet servie par le cache du SW allume le point de secours', async ({ page, context }) => {
  // context.route intercepte aussi les requêtes faites par le service worker.
  await context.route('**/api/parfums', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: FIXTURE }));
  await page.goto('/');
  await waitForControlledPage(page);
  // Un chargement contrôlé par le SW : sa copie de /api/parfums est en cache.
  await page.reload();
  await expect(page.locator('#screen-home [data-count="femme"]')).toHaveText('7 parfums');
  await expect(page.locator('#data-dot')).toBeHidden();

  await context.unroute('**/api/parfums');
  await context.route('**/api/parfums', (route) => route.abort('internetdisconnected'));
  await context.setOffline(true);
  await page.reload();

  // Données du Sheet (7 parfums femme de la fixture, pas ceux de la copie de secours), mais périmées.
  await expect(page.locator('#screen-home [data-count="femme"]')).toHaveText('7 parfums');
  await expect(page.locator('#data-dot')).toBeVisible();
});
