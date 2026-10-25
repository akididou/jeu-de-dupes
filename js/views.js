// Rendu DOM de la borne : textes, filtres, lignes de parfums, ticket.
// Les données passent uniquement par textContent / createElement (aucun innerHTML).

import { FAMILLES } from './data.js';
import { prettyBrand } from './format.js';
import { translate } from './i18n.js';
import { hasQuery, normalize, search } from './search.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/**
 * @typedef {{lang: string, univers: string|null, query: string, brand: string|null,
 *   famille: string|null, railMode: 'marques'|'familles', unavailable: boolean}} State
 * @typedef {{selectBrand: (marque: string|null) => void, selectFamille: (famille: string|null) => void,
 *   clearQuery: () => void, showTicket: (parfum: object) => void}} Actions
 */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function familleSlug(famille) {
  return normalize(famille).replace(/ /g, '-');
}

function byBrandThenName(a, b) {
  return a.marque.localeCompare(b.marque, 'fr') || a.nom.localeCompare(b.nom, 'fr');
}

function universLabel(categorie, lang) {
  return translate(lang, categorie === 'femme' ? 'univFemme' : 'univHomme');
}

function parfumRow(p, showUnivers, lang, actions) {
  const btn = el('button', 'parfum');
  btn.type = 'button';
  btn.addEventListener('click', () => actions.showTicket(p));

  const stub = el('span', 'parfum-stub');
  stub.append(el('small', '', 'n°'), el('b', '', p.numero));

  const info = el('span', 'parfum-info');
  info.append(
    el('span', 'parfum-evoque', translate(lang, 'evoque')),
    el('span', 'parfum-nom', p.nom),
    el('span', 'parfum-marque', prettyBrand(p.marque)),
  );

  const meta = [];
  if (p.famille) meta.push(p.sousFamille || translate(lang, 'familles')[p.famille]);
  if (showUnivers) meta.push(universLabel(p.categorie, lang));
  if (meta.length) {
    const line = el('span', 'parfum-meta', meta.join(', '));
    if (p.famille) line.dataset.famille = familleSlug(p.famille);
    info.append(line);
  }

  btn.append(stub, info);
  return btn;
}

function chip(label, isPressed, onPress, famille) {
  const node = el('button', 'chip', label);
  node.type = 'button';
  node.setAttribute('aria-pressed', String(isPressed));
  if (famille) node.dataset.famille = familleSlug(famille);
  node.addEventListener('click', onPress);
  return node;
}

/** Mode du rail réellement affiché : « familles » seulement si des parfums en ont une. */
function effectiveRailMode(state, scope) {
  return scope.some((p) => p.famille) ? state.railMode : 'marques';
}

