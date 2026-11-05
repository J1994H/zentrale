// Heute (Startbildschirm): Suche, deine 3 für heute, die nächsten 7 Tage, Schnellzugriff.
import { h, icon, sheet, toast, choice, field } from '../ui.js';
import { uid } from '../store.js';
import * as D from '../dates.js';
import { focusTasks, isChecked, isOpenToday, byDate } from '../tasks.js';
import { taskRow, taskMeta } from '../taskui.js';

export const ENGINES = {
  startpage: { name: 'Startpage', url: 'https://www.startpage.com/do/search?q=' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=' },
  brave: { name: 'Brave', url: 'https://search.brave.com/search?q=' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
};

// Apps, die sich per Link öffnen lassen. Alle anderen gehen über einen Kurzbefehl.
export const TILE_PRESETS = [
  { name: 'Kalender', url: 'calshow://' },
  { name: 'Obsidian', url: 'obsidian://open' },
  { name: 'Claude', url: 'https://claude.ai/new' },
  { name: 'Wetter', url: 'weather://' },
  { name: 'Erinnerungen', url: 'x-apple-reminderkit://' },
  { name: 'Notizen', url: 'mobilenotes://' },
  { name: 'Mail', url: 'message://' },
  { name: 'Karten', url: 'maps://' },
  { name: 'Fotos', url: 'photos-redirect://' },
  { name: 'Musik', url: 'music://' },
  { name: 'Spotify', url: 'spotify://' },
  { name: 'WhatsApp', url: 'whatsapp://' },
  { name: 'Kurzbefehle', url: 'shortcuts://' },
];

const isWeb = (url) => /^https?:/i.test(url);
const shortcutUrl = (name) => 'shortcuts://run-shortcut?name=' + encodeURIComponent(name);

function openUrl(url) {
  if (isWeb(url)) window.open(url, '_blank', 'noopener,noreferrer');
  else location.href = url;
}

// ---------- Suche ----------

function searchBar(ctx) {
  const s = ctx.store.get();
  const q = h('input', {
    type: 'search', placeholder: 'Suchen oder Claude fragen …', enterkeyhint: 'search',
    'aria-label': 'Suchbegriff oder Frage', autocomplete: 'off',
  });
  const search = () => {
    const text = q.value.trim();
    if (!text) return q.focus();
    const engine = ENGINES[s.settings.searchEngine] || ENGINES.startpage;
    openUrl(engine.url + encodeURIComponent(text));
  };
  const askClaude = () => {
    const text = q.value.trim();
    // Sicherheitsnetz: Frage kopieren, falls Claude sie nicht automatisch übernimmt.
    if (text && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast('Frage kopiert. Fehlt sie bei Claude: einfügen.')).catch(() => {});
    }
    openUrl('https://claude.ai/new' + (text ? '?q=' + encodeURIComponent(text) : ''));
  };
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
  return h('div', { class: 'searchbar' }, q,
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary compact', type: 'button', onclick: search }, icon('search'), 'Suchen'),
      h('button', { class: 'btn compact', type: 'button', onclick: askClaude }, icon('spark'), 'Claude fragen')));
}

// ---------- 3 für heute ----------

function pickSheet(ctx, replaceId) {
  const s = ctx.store.get();
  const picks = s.focus?.picks || [];
  const options = s.tasks.filter((t) => isOpenToday(t) && !picks.includes(t.id)).sort(byDate);
  const choose = (id) => {
    ctx.store.update((st) => {
      const f = st.focus;
      if (replaceId) {
        f.skipped.push(replaceId);
        if (id) f.picks[f.picks.indexOf(replaceId)] = id;
        else f.picks = f.picks.filter((x) => x !== replaceId);
      } else if (id) {
        f.picks.push(id);
      }
    });
    ui.close();
    ctx.refresh();
  };
  const ui = sheet(replaceId ? 'Tauschen gegen …' : 'Für heute wählen',
    options.length
      ? h('div', { class: 'group' }, options.map((t) => h('button', { class: 'row-btn', type: 'button', onclick: () => choose(t.id) },
        h('span', { class: 'task-body' }, h('span', { class: 'task-text' }, t.text), h('span', { class: 'task-meta' }, taskMeta(t))))))
      : h('p', { class: 'empty' }, 'Keine weiteren offenen Aufgaben.'),
    replaceId && h('div', { class: 'gap' }),
    replaceId && h('button', { class: 'btn ghost', type: 'button', onclick: () => choose(null) }, 'Nur für heute entfernen'),
  );
}

