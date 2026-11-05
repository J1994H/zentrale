// Speicher: Alle Daten liegen nur auf diesem Gerät (localStorage). Nichts wird verschickt.
const KEY = 'zentrale-daten';
const VERSION = 1;

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export function defaults() {
  return {
    version: VERSION,
    settings: {
      vault: '',
      searchEngine: 'startpage',
      areas: ['Arbeit', 'Privat', 'Finanzen', 'Abos & Versicherungen'],
      lastArea: 'Privat',
      keywords: [
        { id: uid(), word: 'Pitch', type: 'obsidian', note: 'Pitch-Ideen' },
        { id: uid(), word: 'Buch', type: 'obsidian', note: 'Bücher' },
        { id: uid(), word: 'Notiz', type: 'obsidian', note: 'Notizen' },
        { id: uid(), word: 'Einkauf', type: 'list', list: 'l-einkauf' },
        { id: uid(), word: 'Aufgabe', type: 'task', area: 'Privat' },
      ],
    },
    dumpDraft: '',
    inbox: [],   // Brain-Dump-Einträge, die noch einsortiert werden
    tasks: [],   // Aufgaben
    outbox: [],  // Warten darauf, an Obsidian geschickt zu werden
    sent: [],    // Zuletzt an Obsidian geschickt
    lists: [
      { id: 'l-todo', name: 'To-do', items: [] },
      { id: 'l-einkauf', name: 'Einkaufsliste', items: [] },
      { id: 'l-pack', name: 'Packliste', items: [] },
      { id: 'l-essen', name: 'Essensplan', kind: 'meals', days: ['', '', '', '', '', '', ''], items: [] },
    ],
    templates: [],
    focus: null, // „3 für heute“ des aktuellen Tages
    tiles: [
      { id: uid(), name: 'Kalender', url: 'calshow://' },
      { id: uid(), name: 'Obsidian', url: 'obsidian://open' },
      { id: uid(), name: 'Claude', url: 'https://claude.ai/new' },
      { id: uid(), name: 'Wetter', url: 'weather://' },
    ],
  };
}

// Ergänzt fehlende Felder (z. B. nach einem Update oder beim Wiederherstellen).
export function migrate(d) {
  const base = defaults();
  const out = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
  for (const k of ['inbox', 'tasks', 'outbox', 'sent', 'lists', 'templates', 'tiles']) {
    if (!Array.isArray(out[k])) out[k] = base[k];
  }
  for (const l of out.lists) {
    if (!l.kind) l.kind = l.id === 'l-essen' ? 'meals' : 'todo';
    if (!Array.isArray(l.items)) l.items = [];
    if (l.kind === 'meals' && !Array.isArray(l.days)) l.days = Array(7).fill('');
  }
  out.version = VERSION;
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.error(e);
  }
  return defaults();
}

let state = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    alert('Speichern hat nicht geklappt: ' + e.message);
  }
}

export const get = () => state;

export function update(fn) {
  fn(state);
  save();
}

// Für „Rückgängig“
export const snapshot = () => JSON.stringify(state);
export function restore(snap) {
  state = JSON.parse(snap);
  save();
}

// Sichern & Wiederherstellen
export function exportJSON() {
  return JSON.stringify({ app: 'zentrale', exported: new Date().toISOString(), data: state }, null, 2);
}

export function importJSON(text) {
  const o = JSON.parse(text);
  const d = o && o.app === 'zentrale' ? o.data : o;
  if (!d || typeof d !== 'object' || !Array.isArray(d.tasks) || !d.settings) {
    throw new Error('Das ist keine Sicherung dieser App.');
  }
  state = migrate(d);
  save();
}
