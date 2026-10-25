// Point d'entrée de la borne : état, actions, événements et démarrage.

import { loadParfums } from './data.js';
import { translate } from './i18n.js';
import { createIdleTimer } from './idle.js';
import { hasQuery } from './search.js';
import { openTicket, renderList, renderTexts } from './views.js';

const DEFAULT_IDLE_SECONDS = 60;
const MAX_IDLE_WARNING_SECONDS = 10;
// Au retour automatique à l'accueil, la page est rechargée (données du Sheet, nouvelle version
// du site) au plus une fois par intervalle. `?reload=N` le change, en secondes (aide de test).
const DEFAULT_RELOAD_SECONDS = 10 * 60;
const MS_PER_SECOND = 1000;
// Un double appui sur une ligne ne doit pas refermer aussitôt le ticket par un clic sur le fond.
const TICKET_BACKDROP_GUARD_MS = 500;

const INITIAL_STATE = Object.freeze({
  lang: 'fr', univers: null, query: '', brand: null, famille: null, railMode: 'marques',
  loading: true, unavailable: false,
});

let state = INITIAL_STATE;
let parfums = [];
let ticketOpenedAt = 0;
const loadedAt = Date.now();
// Un nouveau service worker a pris la main : la prochaine expiration recharge, sans attendre l'intervalle.
let updateActivated = false;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/** Paramètre d'adresse en secondes ; absent, vide ou invalide : la valeur par défaut. */
function secondsParam(search, name, { fallback, allowZero }) {
  const raw = new URLSearchParams(search).get(name);
  if (raw === null || raw.trim() === '') return fallback;
  const seconds = Number(raw);
  const valid = Number.isFinite(seconds) && (allowZero ? seconds >= 0 : seconds > 0);
  return valid ? seconds : fallback;
}

/** `?idle=N` : durée totale d'inactivité en secondes (60 par défaut), avertissement 10 s au plus. */
function idleSettings(search) {
  const totalSeconds = secondsParam(search, 'idle', { fallback: DEFAULT_IDLE_SECONDS, allowZero: false });
  const warningSeconds = Math.max(0, Math.min(MAX_IDLE_WARNING_SECONDS, totalSeconds - 1));
  return { totalSeconds, warningSeconds };
}

const RELOAD_INTERVAL_MS = MS_PER_SECOND
  * secondsParam(location.search, 'reload', { fallback: DEFAULT_RELOAD_SECONDS, allowZero: true });

/**
 * Recharger au retour à l'accueil ? Oui si un nouveau service worker est actif ou si l'intervalle est
 * écoulé, à condition que la page puisse revenir : réseau présent, ou service worker qui la sert hors ligne.
 */
function shouldReload() {
  const canComeBack = navigator.onLine || Boolean(navigator.serviceWorker?.controller);
  return canComeBack && (updateActivated || Date.now() - loadedAt >= RELOAD_INTERVAL_MS);
}

// ---------- Inactivité ----------

const idle = createIdleTimer({
  ...idleSettings(location.search),
  isActive: () => state.univers !== null || Boolean(state.query) || $('#ticket').open || state.lang !== 'fr',
  // L'avertissement est un <dialog> modal : il passe au-dessus du ticket et reste cliquable.
  onWarn: (remaining) => {
    $('#idle-text').textContent = translate(state.lang, 'idle')(remaining);
    const warning = $('#idle');
    if (!warning.open) warning.showModal();
  },
  onExpire: () => {
    closeIdleWarning();
    state = { ...state, lang: 'fr' };
    goHome();
    if (shouldReload()) location.reload();
  },
});

function closeIdleWarning() {
  const warning = $('#idle');
  if (warning.open) warning.close();
}

/**
 * Activité du visiteur. Un appui dans l'avertissement ne le ferme pas : sur un écran tactile il
 * disparaîtrait avant le `click`, qui tomberait sur ce qu'il recouvre. Le bouton « Continuer » le ferme.
 */
function onActivity(event) {
  const warning = $('#idle');
  const insideWarning = event.target !== warning && warning.contains(event.target);
  if (warning.open && insideWarning) return;
  resetIdle();
}

function resetIdle() {
  closeIdleWarning();
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
  state = { ...INITIAL_STATE, lang: state.lang, loading: state.loading, unavailable: state.unavailable };
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
  // Échap ou retour Android ferment le <dialog> sans passer par « Continuer » : c'est aussi une activité.
  $('#idle').addEventListener('cancel', (event) => {
    event.preventDefault();
    resetIdle();
  });
  ['pointerdown', 'keydown', 'input', 'scroll'].forEach((type) =>
    document.addEventListener(type, onActivity, { capture: true, passive: true }));
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Le SW appelle skipWaiting et clients.claim : une nouvelle version prend la main dès son installation.
  // Le tout premier contrôle (aucun SW avant) n'est pas une mise à jour.
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) updateActivated = true;
    hadController = true;
  });
  // Sans bloquer l'affichage : l'enregistrement attend la fin du chargement de la page.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((error) => {
      console.warn('Service worker non enregistré :', error);
    });
  });
}

async function init() {
  registerServiceWorker();
  bindEvents();
  render();
  try {
    const loaded = await loadParfums();
    parfums = loaded.parfums;
    $('#data-dot').hidden = !loaded.backup;
  } catch {
    // Ni API ni copie de secours : la liste affiche un message au visiteur, le point prévient le personnel.
    parfums = [];
    state = { ...state, unavailable: true };
    $('#data-dot').hidden = false;
  }
  state = { ...state, loading: false };
  render();
}

init();
