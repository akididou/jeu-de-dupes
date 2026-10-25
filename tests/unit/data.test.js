import { describe, expect, test } from 'vitest';
import {
  API_URL,
  FALLBACK_URL,
  FAMILLES,
  FETCH_TIMEOUT_MS,
  indexNotes,
  loadParfums,
  notesKey,
  parseNotes,
  sanitize,
} from '../../js/data.js';

const ligne = (extra = {}) => ({ categorie: 'femme', numero: '1', nom: 'N°5', marque: 'CHANEL', ...extra });

describe('constantes', () => {
  test('les URL par défaut sont relatives', () => {
    expect(API_URL).toBe('api/parfums');
    expect(FALLBACK_URL).toBe('data/parfums.json');
    expect(FETCH_TIMEOUT_MS).toBe(6000);
  });
  test('liste les dix familles dans l’ordre', () => {
    expect(FAMILLES).toHaveLength(10);
    expect(FAMILLES[0]).toBe('Hespéridé');
    expect(FAMILLES[9]).toBe('Musqué');
  });
});

describe('parseNotes', () => {
  test('découpe sur la virgule et retire les vides', () => {
    expect(parseNotes('Bergamote, Poivre ,,')).toEqual(['Bergamote', 'Poivre']);
  });
  test('garde 8 notes au maximum', () => {
    expect(parseNotes(Array(12).fill('Rose'))).toHaveLength(8);
  });
  test('retire les notes de plus de 40 caractères', () => {
    expect(parseNotes(['Rose', 'x'.repeat(41)])).toEqual(['Rose']);
  });
  test('accepte une valeur absente', () => {
    expect(parseNotes(undefined)).toEqual([]);
  });
});

describe('notesKey', () => {
  test('normalise catégorie, nom et marque', () => {
    expect(notesKey('Femme', "J'ADORE", 'Dior')).toBe('femme j adore dior');
  });
});

describe('indexNotes', () => {
  test('ne garde que les lignes qui ont une famille', () => {
    const map = indexNotes([ligne({ famille: 'Floral' }), ligne({ nom: 'AUTRE' }), null]);
    expect(map.size).toBe(1);
    expect(map.get(notesKey('femme', 'N°5', 'CHANEL')).famille).toBe('Floral');
  });
});

describe('sanitize', () => {
  test('renvoie une liste vide pour un non-tableau', () => {
    expect(sanitize({ error: 'x' }, new Map())).toEqual([]);
  });
  test('met la catégorie en minuscules sans espaces', () => {
    expect(sanitize([ligne({ categorie: ' Femme ' })], new Map())[0].categorie).toBe('femme');
  });
  test('rejette une ligne dont le nom dépasse 200 caractères', () => {
    expect(sanitize([ligne({ nom: 'A'.repeat(201) })], new Map())).toEqual([]);
  });
  test('rejette les lignes invalides', () => {
    const rows = [null, 'x', ligne({ categorie: 'enfant' }), ligne({ numero: '' }), ligne({ marque: '' })];
    expect(sanitize(rows, new Map())).toEqual([]);
  });
  test('remplace une famille inconnue par une chaîne vide', () => {
    expect(sanitize([ligne({ famille: 'Inconnue' })], new Map())[0].famille).toBe('');
  });
  test('les notes de la ligne priment sur les notes de secours', () => {
    const notes = indexNotes([ligne({ famille: 'Boisé', notes_tete: 'Cèdre' })]);
    const [p] = sanitize([ligne({ famille: 'Floral', sous_famille: 'Aldéhydé', notes_tete: 'Rose, Jasmin' })], notes);
    expect(p.famille).toBe('Floral');
    expect(p.sousFamille).toBe('Aldéhydé');
    expect(p.tete).toEqual(['Rose', 'Jasmin']);
  });
  test('applique les notes de secours quand la ligne n’a pas de famille', () => {
    const notes = indexNotes([ligne({ famille: 'Boisé', sous_famille: 'Sec', notes_tete: ['Cèdre'], notes_coeur: 'Iris', notes_fond: 'Musc' })]);
    const [p] = sanitize([ligne()], notes);
    expect(p).toMatchObject({ famille: 'Boisé', sousFamille: 'Sec', tete: ['Cèdre'], coeur: ['Iris'], fond: ['Musc'] });
  });
  test('construit l’index de recherche', () => {
    const [p] = sanitize([ligne({ famille: 'Floral', notes_coeur: 'Rose' })], new Map());
    expect(p.index.words).toEqual(['n', '5', 'chanel']);
    expect(p.index.noteWords).toContain('rose');
  });
});

describe('loadParfums', () => {
  const secours = [ligne({ famille: 'Floral', notes_tete: 'Rose' })];
  const apiValide = [ligne({ nom: 'API' })];

  const faux = (api) => async (url) => {
    if (url === FALLBACK_URL) return secours;
    if (url === API_URL) {
      if (api instanceof Error) throw api;
      return api;
    }
    throw new Error(`URL inattendue : ${url}`);
  };

  test('utilise l’API quand elle est valide', async () => {
    const res = await loadParfums({ fetchJson: faux(apiValide) });
    expect(res.backup).toBe(false);
    expect(res.parfums[0].nom).toBe('API');
  });
  test('complète les lignes de l’API avec les notes de secours', async () => {
    const res = await loadParfums({ fetchJson: faux([ligne()]) });
    expect(res.backup).toBe(false);
    expect(res.parfums[0].famille).toBe('Floral');
  });
  test('bascule sur la copie de secours si l’API renvoie une erreur', async () => {
    const res = await loadParfums({ fetchJson: faux({ error: 'x' }) });
    expect(res.backup).toBe(true);
    expect(res.parfums).toHaveLength(1);
    expect(res.parfums[0].famille).toBe('Floral');
  });
  test('bascule sur la copie de secours si l’API lève', async () => {
    const res = await loadParfums({ fetchJson: faux(new Error('réseau')) });
    expect(res.backup).toBe(true);
    expect(res.parfums).toHaveLength(1);
  });
  test('rejette si tout échoue', async () => {
    const fetchJson = async () => { throw new Error('hors ligne'); };
    await expect(loadParfums({ fetchJson })).rejects.toThrow();
  });
  test('rejette si la copie de secours est vide et l’API en erreur', async () => {
    const fetchJson = async (url) => (url === FALLBACK_URL ? [] : { error: 'x' });
    await expect(loadParfums({ fetchJson })).rejects.toThrow();
  });
  test('utilise l’API même si le secours est illisible', async () => {
    const fetchJson = async (url) => {
      if (url === FALLBACK_URL) throw new Error('404');
      return apiValide;
    };
    const res = await loadParfums({ fetchJson });
    expect(res.backup).toBe(false);
  });
});
