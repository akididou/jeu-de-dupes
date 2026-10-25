import { describe, expect, test } from 'vitest';
import { prettyBrand } from '../../js/format.js';

describe('prettyBrand', () => {
  test('met la particule en minuscules hors première position', () => {
    expect(prettyBrand('ACQUA DI PARMA')).toBe('Acqua di Parma');
  });
  test('garde en majuscules un mot de trois lettres ou moins', () => {
    expect(prettyBrand('BDK PARFUMS')).toBe('BDK Parfums');
  });
  test('met en majuscule la première lettre seulement', () => {
    expect(prettyBrand('CHANEL')).toBe('Chanel');
  });
  test('garde la particule en majuscules en première position', () => {
    expect(prettyBrand('DU BARRY')).toBe('DU Barry');
  });
});
