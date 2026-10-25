// Moteur de recherche tolérant (accents, fautes de frappe, notes).
// Module pur : aucun accès au DOM ni au réseau, importable depuis Node.

const SCORE_NUMERO = 100;
const SCORE_MOT_EXACT = 80;
const SCORE_DEBUT_MOT = 60;
const SCORE_COMPACT = 40;
const SCORE_NOTE = 30;
const SCORE_FAUTE = 20;
const BONUS_NOM_EXACT = 50;
const MIN_NOTE_LENGTH = 3;
const MIN_TYPO_LENGTH = 4;

/**
 * @param {string} text
 * @returns {string}
 */
export function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Vrai si la recherche contient au moins un caractère cherchable (pas seulement espaces ou ponctuation).
 * @param {string} query
 * @returns {boolean}
 */
export function hasQuery(query) {
  return normalize(query) !== '';
}

/**
 * @param {{nom: string, marque: string, famille: string, sousFamille: string,
 *   tete: string[], coeur: string[], fond: string[]}} p
 * @returns {{words: string[], compact: string, nomCompact: string, noteWords: string[]}}
 */
export function buildIndex({ nom, marque, famille, sousFamille, tete, coeur, fond }) {
  const text = normalize(`${nom} ${marque}`);
  const notes = normalize([famille, sousFamille, ...tete, ...coeur, ...fond].join(' '));
  return {
    words: text.split(' '),
    compact: text.replace(/ /g, ''),
    nomCompact: normalize(nom).replace(/ /g, ''),
    noteWords: notes ? notes.split(' ') : [],
  };
}

/**
 * Distance d'édition, plafonnée à 2 dès que les longueurs diffèrent de plus de 1.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function isTypo(token, word) {
  return levenshtein(token, word) <= 1 || levenshtein(token, word.slice(0, token.length)) <= 1;
}

function tokenScore(token, p) {
  if (p.numero === token) return SCORE_NUMERO;
  const { words, compact, noteWords } = p.index;
  if (words.includes(token)) return SCORE_MOT_EXACT;
  if (words.some((w) => w.startsWith(token))) return SCORE_DEBUT_MOT;
  if (compact.includes(token)) return SCORE_COMPACT;
  if (token.length >= MIN_NOTE_LENGTH && noteWords.some((w) => w.startsWith(token))) return SCORE_NOTE;
  if (token.length >= MIN_TYPO_LENGTH && words.some((w) => isTypo(token, w))) return SCORE_FAUTE;
  return 0;
}

function byBrandThenName(a, b) {
  return a.marque.localeCompare(b.marque, 'fr') || a.nom.localeCompare(b.nom, 'fr');
}

/**
 * @template {{numero: string, nom: string, marque: string, index: ReturnType<typeof buildIndex>}} T
 * @param {string} query
 * @param {T[]} parfums
 * @returns {T[]}
 */
export function search(query, parfums) {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const whole = tokens.join('');
  return parfums
    .map((p) => {
      const scores = tokens.map((tok) => tokenScore(tok, p));
      if (scores.includes(0) && !p.index.compact.includes(whole)) return null;
      const bonus = p.index.nomCompact === whole ? BONUS_NOM_EXACT : 0;
      return { p, score: scores.reduce((a, b) => a + b, 0) + bonus };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || byBrandThenName(a.p, b.p))
    .map((r) => r.p);
}
