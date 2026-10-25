// Chargement et assainissement des données parfums.
// Module pur : aucun accès au DOM (importé aussi par scripts/update-fallback.mjs sous Node).

import { buildIndex, normalize } from './search.js';

export const API_URL = 'api/parfums';
export const FALLBACK_URL = 'data/parfums.json';
export const FETCH_TIMEOUT_MS = 6000;

export const FAMILLES = [
  'Hespéridé', 'Aquatique', 'Aromatique', 'Floral', 'Chypré',
  'Boisé', 'Ambré', 'Gourmand', 'Cuir', 'Musqué',
];

const CATEGORIES = ['femme', 'homme'];
const MAX_NOTES = 8;
const MAX_NOTE_LENGTH = 40;
const MAX_NOM_LENGTH = 200;
const MAX_MARQUE_LENGTH = 100;
const MAX_NUMERO_LENGTH = 10;
const MAX_SOUS_FAMILLE_LENGTH = 60;

/**
 * @param {string} categorie
 * @param {string} nom
 * @param {string} marque
 * @returns {string}
 */
export function notesKey(categorie, nom, marque) {
  return normalize(`${categorie} ${nom} ${marque}`);
}

/**
 * Colonnes du Sheet : « Bergamote, Poivre » ; tableau possible dans la copie de secours.
 * @param {string | string[] | undefined} value
 * @returns {string[]}
 */
export function parseNotes(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return list
    .map((note) => String(note).trim())
    .filter((note) => note && note.length <= MAX_NOTE_LENGTH)
    .slice(0, MAX_NOTES);
}

/**
 * @param {unknown[]} rows
 * @returns {Map<string, object>}
 */
export function indexNotes(rows) {
  const map = new Map();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || !row.famille) continue;
    map.set(notesKey(row.categorie || '', row.nom || '', row.marque || ''), row);
  }
  return map;
}

function olfactif(row, notes, key) {
  const source = row.famille ? row : notes.get(key) || {};
  const famille = String(source.famille || '').trim();
  return {
    famille: FAMILLES.includes(famille) ? famille : '',
    sousFamille: String(source.sous_famille || '').trim().slice(0, MAX_SOUS_FAMILLE_LENGTH),
    tete: parseNotes(source.notes_tete),
    coeur: parseNotes(source.notes_coeur),
    fond: parseNotes(source.notes_fond),
  };
}

function toParfum(row, notes) {
  if (!row || typeof row !== 'object') return [];
  const categorie = String(row.categorie || '').trim().toLowerCase();
  const numero = String(row.numero || '').trim();
  const nom = String(row.nom || '').trim();
  const marque = String(row.marque || '').trim();
  if (!CATEGORIES.includes(categorie) || !numero || !nom || !marque) return [];
  if (nom.length > MAX_NOM_LENGTH || marque.length > MAX_MARQUE_LENGTH || numero.length > MAX_NUMERO_LENGTH) return [];
  const olf = olfactif(row, notes, notesKey(categorie, nom, marque));
  return [{ categorie, numero, nom, marque, ...olf, index: buildIndex({ nom, marque, ...olf }) }];
}

/**
 * @param {unknown} entries
 * @param {Map<string, object>} notes
 * @returns {object[]}
 */
export function sanitize(entries, notes) {
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((row) => toParfum(row, notes));
}

/**
 * @param {string} url
 * @returns {Promise<unknown>}
 */
export async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lit la copie locale (notes + secours), essaie l'API, retombe sur la copie si besoin.
 * @param {{fetchJson?: (url: string) => Promise<unknown>}} [options]
 * @returns {Promise<{parfums: object[], backup: boolean}>}
 */
export async function loadParfums({ fetchJson: fetcher = fetchJson } = {}) {
  let fallbackRows = [];
  try {
    fallbackRows = await fetcher(FALLBACK_URL);
  } catch {
    // copie locale illisible : l'API peut encore répondre, sans notes
  }
  const notes = indexNotes(fallbackRows);

  try {
    const live = sanitize(await fetcher(API_URL), notes);
    if (live.length) return { parfums: live, backup: false };
  } catch {
    // API indisponible : on passe à la copie de secours
  }

  const backup = sanitize(fallbackRows, notes);
  if (!backup.length) throw new Error('Aucune donnée disponible (API et copie de secours)');
  return { parfums: backup, backup: true };
}