function renderRail(state, scope, actions) {
  const rail = $('#brand-rail');
  const tabs = $('#rail-tabs');
  rail.replaceChildren();
  const searching = hasQuery(state.query);
  rail.hidden = searching || !scope.length;
  tabs.hidden = searching || !scope.some((p) => p.famille);
  if (rail.hidden) return;

  const t = (key) => translate(state.lang, key);
  const mode = effectiveRailMode(state, scope);
  $$('#rail-tabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rail === mode)));

  if (mode === 'familles') {
    const present = FAMILLES.filter((f) => scope.some((p) => p.famille === f));
    rail.append(
      chip(t('allFamilies'), state.famille === null, () => actions.selectFamille(null)),
      ...present.map((f) => chip(t('familles')[f], state.famille === f, () => actions.selectFamille(f), f)),
    );
    return;
  }

  const brands = [...new Set(scope.map((p) => p.marque))].sort((a, b) => a.localeCompare(b, 'fr'));
  rail.append(
    chip(t('allBrands'), state.brand === null, () => actions.selectBrand(null)),
    ...brands.map((b) => chip(prettyBrand(b), state.brand === b, () => actions.selectBrand(b))),
  );
}

function universTitles(lang) {
  return {
    femme: translate(lang, 'titleFemme'),
    homme: translate(lang, 'titleHomme'),
    tous: translate(lang, 'titleTous'),
  };
}

function renderSearch(state, parfums, scope, actions) {
  const t = (key) => translate(state.lang, key);
  const inUnivers = (p) => state.univers === 'tous' || p.categorie === state.univers;
  const titles = universTitles(state.lang);
  const query = state.query.trim();
  let found = search(state.query, scope);
  let label = `${t('found')(found.length)} · ${titles[state.univers]}`;
  // Rien dans l'univers choisi : on montre plutôt les résultats de toute la collection.
  if (!found.length && state.univers !== 'tous') {
    const everywhere = search(state.query, parfums);
    if (everywhere.length) {
      found = everywhere;
      label = t('foundElsewhere')(titles[state.univers], found.length);
    }
  }
  $('#list-title').textContent = t('titleSearch')(query);
  $('#list-count').textContent = label;

  const results = $('#results');
  if (!found.length) {
    const empty = el('div', 'empty');
    const btn = el('button', '', t('clear'));
    btn.type = 'button';
    btn.addEventListener('click', actions.clearQuery);
    empty.append(el('p', '', t('empty')(query)), btn);
    results.append(empty);
    return;
  }
  const mixed = found.some((p) => !inUnivers(p));
  results.append(...found.map((p) => parfumRow(p, state.univers === 'tous' || mixed, state.lang, actions)));
}

function renderBrowse(state, scope, actions) {
  const t = (key) => translate(state.lang, key);
  const byFamily = effectiveRailMode(state, scope) === 'familles';
  const filter = byFamily ? state.famille : state.brand;
  const shown = scope
    .filter((p) => !filter || (byFamily ? p.famille === filter : p.marque === filter))
    .sort(byBrandThenName);

  if (filter) $('#list-title').textContent = byFamily ? t('familles')[filter] : prettyBrand(filter);
  else $('#list-title').textContent = universTitles(state.lang)[state.univers];
  $('#list-count').textContent = t('count')(shown.length);

  const results = $('#results');
  let currentBrand = null;
  shown.forEach((p) => {
    if ((byFamily || !state.brand) && p.marque !== currentBrand) {
      currentBrand = p.marque;
      results.append(el('h3', 'brand-group', prettyBrand(p.marque)));
    }
    results.append(parfumRow(p, state.univers === 'tous', state.lang, actions));
  });
}

/** Ni API ni copie de secours : un message pour le visiteur plutôt qu'une liste vide. */
function renderUnavailable(state) {
  $('#list-title').textContent = universTitles(state.lang)[state.univers];
  $('#list-count').textContent = '';
  const empty = el('div', 'empty');
  empty.append(el('p', '', translate(state.lang, 'unavailable')));
  $('#results').append(empty);
}

/**
 * Écran collection : sélecteur d'univers, rail de filtres et résultats.
 * @param {State} state
 * @param {object[]} parfums
 * @param {Actions} actions
 */
export function renderList(state, parfums, actions) {
  const scope = parfums.filter((p) => state.univers === 'tous' || p.categorie === state.univers);
  $('#results').replaceChildren();
  renderRail(state, scope, actions);

  $$('.segmented button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.univers === state.univers)));
  $('[data-clear]').hidden = !state.query;

  if (state.unavailable) renderUnavailable(state);
  else if (hasQuery(state.query)) renderSearch(state, parfums, scope, actions);
  else renderBrowse(state, scope, actions);
}

/**
 * Textes fixes de l'interface dans la langue courante, et compteurs de l'accueil.
 * @param {State} state
 * @param {object[]} parfums
 */
export function renderTexts(state, parfums) {
  const t = (key) => translate(state.lang, key);
  document.documentElement.lang = state.lang;
  $$('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach((n) => { n.placeholder = t(n.dataset.i18nPlaceholder); });
  $$('[data-i18n-aria]').forEach((n) => n.setAttribute('aria-label', t(n.dataset.i18nAria)));
  $$('[data-lang-toggle]').forEach((n) => {
    n.textContent = t('langSwitch');
    n.setAttribute('aria-label', t('langLabel'));
  });
  $$('[data-count]').forEach((n) => {
    const total = parfums.filter((p) => p.categorie === n.dataset.count).length;
    n.textContent = total ? t('count')(total) : '';
  });
  $('#data-dot').title = t('offline');
}

/**
 * Ouvre la fiche « ticket » d'un parfum. Ne fait rien si elle est déjà ouverte (double appui).
 * @param {object} parfum
 * @param {string} lang
 * @returns {boolean} vrai si le ticket vient d'être ouvert
 */
export function openTicket(parfum, lang) {
  const dialog = $('#ticket');
  if (dialog.open) return false;
  const t = (key) => translate(lang, key);

  $('#ticket-num').textContent = parfum.numero;
  $('#ticket-nom').textContent = parfum.nom;
  $('#ticket-marque').textContent = prettyBrand(parfum.marque);
  const univers = universLabel(parfum.categorie, lang);
  $('#ticket-univers').textContent = parfum.sousFamille ? `${univers}, ${parfum.sousFamille.toLowerCase()}` : univers;

  const tiers = [['tete', parfum.tete], ['coeur', parfum.coeur], ['fond', parfum.fond]]
    .filter(([, list]) => list.length);
  $('#ticket-notes').hidden = !tiers.length;
  $('#ticket-notes-list').replaceChildren(
    ...tiers.flatMap(([key, list]) => [el('dt', '', t(key)), el('dd', '', list.join(', '))]),
  );

  dialog.showModal();
  return true;
}
