// Met à jour data/parfums.json depuis le Google Sheet (via opensheet).
// Les notes absentes du Sheet sont reprises du fichier existant.
// Usage : node scripts/update-fallback.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { indexNotes, sanitize } from '../js/data.js';

const SHEET_URL = 'https://opensheet.elk.sh/11QQ55WHs43F2B-M8TdxmKHM42U5h7QoWmHlSBAKt3MI/1';
const FALLBACK_FILE = new URL('../data/parfums.json', import.meta.url);
const TIMEOUT_MS = 15000;

async function readExisting() {
  try {
    return JSON.parse(await readFile(FALLBACK_FILE, 'utf8'));
  } catch {
    return [];
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

async function main() {
  const notes = indexNotes(await readExisting());
  const parfums = sanitize(await fetchSheet(), notes);
  if (!parfums.length) throw new Error('Aucune ligne valide dans le Sheet : fichier inchangé');
  await writeFile(FALLBACK_FILE, `${JSON.stringify(parfums.map(toSheetRow), null, 1)}\n`, 'utf8');
  console.log(`${parfums.length} parfums`);
}

main().catch((err) => {
  console.error(`Échec : ${err.message}`);
  process.exit(1);
});