// ---------- Schnellzugriff ----------

function tileLink(t) {
  const web = isWeb(t.url);
  return h('a', { class: 'tile', href: t.url, target: web ? '_blank' : null, rel: web ? 'noopener noreferrer' : null },
    h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, (t.name.trim()[0] || '?').toUpperCase()),
    h('span', { class: 'tile-name' }, t.name));
}

function tilesEditor(ctx) {
  const list = h('div', { class: 'group' });
  const draw = () => {
    const tiles = ctx.store.get().tiles;
    const move = (i, dir) => {
      ctx.store.update((st) => {
        const [x] = st.tiles.splice(i, 1);
        st.tiles.splice(i + dir, 0, x);
      });
      draw();
      ctx.refresh();
    };
    list.replaceChildren(...tiles.map((t, i) => h('div', { class: 'edit-row' },
      h('span', {}, t.name),
      h('button', { class: 'mini', type: 'button', 'aria-label': `${t.name} nach oben`, disabled: i === 0, onclick: () => move(i, -1) }, icon('up')),
      h('button', { class: 'mini', type: 'button', 'aria-label': `${t.name} nach unten`, disabled: i === tiles.length - 1, onclick: () => move(i, 1) }, icon('down')),
      h('button', {
        class: 'mini danger', type: 'button', 'aria-label': `${t.name} entfernen`,
        onclick: () => { ctx.store.update((st) => { st.tiles = st.tiles.filter((x) => x.id !== t.id); }); draw(); ctx.refresh(); },
      }, icon('x')))));
    if (!tiles.length) list.append(h('p', { class: 'empty' }, 'Noch keine Kacheln.'));
  };
  draw();
  const ui = sheet('Schnellzugriff bearbeiten', list,
    h('div', { class: 'gap' }),
    h('button', { class: 'btn', type: 'button', onclick: () => { ui.close(); addTileSheet(ctx); } }, icon('plus'), 'Kachel hinzufügen'),
    h('div', { class: 'gap' }),
    h('button', { class: 'btn primary', type: 'button', onclick: () => ui.close() }, 'Fertig'));
}

function addTileSheet(ctx) {
  const s = ctx.store.get();
  const used = new Set(s.tiles.map((t) => t.url));
  const add = (name, url) => {
    ctx.store.update((st) => st.tiles.push({ id: uid(), name, url }));
    ui.close();
    ctx.refresh();
    toast(`„${name}“ hinzugefügt`);
  };

  let kind = 'shortcut';
  const name = h('input', { placeholder: 'Name, z. B. Banking', 'aria-label': 'Name der Kachel', autocapitalize: 'words' });
  const value = h('input', { placeholder: 'Name des Kurzbefehls', 'aria-label': 'Kurzbefehl oder Link', autocapitalize: 'off', autocorrect: 'off' });
  const kindChoice = choice([
    { value: 'shortcut', label: 'Kurzbefehl' },
    { value: 'link', label: 'Link' },
  ], kind, (v) => { kind = v; value.placeholder = v === 'link' ? 'z. B. https://… oder app://' : 'Name des Kurzbefehls'; });
  const addOwn = () => {
    const n = name.value.trim();
    const v = value.value.trim();
    if (!n) return name.focus();
    if (kind === 'shortcut') add(n, shortcutUrl(v || n));
    else if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^javascript:/i.test(v)) add(n, v);
    else { value.focus(); toast('Bitte einen gültigen Link eingeben'); }
  };

  const presets = TILE_PRESETS.filter((p) => !used.has(p.url));
  const ui = sheet('Kachel hinzufügen',
    presets.length > 0 && h('span', { class: 'label' }, 'Öffnen sich direkt'),
    presets.length > 0 && h('div', { class: 'group' }, presets.map((p) =>
      h('button', { class: 'row-btn', type: 'button', onclick: () => add(p.name, p.url) }, icon('plus'), p.name))),
    h('h2', {}, 'Andere App'),
    field('Wie öffnen?', kindChoice),
    field('Name', name),
    field('Kurzbefehl oder Link', value),
    h('button', { class: 'btn primary', type: 'button', onclick: addOwn }, 'Hinzufügen'),
    h('details', {},
      h('summary', {}, 'So legst du einen Kurzbefehl an'),
      h('ol', { class: 'steps' },
        h('li', {}, 'Öffne die App „Kurzbefehle“ und tippe oben rechts auf „+“.'),
        h('li', {}, 'Tippe auf „Aktion hinzufügen“ und suche „App öffnen“.'),
        h('li', {}, 'Tippe auf das blaue Wort „App“ und wähle die gewünschte App.'),
        h('li', {}, 'Tippe oben auf den Namen und nenne ihn z. B. „Banking“. Dann „Fertig“.'),
        h('li', {}, 'Hier „Kurzbefehl“ wählen und genau diesen Namen eintragen.'))),
  );
}

