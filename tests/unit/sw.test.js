import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const SW_SOURCE = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
const MANIFEST = JSON.parse(readFileSync(resolve(ROOT, 'manifest.webmanifest'), 'utf8'));

/** Entrées du tableau `PRECACHE` de sw.js (chaînes entre apostrophes). */
function precachedPaths() {
  const block = SW_SOURCE.match(/const PRECACHE = \[([\s\S]*?)\];/);
  if (!block) throw new Error('Tableau PRECACHE introuvable dans sw.js');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('sw.js', () => {
  test('contient le marqueur de version que deploy.sh remplace', () => {
    expect(SW_SOURCE).toContain("const CACHE = 'dupes-__VERSION__';");
  });

  test('chaque fichier précaché existe (sinon cache.addAll échoue et le SW ne s\'installe pas)', () => {
    const paths = precachedPaths();
    expect(paths.length).toBeGreaterThan(10);
    const missing = paths.filter((p) => !existsSync(resolve(ROOT, p === './' ? 'index.html' : p)));
    expect(missing).toEqual([]);
  });

  test('précache le shell, les données de secours et les icônes du manifest', () => {
    const paths = precachedPaths();
    const iconPaths = MANIFEST.icons.map((icon) => icon.src);
    for (const expected of ['./', 'index.html', 'manifest.webmanifest', 'data/parfums.json', 'assets/affiche.jpg', ...iconPaths]) {
      expect(paths).toContain(expected);
    }
  });
});

describe('manifest.webmanifest', () => {
  test('déclare une application plein écran installable', () => {
    expect(MANIFEST).toMatchObject({
      name: 'Jeux de Dupes : trouvez votre parfum',
      short_name: 'Dupes',
      display: 'fullscreen',
      orientation: 'any',
      background_color: '#2A0D14',
      theme_color: '#2A0D14',
      start_url: './',
      scope: './',
    });
  });

  test('chaque icône existe, avec une variante maskable', () => {
    for (const icon of MANIFEST.icons) expect(existsSync(resolve(ROOT, icon.src))).toBe(true);
    expect(MANIFEST.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
    expect(MANIFEST.icons.some((icon) => icon.purpose === 'any')).toBe(true);
  });
});
