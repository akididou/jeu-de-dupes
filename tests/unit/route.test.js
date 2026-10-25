import { describe, expect, test } from 'vitest';
import { LIST_HASH, dupeHash, findParfum, parseRoute, slugify } from '../../js/route.js';

const make = (categorie, numero, nom) => ({ categorie, numero, nom, marque: 'MARQUE' });

const SAUVAGE = make('homme', '342', 'SAUVAGE');
const JADORE = make('femme', '46', "J'ADORE");
const ACQUA = make('femme', '515', 'ACQUA DI PARMA');
const HOMONYME = make('femme', '515', 'BLUE MEDITERRANEO');
const OEILLET = make('femme', '7', 'Œillet Épicé');
const P = [SAUVAGE, JADORE, ACQUA, HOMONYME, OEILLET];

describe('slugify', () => {
  test('normalise le nom et sépare les mots par des tirets', () => {
    expect(slugify('SAUVAGE')).toBe('sauvage');
    expect(slugify("J'ADORE")).toBe('j-adore');
    expect(slugify('Œillet Épicé')).toBe('oeillet-epice');
    expect(slugify('  ACQUA   DI PARMA ')).toBe('acqua-di-parma');
  });
});

describe('dupeHash', () => {
  test('adresse lisible #/dupe/<categorie>/<numero>-<slug>', () => {
    expect(dupeHash(SAUVAGE)).toBe('#/dupe/homme/342-sauvage');
    expect(dupeHash(JADORE)).toBe('#/dupe/femme/46-j-adore');
    expect(dupeHash(ACQUA)).toBe('#/dupe/femme/515-acqua-di-parma');
  });

  test('le hash de la liste est #/collection', () => {
    expect(LIST_HASH).toBe('#/collection');
  });
});

describe('parseRoute', () => {
  test('sans hash : accueil', () => {
    expect(parseRoute('')).toEqual({ screen: 'home' });
    expect(parseRoute('#')).toEqual({ screen: 'home' });
    expect(parseRoute(undefined)).toEqual({ screen: 'home' });
  });

  test('#/collection : liste', () => {
    expect(parseRoute('#/collection')).toEqual({ screen: 'list' });
  });

  test('un dupe : catégorie, numéro et slug', () => {
    expect(parseRoute('#/dupe/homme/342-sauvage'))
      .toEqual({ screen: 'dupe', categorie: 'homme', numero: '342', slug: 'sauvage' });
    expect(parseRoute('#/dupe/femme/515-acqua-di-parma'))
      .toEqual({ screen: 'dupe', categorie: 'femme', numero: '515', slug: 'acqua-di-parma' });
  });

  test('aller-retour avec dupeHash', () => {
    for (const p of P) {
      const route = parseRoute(dupeHash(p));
      expect(route.screen).toBe('dupe');
      expect(findParfum(route, P)).toBe(p);
    }
  });

  test('hash invalide : accueil', () => {
    for (const hash of [
      '#/dupe/x/999-nope', '#/dupe/homme/342', '#/dupe/homme/-sauvage', '#/dupe/homme',
      '#/dupe/homme/342-sauvage/extra', '#/autre', '#collection', '#/dupe/homme/34%202-x',
      '#/dupe/HOMME/342-sauvage', 'n/importe/quoi',
    ]) {
      expect(parseRoute(hash)).toEqual({ screen: 'home' });
    }
  });
});

describe('findParfum', () => {
  test('trouve par catégorie et numéro', () => {
    expect(findParfum(parseRoute('#/dupe/homme/342-sauvage'), P)).toBe(SAUVAGE);
  });

  test('un seul candidat : le slug n\'est pas exigé (nom corrigé dans le Sheet)', () => {
    expect(findParfum(parseRoute('#/dupe/homme/342-ancien-nom'), P)).toBe(SAUVAGE);
  });

  test('n°515 femme : deux homonymes, le slug départage', () => {
    expect(findParfum(parseRoute('#/dupe/femme/515-acqua-di-parma'), P)).toBe(ACQUA);
    expect(findParfum(parseRoute('#/dupe/femme/515-blue-mediterraneo'), P)).toBe(HOMONYME);
  });

  test('n°515 femme avec un slug inconnu : aucun parfum', () => {
    expect(findParfum(parseRoute('#/dupe/femme/515-inconnu'), P)).toBeNull();
  });

  test('mauvaise catégorie ou numéro inconnu : aucun parfum', () => {
    expect(findParfum(parseRoute('#/dupe/femme/342-sauvage'), P)).toBeNull();
    expect(findParfum(parseRoute('#/dupe/homme/999-nope'), P)).toBeNull();
  });

  test('route qui n\'est pas un dupe ou catalogue vide : aucun parfum', () => {
    expect(findParfum({ screen: 'home' }, P)).toBeNull();
    expect(findParfum({ screen: 'list' }, P)).toBeNull();
    expect(findParfum(parseRoute('#/dupe/homme/342-sauvage'), [])).toBeNull();
  });
});
