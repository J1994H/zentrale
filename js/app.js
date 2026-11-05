// Start der App: verbindet die Bereiche (Module) mit der unteren Leiste.
import * as store from './store.js';
import { h, icon } from './ui.js';
import { today as todayIso } from './dates.js';
import today from './modules/today.js';
import dump from './modules/dump.js';
import lists from './modules/lists.js';
import settings from './modules/settings.js';
import tasks from './modules/tasks.js';

// Neue Bereiche (z. B. Merkliste, Italienisch) hier eintragen.
// Jedes Modul hat: id, title, icon, render(root, ctx) und optional settings(ctx), badge(state),
// tab: false (kein Knopf unten) und parent (welcher Knopf unten markiert wird).
const modules = [today, dump, lists, settings, tasks];

const main = document.getElementById('main');
const tabbar = document.getElementById('tabbar');
let current = null;
let renderedDay = todayIso();

const ctx = {
  store,
  modules,
  go(id) {
    if (location.hash === '#' + id) refresh();
    else location.hash = id;
  },
  refresh,
};

function render() {
  renderedDay = todayIso();
  main.replaceChildren();
  current.render(main, ctx);
  updateTabs();
}

function refresh() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

// Adressen: #heute, #listen, #listen/<id> (ctx.param = Teil nach dem Schrägstrich)
function route() {
  const [id, ...rest] = location.hash.slice(1).split('/');
  const next = modules.find((m) => m.id === id) || modules[0];
  const param = rest.length ? decodeURIComponent(rest.join('/')) : null;
  const changed = next !== current || param !== ctx.param;
  current = next;
  ctx.param = param;
  render();
  if (changed) window.scrollTo(0, 0);
}

function buildTabs() {
  tabbar.replaceChildren(...modules.filter((m) => m.tab !== false).map((m) =>
    h('a', { class: 'tab', href: '#' + m.id, 'data-id': m.id }, icon(m.icon), h('span', {}, m.title))));
}

function updateTabs() {
  const state = store.get();
  for (const a of tabbar.children) {
    const m = modules.find((x) => x.id === a.dataset.id);
    a.toggleAttribute('aria-current', false);
    if (m === current || m.id === current.parent) a.setAttribute('aria-current', 'page');
    a.querySelector('.dot')?.remove();
    const n = m.badge ? m.badge(state) : 0;
    if (n) a.append(h('span', { class: 'dot' }, n > 99 ? '99+' : n));
  }
}

buildTabs();
window.addEventListener('hashchange', route);
route();

// Neuer Tag seit dem letzten Öffnen? Dann neu aufbauen.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayIso() !== renderedDay) refresh();
});

// Offline-Fähigkeit und dauerhafter Speicher
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
