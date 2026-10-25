// Mise en forme des textes affichés. Module pur, sans accès au DOM.

const SHORT_WORD_MAX = 3;
const LOWERCASE_PARTICLES = ['DE', 'DI', 'DU'];

/**
 * « ACQUA DI PARMA » devient « Acqua di Parma » ; « BDK PARFUMS » devient « BDK Parfums ».
 * @param {string} marque
 * @returns {string}
 */
export function prettyBrand(marque) {
  return marque
    .split(' ')
    .map((word, i) => {
      if (i > 0 && LOWERCASE_PARTICLES.includes(word)) return word.toLowerCase();
      if (word.length <= SHORT_WORD_MAX) return word;
      return word.charAt(0) + word.slice(1).toLowerCase();
    })
    .join(' ');
}