// ---------- Ansicht ----------

export default {
  id: 'heute',
  title: 'Heute',
  icon: 'sun',

  render(root, ctx) {
    let picks;
    ctx.store.update((st) => { picks = focusTasks(st); });
    const s = ctx.store.get();
    const t = D.today();
    const until = D.addDays(t, 7);

    root.append(
      h('h1', {}, 'Heute'),
      h('p', { class: 'sub' }, new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })),
      searchBar(ctx),
    );

    if (s.inbox.length) {
      root.append(h('a', { class: 'notice', href: '#dump' },
        s.inbox.length === 1 ? '1 Eintrag wartet im Brain-Dump' : `${s.inbox.length} Einträge warten im Brain-Dump`, icon('chevron')));
    }

    // Deine 3 für heute
    const doneCount = picks.filter(isChecked).length;
    root.append(h('h2', {}, picks.length ? `Deine 3 für heute · ${doneCount} von ${picks.length}` : 'Deine 3 für heute'));
    if (picks.length) {
      root.append(h('div', { class: 'group' }, picks.map((task) => taskRow(ctx, task, { onSwap: () => pickSheet(ctx, task.id) }))));
    }
    const morePossible = s.tasks.some((x) => isOpenToday(x) && !picks.includes(x));
    if (picks.length < 3 && morePossible) {
      root.append(h('button', { class: 'btn ghost compact add-pick', type: 'button', onclick: () => pickSheet(ctx, null) }, icon('plus'), 'Aufgabe für heute wählen'));
    } else if (!picks.length) {
      root.append(h('p', { class: 'empty' }, 'Nichts fällig. Genieß den Tag.'));
    }

    // Nächste 7 Tage (inkl. Überfälligem, das nicht in die 3 gepasst hat)
    const week = s.tasks
      .filter((x) => isOpenToday(x) && x.date && x.date <= until && !picks.includes(x))
      .filter((x) => !(x.repeat === 'daily' && x.date > t))
      .sort(byDate);
    if (week.length) {
      root.append(h('h2', {}, 'Nächste 7 Tage'), h('div', { class: 'group' }, week.map((task) => taskRow(ctx, task))));
    }

    const openCount = s.tasks.filter((x) => !x.done).length;
    root.append(h('a', { class: 'btn ghost compact all-tasks', href: '#aufgaben' }, `Alle Aufgaben (${openCount})`, icon('chevron')));

    // Schnellzugriff
    root.append(
      h('div', { class: 'section-head' },
        h('h2', {}, 'Schnellzugriff'),
        h('button', { class: 'link-btn', type: 'button', onclick: () => tilesEditor(ctx) }, 'Bearbeiten')),
      s.tiles.length
        ? h('div', { class: 'tiles' }, s.tiles.map(tileLink))
        : h('button', { class: 'btn ghost', type: 'button', onclick: () => addTileSheet(ctx) }, icon('plus'), 'Kachel hinzufügen'),
    );
  },

  settings(ctx) {
    const s = ctx.store.get();
    return h('section', {},
      h('h2', {}, 'Suchmaschine'),
      choice(Object.entries(ENGINES).map(([value, e]) => ({ value, label: e.name })), s.settings.searchEngine, (v) => {
        ctx.store.update((st) => { st.settings.searchEngine = v; });
        toast('Gespeichert');
      }),
    );
  },
};
