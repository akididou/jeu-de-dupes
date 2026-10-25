import { describe, expect, test } from 'vitest';
import { MIN_KEPT_RATIO, isBelowFloor } from '../../scripts/update-fallback.mjs';

describe('update-fallback : plancher du nombre de lignes', () => {
  test('le plancher est de 90 % des lignes existantes', () => {
    expect(MIN_KEPT_RATIO).toBe(0.9);
  });
  test('refuse une copie qui perd plus de 10 % des lignes', () => {
    expect(isBelowFloor(169, 188)).toBe(true);
    expect(isBelowFloor(1, 188)).toBe(true);
  });
  test('accepte une perte de 10 % au plus, ou une hausse', () => {
    expect(isBelowFloor(170, 188)).toBe(false);
    expect(isBelowFloor(188, 188)).toBe(false);
    expect(isBelowFloor(250, 188)).toBe(false);
  });
  test('sans fichier existant, toute copie non vide est acceptée', () => {
    expect(isBelowFloor(1, 0)).toBe(false);
  });
});
