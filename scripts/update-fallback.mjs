// Met à jour data/parfums.json depuis le Google Sheet (via opensheet).
// Les notes absentes du Sheet sont reprises du fichier existant.
// Usage : node scripts/update-fallback.mjs
// Refuse d'écrire (code 1, fichier intact) si le Sheet a perdu plus de 10 % des lignes du fichier actuel.

import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { indexNotes, sanitize } from '../js/data.js';

const SHEET_URL = 'https://opensheet.elk.sh/11QQ55WHs43F2B-M8TdxmKHM42U5h7QoWmHlSBAKt3MI/1';
const FALLBACK_FILE = new URL('../data/parfums.json', import.meta.url);
const TEMP_FILE = new URL('../data/parfums.json.tmp', import.meta.url);
const TIMEOUT_MS = 15000;
/** Part minimale des lignes actuelles que la nouvelle copie doit conserver. */
export const MIN_KEPT_RATIO = 0.9;

/**
 * Vrai si la nouvelle copie perd trop de lignes (Sheet tronqué, filtre actif, onglet vidé...).
 * @param {number} newCount lignes valides venues du Sheet
 * @param {number} existingCount lignes du fichier actuel (0 s'il n'existe pas)
 * @param {number} [ratio]
 * @returns {boolean}
 */
export function isBelowFloor(newCount, existingCount, ratio = MIN_KEPT_RATIO) {
  return newCount < existingCount * ratio;
}

/** Fichier absent : liste vide. Toute autre erreur (lecture, JSON invalide) fait échouer le script. */
async function readExisting() {
  try {
    const rows = JSON.parse(await readFile(FALLBACK_FILE, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw new Error(`data/parfums.json illisible (${err.message}) : fichier inchangé`);
  }
}

async function fetchSheet() {
  const res = await fetch(SHEET_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const toSheetRow = (p) => ({
  categorie: p.categorie,
  numero: p.numero,
  nom: p.nom,
  marque: p.marque,
  famille: p.famille,
  sous_famille: p.sousFamille,
  notes_tete: p.tete.join(', '),
  notes_coeur: p.coeur.join(', '),
  notes_fond: p.fond.join(', '),
});

/** Écriture atomique : fichier temporaire puis renommage (jamais de fichier à moitié écrit). */
async function writeAtomically(content) {
  try {
    await writeFile(TEMP_FILE, content, 'utf8');
    await rename(TEMP_FILE, FALLBACK_FILE);
  } catch (err) {
    await rm(TEMP_FILE, { force: true });
    throw err;
  }
}

async function main() {
  const existing = await readExisting();
  const parfums = sanitize(await fetchSheet(), indexNotes(existing));
  if (!parfums.length) throw new Error('Aucune ligne valide dans le Sheet : fichier inchangé');
  if (isBelowFloor(parfums.length, existing.length)) {
    throw new Error(`${parfums.length} lignes valides dans le Sheet contre ${existing.length} dans le fichier `
      + `(moins de ${MIN_KEPT_RATIO * 100} %) : fichier inchangé. Vérifiez le Sheet.`);
  }
  await writeAtomically(`${JSON.stringify(parfums.map(toSheetRow), null, 1)}\n`);
  console.log(`${parfums.length} parfums`);
}

// Exécuté seulement en ligne de commande : les tests importent isBelowFloor sans lancer le script.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(`Échec : ${err.message}`);
    process.exit(1);
  });
}
