// Adresses de la borne (partie après « # ») : accueil, liste, ou un dupe précis.
// Module pur : aucun accès au DOM, importable depuis Node.

import { normalize } from './search.js';

/** Hash de l'écran liste. L'accueil n'a pas de hash. */
export const LIST_HASH = '#/collection';

const DUPE_PATTERN = /^#\/dupe\/(femme|homme)\/([a-z0-9]+)-([a-z0-9-]*)$/;

/**
 * @typedef {{categorie: string, numero: string, nom: string}} Parfum
 * @typedef {{screen: 'home'} | {screen: 'list'}
 *   | {screen: 'dupe', categorie: string, numero: string, slug: string}} Route
 */

/**
 * Nom normalisé (sans accents ni ponctuation), mots séparés par « - ».
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return normalize(text).replace(/ /g, '-');
}

/** Numéro tel qu'il figure dans l'adresse : sans espace ni tiret (le premier tiret sépare le slug). */
function numeroKey(numero) {
  return normalize(numero).replace(/ /g, '');
}

/**
 * @param {Parfum} parfum
 * @returns {string} ex. `#/dupe/homme/342-sauvage`
 */
export function dupeHash(parfum) {
  return `#/dupe/${parfum.categorie}/${numeroKey(parfum.numero)}-${slugify(parfum.nom)}`;
}

/**
 * Écran désigné par un hash. Tout hash inconnu ou mal formé mène à l'accueil.
 * @param {string|undefined} hash
 * @returns {Route}
 */
export function parseRoute(hash) {
  if (hash === LIST_HASH) return { screen: 'list' };
  const match = DUPE_PATTERN.exec(hash || '');
  if (!match) return { screen: 'home' };
  const [, categorie, numero, slug] = match;
  return { screen: 'dupe', categorie, numero, slug };
}

/**
 * Parfum désigné par une route de dupe. Un numéro peut être porté par deux parfums d'une même
 * catégorie (n°515 femme) : le slug les départage. Un seul candidat suffit, même si le nom a changé.
 * @template {Parfum} T
 * @param {Route} route
 * @param {T[]} parfums
 * @returns {T|null}
 */
export function findParfum(route, parfums) {
  if (route.screen !== 'dupe') return null;
  const candidates = parfums.filter((p) => p.categorie === route.categorie && numeroKey(p.numero) === route.numero);
  if (candidates.length === 1) return candidates[0];
  return candidates.find((p) => slugify(p.nom) === route.slug) || null;
}
