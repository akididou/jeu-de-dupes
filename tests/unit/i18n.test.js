import { describe, expect, test } from 'vitest';
import { translate } from '../../js/i18n.js';

describe('translate', () => {
  test('renvoie la valeur française ou anglaise', () => {
    expect(translate('fr', 'elle')).toBe('Elle');
    expect(translate('en', 'elle')).toBe('Her');
  });

  test('renvoie une fonction appelable pour les textes dynamiques', () => {
    expect(translate('fr', 'found')(1)).toBe('1 parfum trouvé');
    expect(translate('en', 'found')(3)).toBe('3 fragrances found');
  });

  test('renvoie l’objet des familles', () => {
    expect(translate('fr', 'familles').Hespéridé).toBe('Agrumes');
  });

  test('a un message pour une collection indisponible, en français et en anglais', () => {
    expect(translate('fr', 'unavailable')).toBe('La collection est momentanément indisponible. Demandez à un conseiller.');
    expect(translate('en', 'unavailable')).toBe('The collection is temporarily unavailable. Please ask a sales associate.');
  });

  test('le titre d’accueil français garde « aimez-vous » insécable (trait d’union U+2011, espace insécable avant « ? »)', () => {
    expect(translate('fr', 'homeTitle')).toBe('Quel parfum aimez‑vous ?');
  });

  test('retombe sur le français pour une langue inconnue', () => {
    expect(translate('de', 'elle')).toBe('Elle');
  });

  test('renvoie la clé elle-même quand elle est inconnue', () => {
    expect(translate('fr', 'cleInexistante')).toBe('cleInexistante');
  });
});
