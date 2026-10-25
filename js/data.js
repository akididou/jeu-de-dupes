// Chargement et assainissement des données parfums.
// Module pur : aucun accès au DOM (importé aussi par scripts/update-fallback.mjs sous Node).

import { TEXTS } from './i18n.js';
import { buildIndex, normalize } from './search.js';

export const API_URL = 'api/parfums';
export const FALLBACK_URL = 'data/parfums.json';
export const FETCH_TIMEOUT_MS = 6000;
/** En-tête ajouté par sw.js quand, hors ligne, il sert sa dernière copie de /api/parfums. */
export const FROM_CACHE_HEADER = 'X-From-Cache';

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
 * Clé stricte : ajoute le numéro pour départager les homonymes (même catégorie, nom et marque).
 * @param {string} categorie
 * @param {string} numero
 * @param {string} nom
 * @param {string} marque
 * @returns {string}
 */
export function notesKeyStrict(categorie, numero, nom, marque) {
  return normalize(`${categorie} ${numero} ${nom} ${marque}`);
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

// L'index des notes est une Map qui contient deux entrées par ligne : une clé stricte
// (avec numéro, préfixe « s| ») et une clé souple (sans numéro, préfixe « l| »). Les préfixes
// évitent toute collision entre les deux. Sur la clé souple, la première ligne l'emporte.
const STRICT_PREFIX = 's|';
const LOOSE_PREFIX = 'l|';

/**
 * @param {unknown[]} rows
 * @returns {Map<string, object>}
 */
export function indexNotes(rows) {
  const map = new Map();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || !row.famille) continue;
    const { categorie = '', numero = '', nom = '', marque = '' } = row;
    map.set(STRICT_PREFIX + notesKeyStrict(categorie, numero, nom, marque), row);
    const loose = LOOSE_PREFIX + notesKey(categorie, nom, marque);
    if (!map.has(loose)) map.set(loose, row);
  }
  return map;
}

function findNotes(notes, categorie, numero, nom, marque) {
  return (
    notes.get(STRICT_PREFIX + notesKeyStrict(categorie, numero, nom, marque)) ||
    notes.get(LOOSE_PREFIX + notesKey(categorie, nom, marque)) ||
    {}
  );
}

function olfactif(row, notes, ids) {
  const source = row.famille ? row : findNotes(notes, ...ids);
  const famille = String(source.famille || '').trim();
  return {
    famille: FAMILLES.includes(famille) ? famille : '',
    sousFamille: String(source.sous_famille || '').trim().slice(0, MAX_SOUS_FAMILLE_LENGTH),
    tete: parseNotes(source.notes_tete),
    coeur: parseNotes(source.notes_coeur),
    fond: parseNotes(source.notes_fond),
  };
}

/** Libellés français et anglais de la famille, tels qu'affichés (« Agrumes », « Citrus »). */
function familleLabels(famille) {
  if (!famille) return [];
  return [TEXTS.fr.familles[famille], TEXTS.en.familles[famille]].filter(Boolean);
}

function toParfum(row, notes) {
  if (!row || typeof row !== 'object') return [];
  const categorie = String(row.categorie || '').trim().toLowerCase();
  const numero = String(row.numero || '').trim();
  const nom = String(row.nom || '').trim();
  const marque = String(row.marque || '').trim();
  if (!CATEGORIES.includes(categorie) || !numero || !nom || !marque) return [];
  if (nom.length > MAX_NOM_LENGTH || marque.length > MAX_MARQUE_LENGTH || numero.length > MAX_NUMERO_LENGTH) return [];
  const olf = olfactif(row, notes, [categorie, numero, nom, marque]);
  const index = buildIndex({ nom, marque, ...olf, familleLabels: familleLabels(olf.famille) });
  return [{ categorie, numero, nom, marque, ...olf, index }];
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
 * `fromCache` : réponse servie par le service worker depuis son cache (borne hors ligne).
 * @param {string} url
 * @returns {Promise<{data: unknown, fromCache: boolean}>}
 */
export async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { data: await res.json(), fromCache: res.headers.get(FROM_CACHE_HEADER) === '1' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lit la copie locale (notes + secours), essaie l'API, retombe sur la copie si besoin.
 * Une API servie par le cache du service worker compte comme données de secours (`backup`).
 * @param {{fetchJson?: (url: string) => Promise<{data: unknown, fromCache: boolean}>}} [options]
 * @returns {Promise<{parfums: object[], backup: boolean}>}
 */
export async function loadParfums({ fetchJson: fetcher = fetchJson } = {}) {
  let fallbackRows = [];
  try {
    fallbackRows = (await fetcher(FALLBACK_URL)).data;
  } catch {
    // copie locale illisible : l'API peut encore répondre, sans notes
  }
  const notes = indexNotes(fallbackRows);

  try {
    const api = await fetcher(API_URL);
    const live = sanitize(api.data, notes);
    if (live.length) return { parfums: live, backup: api.fromCache };
  } catch {
    // API indisponible : on passe à la copie de secours
  }

  const backup = sanitize(fallbackRows, notes);
  if (!backup.length) throw new Error('Aucune donnée disponible (API et copie de secours)');
  return { parfums: backup, backup: true };
}
