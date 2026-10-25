import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:4173',
    // Les service workers masquent les requêtes à page.route ; seul hors-ligne.spec.js les autorise.
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npx http-server . -p 4173 -c-1 -s',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'tablette-paysage',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 } },
    },
    {
      name: 'tablette-portrait',
      use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
});
