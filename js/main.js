// Point d'entrée de la borne : état, actions, événements et démarrage.

import { loadParfums } from './data.js';
import { translate } from './i18n.js';
import { createIdleTimer } from './idle.js';
import { hasQuery, openTicket, renderList, renderTexts } from './views.js';

const DEFAULT_IDLE_SECONDS = 60;
const MAX_IDLE_WARNING_SECONDS = 10;
// Un double appui sur une ligne ne doit pas refermer aussitôt le ticket par un clic sur le fond.
const TICKET_BACKDROP_GUARD_MS = 500;

const INITIAL_STATE = Object.freeze({
  lang: 'fr', univers: null, query: '', brand: null, famille: null, railMode: 'marques',
});

let state = INITIAL_STATE;
let parfums = [];
let ticketOpenedAt = 0;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/** `?idle=N` : durée totale d'inactivité en secondes (60 par défaut), avertissement 10 s au plus. */
function idleSettings(search) {
  const requested = Number(new URLSearchParams(search).get('idle'));
  const totalSeconds = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_IDLE_SECONDS;
  const warningSeconds = Math.max(0, Math.min(MAX_IDLE_WARNING_SECONDS, totalSeconds - 1));
  return { totalSeconds, warningSeconds };
}

// ---------- Inactivité ----------

const idle = createIdleTimer({
  ...idleSettings(location.search),
  isActive: () => state.univers !== null || Boolean(state.query) || $('#ticket').open || state.lang !== 'fr',
  onWarn: (remaining) => {
    $('#idle-text').textContent = translate(state.lang, 'idle')(remaining);
    $('#idle').hidden = false;
  },
  onExpire: () => {
    state = { ...state, lang: 'fr' };
    goHome();
  },
});

function resetIdle() {
  $('#idle').hidden = true;
  idle.reset();
}

// ---------- Rendu ----------

function scrollListTop() {
  $('.list-body').scrollTop = 0;
}

function render() {
  const onHome = state.univers === null;
  $('#screen-home').hidden = !onHome;
  $('#screen-list').hidden = onHome;
  $$('[data-search-input]').forEach((input) => {
    if (input.value !== state.query) input.value = state.query;
  });
  renderTexts(state, parfums);
  if (!onHome) renderList(state, parfums, actions);
  resetIdle();
}

function update(patch) {
  state = { ...state, ...patch };
  render();
}

// ---------- Actions ----------

function goUnivers(univers) {
  update({ univers, brand: null, famille: null });
  scrollListTop();
}

function setQuery(query) {
  if (hasQuery(query) && state.univers === null) {
    update({ query, univers: 'tous' });
    const input = $('#list-search');
    input.focus();
    input.setSelectionRange(query.length, query.length);
    return;
  }
  update({ query });
  scrollListTop();
}

function goHome() {
  state = { ...INITIAL_STATE, lang: state.lang };
  const dialog = $('#ticket');
  if (dialog.open) dialog.close();
  if (document.activeElement) document.activeElement.blur();
  render();
}

function showTicket(parfum) {
  if (openTicket(parfum, state.lang)) ticketOpenedAt = performance.now();
  resetIdle();
}

const actions = {
  selectBrand: (brand) => { update({ brand }); scrollListTop(); },
  selectFamille: (famille) => { update({ famille }); scrollListTop(); },
  clearQuery: () => setQuery(''),
  showTicket,
};

// ---------- Démarrage ----------

function bindTicket() {
  const dialog = $('#ticket');
  $('[data-close-ticket]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    const justOpened = performance.now() - ticketOpenedAt < TICKET_BACKDROP_GUARD_MS;
    if (e.target === dialog && !justOpened) dialog.close();
  });
  dialog.addEventListener('close', resetIdle);
}

function bindEvents() {
  $$('[data-univers]').forEach((b) => b.addEventListener('click', () => goUnivers(b.dataset.univers)));
  $$('[data-search-input]').forEach((input) => input.addEventListener('input', () => setQuery(input.value)));
  $$('[data-search-form]').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.querySelector('input').blur();
  }));
  $('[data-clear]').addEventListener('click', () => { setQuery(''); $('#list-search').focus(); });
  $('[data-home]').addEventListener('click', goHome);
  $$('#rail-tabs button').forEach((b) => b.addEventListener('click', () => {
    update({ railMode: b.dataset.rail, brand: null, famille: null });
  }));
  $$('[data-lang-toggle]').forEach((b) => b.addEventListener('click', () => {
    update({ lang: state.lang === 'fr' ? 'en' : 'fr' });
  }));
  bindTicket();

  $('[data-idle-continue]').addEventListener('click', resetIdle);
  ['pointerdown', 'keydown', 'input', 'scroll'].forEach((type) =>
    document.addEventListener(type, resetIdle, { capture: true, passive: true }));
}

async function init() {
  bindEvents();
  render();
  try {
    const loaded = await loadParfums();
    parfums = loaded.parfums;
    $('#data-dot').hidden = !loaded.backup;
  } catch {
    // Ni API ni copie de secours : la borne reste utilisable (listes vides), le point prévient le personnel.
    parfums = [];
    $('#data-dot').hidden = false;
  }
  render();
}

init();
