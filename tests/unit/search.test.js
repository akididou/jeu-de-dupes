import { describe, expect, test } from 'vitest';
import { buildIndex, levenshtein, normalize, search } from '../../js/search.js';

const make = (numero, nom, marque, extra = {}) => {
  const base = { famille: '', sousFamille: '', tete: [], coeur: [], fond: [], ...extra };
  return { categorie: 'Test', numero, nom, marque, ...base, index: buildIndex({ nom, marque, ...base }) };
};

const P = [
  make('1', "J'ADORE", 'DIOR', { famille: 'Floral', tete: ['Poire'], coeur: ['Rose'] }),
  make('2', 'SAUVAGE', 'DIOR', { famille: 'Aromatique', tete: ['Bergamote'] }),
  make('3', 'EAU SAUVAGE', 'DIOR', { famille: 'Hespéridé' }),
  make('127', 'COCO MADEMOISELLE', 'CHANEL', { famille: 'Oriental', fond: ['Patchouli'] }),
  make('4', 'COCO NOIR', 'CHANEL', { famille: 'Oriental' }),
  make('5', 'SHALIMAR', 'GUERLAIN', { famille: 'Oriental', sousFamille: 'Vanillé', fond: ['Vanille'] }),
  make('6', 'COCO', 'AUTRE MARQUE'),
];

describe('normalize', () => {
  test('retire accents, casse et ponctuation', () => {
    expect(normalize("J'ADORE  Éclat")).toBe('j adore eclat');
  });
  test('renvoie une chaîne vide pour de la ponctuation seule', () => {
    expect(normalize('  -- ')).toBe('');
  });
});

describe('levenshtein', () => {
  test('distance 1 pour une lettre manquante', () => {
    expect(levenshtein('sauvge', 'sauvage')).toBe(1);
  });
  test('renvoie 2 si les longueurs diffèrent de plus de 1', () => {
    expect(levenshtein('abc', 'abcdef')).toBe(2);
  });
});

describe('buildIndex', () => {
  test('construit mots, forme compacte et mots de notes', () => {
    const idx = buildIndex({ nom: "J'ADORE", marque: 'DIOR', famille: 'Floral', sousFamille: '', tete: ['Poire'], coeur: [], fond: [] });
    expect(idx.words).toEqual(['j', 'adore', 'dior']);
    expect(idx.compact).toBe('jadoredior');
    expect(idx.nomCompact).toBe('jadore');
    expect(idx.noteWords).toEqual(['floral', 'poire']);
  });
  test('noteWords vide sans notes', () => {
    const idx = buildIndex({ nom: 'A', marque: 'B', famille: '', sousFamille: '', tete: [], coeur: [], fond: [] });
    expect(idx.noteWords).toEqual([]);
  });
});

describe('search', () => {
  test('"jadore" place J\'ADORE en premier', () => {
    expect(search('jadore', P)[0].nom).toBe("J'ADORE");
  });
  test('tolère une faute de frappe', () => {
    const noms = search('sauvge', P).map((p) => p.nom);
    expect(noms).toContain('SAUVAGE');
    expect(noms).toContain('EAU SAUVAGE');
  });
  test('un numéro exact arrive en premier', () => {
    expect(search('127', P)[0].numero).toBe('127');
  });
  test('trouve par note de fond uniquement', () => {
    const noms = search('vanille', P).map((p) => p.nom);
    expect(noms).toContain('SHALIMAR');
  });
  test('"chanel coco" ne renvoie que des Chanel', () => {
    const res = search('chanel coco', P);
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((p) => p.marque === 'CHANEL')).toBe(true);
  });
  test('requête de ponctuation seule renvoie []', () => {
    expect(search('  -- ', P)).toEqual([]);
  });
  test('requête sans correspondance renvoie []', () => {
    expect(search('zzzz', P)).toEqual([]);
  });
  test('bonus nom exact et tri marque puis nom à score égal', () => {
    const res = search('coco', P);
    expect(res[0].nom).toBe('COCO');
    expect(res.map((p) => p.nom)).toEqual(['COCO', 'COCO MADEMOISELLE', 'COCO NOIR']);
  });
});
