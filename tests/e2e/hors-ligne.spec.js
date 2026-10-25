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
