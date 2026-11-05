// Brain-Dump: schnell alles eintippen, danach einsortieren.
import { h, icon, sheet, toast, choice, field } from '../ui.js';
import { uid } from '../store.js';
import { addTask } from '../tasks.js';
import { taskEditor } from '../taskui.js';
import * as D from '../dates.js';

const TYPES = { obsidian: 'Obsidian', list: 'Liste', task: 'Aufgabe' };

// „Pitch: Idee“ → { kw, text: 'Idee' }, sonst null
export function parseLine(line, keywords) {
  const m = line.match(/^\s*([^:\n]{1,40}?)\s*:\s*(.*)$/);
  if (!m || !m[2].trim()) return null;
  const word = m[1].toLowerCase();
  const kw = keywords.find((k) => k.word.trim().toLowerCase() === word);
  return kw ? { kw, text: m[2].trim() } : null;
}

// Legt eine Zeile ab. Ergebnis: 'auto' (einsortiert) oder 'inbox' (wartet auf dich).
export function fileLine(state, line) {
  const p = parseLine(line, state.settings.keywords);
  if (p && applyKeyword(state, p.kw, p.text)) return 'auto';
  state.inbox.push({ id: uid(), text: line, created: Date.now() });
  return 'inbox';
}

function applyKeyword(state, kw, text) {
  if (kw.type === 'obsidian' && kw.note) {
    state.outbox.push({ id: uid(), text, note: kw.note, created: Date.now() });
    return true;
  }
  if (kw.type === 'list') {
    const list = state.lists.find((l) => l.id === kw.list);
    if (!list) return false;
    // „Einkauf: Milch, Brot“ → zwei Einträge
    for (const part of text.split(',').map((t) => t.trim()).filter(Boolean)) {
      list.items.push({ id: uid(), text: part, checked: false });
    }
    return true;
  }
  if (kw.type === 'task') {
    const areas = state.settings.areas;
    addTask(state, { text, area: areas.includes(kw.area) ? kw.area : areas[0] });
    return true;
  }
  return false;
}

export function obsidianUrl(vault, note, entries) {
  const content = '\n' + entries.map((e) => '- ' + e.text).join('\n');
  const parts = [];
  if (vault) parts.push('vault=' + encodeURIComponent(vault));
  parts.push('file=' + encodeURIComponent(note), 'content=' + encodeURIComponent(content), 'append=true');
  return 'obsidian://new?' + parts.join('&');
}

function knownNotes(state) {
  const notes = [
    ...state.settings.keywords.filter((k) => k.type === 'obsidian').map((k) => k.note),
    ...state.outbox.map((e) => e.note),
    ...state.sent.map((e) => e.note),
  ].filter(Boolean);
  return [...new Set(notes)];
}

function removeFromInbox(st, id) {
  st.inbox = st.inbox.filter((x) => x.id !== id);
}

// ---------- Einsortieren: Fenster ----------

function taskSheet(ctx, item) {
  taskEditor(ctx, {
    title: 'Als Aufgabe',
    initial: { text: item.text },
    saveLabel: 'Als Aufgabe speichern',
    onSave: (v) => {
      ctx.store.update((st) => {
        addTask(st, v);
        st.settings.lastArea = v.area;
        removeFromInbox(st, item.id);
      });
      ctx.refresh();
      toast(`Aufgabe in „${v.area}“` + (v.date ? ` · ${D.label(v.date)}` : ''));
    },
  });
}

function listSheet(ctx, item) {
  const s = ctx.store.get();
  const ui = sheet('In welche Liste?',
    h('div', { class: 'group' }, s.lists.map((l) => h('button', {
      class: 'row-btn', type: 'button',
      onclick: () => {
        ctx.store.update((st) => {
          st.lists.find((x) => x.id === l.id).items.push({ id: uid(), text: item.text, checked: false });
          removeFromInbox(st, item.id);
        });
        ui.close();
        ctx.refresh();
        toast(`In „${l.name}“`);
      },
    }, l.name, h('span', { class: 'meta' }, String(l.items.filter((i) => !i.checked).length))))),
  );
}

function obsidianSheet(ctx, item) {
  const s = ctx.store.get();
  const choose = (note) => {
    ctx.store.update((st) => {
      st.outbox.push({ id: uid(), text: item.text, note, created: Date.now() });
      removeFromInbox(st, item.id);
    });
    ui.close();
    ctx.refresh();
    toast(`Bereit für „${note}“`);
  };
  const other = h('input', { placeholder: 'Andere Notiz, z. B. Reisen', 'aria-label': 'Name der Notiz' });
  const ui = sheet('In welche Notiz?',
    h('div', { class: 'group' }, knownNotes(s).map((n) =>
      h('button', { class: 'row-btn', type: 'button', onclick: () => choose(n) }, n))),
    h('div', { class: 'gap' }),
    field('Oder neue Notiz', other, h('div', { class: 'gap' }),
      h('button', { class: 'btn', type: 'button', onclick: () => { if (other.value.trim()) choose(other.value.trim()); else other.focus(); } }, 'In diese Notiz')),
  );
}

// ---------- Ansicht ----------

function insertKeyword(ta, word) {
  const v = ta.value;
  ta.value = v + (v && !v.endsWith('\n') ? '\n' : '') + word + ': ';
  ta.dispatchEvent(new Event('input'));
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

function inboxCard(ctx, item) {
  return h('div', { class: 'card' },
    h('p', { class: 'text' }, item.text),
    h('div', { class: 'actions' },
      h('button', { class: 'btn compact', type: 'button', onclick: () => taskSheet(ctx, item) }, 'Aufgabe'),
      h('button', { class: 'btn compact', type: 'button', onclick: () => listSheet(ctx, item) }, 'Liste'),
      h('button', { class: 'btn compact', type: 'button', onclick: () => obsidianSheet(ctx, item) }, 'Obsidian'),
      h('button', {
        class: 'btn compact icon-btn', type: 'button', 'aria-label': 'Löschen',
        onclick: () => {
          const snap = ctx.store.snapshot();
          ctx.store.update((st) => removeFromInbox(st, item.id));
          ctx.refresh();
          toast('Gelöscht', { action: 'Rückgängig', onAction: () => { ctx.store.restore(snap); ctx.refresh(); } });
        },
      }, icon('x')),
    ),
  );
}

function outboxSection(ctx, s) {
  const groups = new Map();
  for (const e of s.outbox) {
    if (!groups.has(e.note)) groups.set(e.note, []);
    groups.get(e.note).push(e);
  }
  const out = [h('h2', {}, 'Bereit für Obsidian')];
  for (const [note, entries] of groups) {
    const ids = new Set(entries.map((e) => e.id));
    out.push(h('div', { class: 'card' },
      h('p', { class: 'title' }, note),
      h('ul', { class: 'entries' }, entries.map((e) => h('li', {}, e.text))),
      h('a', {
        class: 'btn primary', href: obsidianUrl(s.settings.vault, note, entries),
        onclick: () => {
          // Kurz warten, damit sich Obsidian öffnet, dann als gesendet merken.
          setTimeout(() => {
            ctx.store.update((st) => {
              const moved = st.outbox.filter((e) => ids.has(e.id)).map((e) => ({ ...e, sentAt: Date.now() }));
              st.outbox = st.outbox.filter((e) => !ids.has(e.id));
              st.sent = [...moved, ...st.sent].slice(0, 50);
            });
            ctx.refresh();
          }, 600);
        },
      }, icon('out'), entries.length === 1 ? 'An Obsidian senden' : `${entries.length} an Obsidian senden`),
    ));
  }
  if (!s.settings.vault) {
    out.push(h('p', { class: 'hint' }, 'Tipp: Trag in den Einstellungen den Namen deines Obsidian-Vaults ein.'));
  }
  return out;
}

function sentSection(ctx, s) {
  return h('details', {},
    h('summary', {}, `Zuletzt an Obsidian gesendet (${s.sent.length})`),
    h('div', { class: 'group' }, s.sent.map((e) => h('button', {
      class: 'row-btn', type: 'button', 'aria-label': `Erneut bereitstellen: ${e.text}`,
      onclick: () => {
        ctx.store.update((st) => {
          st.sent = st.sent.filter((x) => x.id !== e.id);
          st.outbox.push({ id: e.id, text: e.text, note: e.note, created: e.created });
        });
        ctx.refresh();
        toast('Wieder bereit zum Senden');
      },
    }, h('span', {}, e.text), h('span', { class: 'meta' }, e.note), icon('undo')))),
    h('p', { class: 'hint' }, 'Nicht angekommen? Eintrag antippen, dann kannst du ihn erneut senden.'),
  );
}

export default {
  id: 'dump',
  title: 'Dump',
  icon: 'pen',
  badge: (s) => s.inbox.length,

  render(root, ctx) {
    const s = ctx.store.get();

    const ta = h('textarea', {
      rows: 6, value: s.dumpDraft, 'aria-label': 'Brain-Dump', autocapitalize: 'sentences',
      placeholder: 'Alles raus aus dem Kopf.\nEine Zeile = ein Eintrag.\n\nPitch: …   Einkauf: Milch, Brot',
    });
    let timer;
    ta.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => ctx.store.update((st) => { st.dumpDraft = ta.value; }), 300);
    });

    const submit = () => {
      const lines = ta.value.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) { ta.focus(); return; }
      clearTimeout(timer);
      const snap = ctx.store.snapshot();
      let auto = 0;
      let open = 0;
      ctx.store.update((st) => {
        for (const line of lines) fileLine(st, line) === 'auto' ? auto++ : open++;
        st.dumpDraft = '';
      });
      ta.blur();
      ctx.refresh();
      const parts = [];
      if (auto) parts.push(`${auto} einsortiert`);
      if (open) parts.push(`${open} offen`);
      toast(parts.join(' · '), { action: 'Rückgängig', onAction: () => { ctx.store.restore(snap); ctx.refresh(); } });
    };

    root.append(
      h('h1', {}, 'Brain-Dump'),
      h('p', { class: 'sub' }, 'Erst alles rein, sortieren kommt danach.'),
      ta,
      h('div', { class: 'chips scroll' }, s.settings.keywords.map((k) =>
        h('button', { class: 'chip', type: 'button', onclick: () => insertKeyword(ta, k.word) }, k.word + ':'))),
      h('button', { class: 'btn primary', type: 'button', onclick: submit }, 'Ablegen'),
    );

    if (s.inbox.length) {
      root.append(h('h2', {}, `Einsortieren · ${s.inbox.length}`), ...s.inbox.map((item) => inboxCard(ctx, item)));
    }
    if (s.outbox.length) root.append(...outboxSection(ctx, s));
    if (!s.inbox.length && !s.outbox.length) root.append(h('p', { class: 'empty' }, 'Alles einsortiert. Kopf frei.'));
    if (s.sent.length) root.append(sentSection(ctx, s));
  },

  // Abschnitt in den Einstellungen
  settings(ctx) {
    const s = ctx.store.get();
    const vault = h('input', {
      value: s.settings.vault, placeholder: 'z. B. Mein Vault', 'aria-label': 'Name des Obsidian-Vaults',
      autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
      onchange: () => { ctx.store.update((st) => { st.settings.vault = vault.value.trim(); }); toast('Gespeichert'); },
    });
    return h('section', {},
      h('h2', {}, 'Obsidian'),
      vault,
      h('p', { class: 'hint' }, 'Genau so geschrieben wie in Obsidian (Groß- und Kleinschreibung beachten).'),
      h('h2', {}, 'Stichwörter im Brain-Dump'),
      h('div', { class: 'group' },
        s.settings.keywords.map((k) => h('button', { class: 'row-btn', type: 'button', onclick: () => keywordSheet(ctx, k) },
          h('span', {}, k.word + ':'), h('span', { class: 'meta' }, describeKeyword(s, k)), icon('chevron'))),
        h('button', { class: 'row-btn', type: 'button', onclick: () => keywordSheet(ctx, null) }, icon('plus'), 'Stichwort hinzufügen'),
      ),
      h('p', { class: 'hint' }, 'Beginnt eine Zeile mit einem Stichwort und Doppelpunkt, sortiert die App sie automatisch ein.'),
    );
  },
};

function describeKeyword(s, k) {
  if (k.type === 'obsidian') return `Obsidian · ${k.note}`;
  if (k.type === 'list') return `Liste · ${s.lists.find((l) => l.id === k.list)?.name || '–'}`;
  return `Aufgabe · ${k.area}`;
}

function keywordSheet(ctx, existing) {
  const s = ctx.store.get();
  const draft = existing
    ? { ...existing }
    : { id: uid(), word: '', type: 'obsidian', note: '', list: s.lists[0]?.id, area: s.settings.areas[0] };

  const word = h('input', { value: draft.word, placeholder: 'z. B. Film', 'aria-label': 'Stichwort', autocapitalize: 'words' });
  const target = h('div', {});

  const renderTarget = () => {
    if (draft.type === 'obsidian') {
      const note = h('input', { value: draft.note || '', placeholder: 'z. B. Filme', 'aria-label': 'Notiz', oninput: () => { draft.note = note.value; } });
      target.replaceChildren(field('Name der Notiz in Obsidian', note));
    } else if (draft.type === 'list') {
      if (!s.lists.some((l) => l.id === draft.list)) draft.list = s.lists[0]?.id;
      target.replaceChildren(field('Liste', choice(s.lists.map((l) => ({ value: l.id, label: l.name })), draft.list, (v) => { draft.list = v; })));
    } else {
      if (!s.settings.areas.includes(draft.area)) draft.area = s.settings.areas[0];
      target.replaceChildren(field('Bereich', choice(s.settings.areas.map((a) => ({ value: a, label: a })), draft.area, (v) => { draft.area = v; })));
    }
  };
  renderTarget();

  const save = () => {
    draft.word = word.value.trim().replace(/:+$/, '');
    draft.note = (draft.note || '').trim();
    if (!draft.word || draft.word.includes(':')) { word.focus(); return toast('Bitte ein Stichwort ohne Doppelpunkt eingeben'); }
    const taken = s.settings.keywords.some((k) => k.id !== draft.id && k.word.toLowerCase() === draft.word.toLowerCase());
    if (taken) return toast('Dieses Stichwort gibt es schon');
    if (draft.type === 'obsidian' && !draft.note) return toast('Bitte eine Notiz angeben');
    const clean = { id: draft.id, word: draft.word, type: draft.type };
    if (draft.type === 'obsidian') clean.note = draft.note;
    if (draft.type === 'list') clean.list = draft.list;
    if (draft.type === 'task') clean.area = draft.area;
    ctx.store.update((st) => {
      const i = st.settings.keywords.findIndex((k) => k.id === clean.id);
      if (i >= 0) st.settings.keywords[i] = clean;
      else st.settings.keywords.push(clean);
    });
    ui.close();
    ctx.refresh();
    toast('Gespeichert');
  };

  const ui = sheet(existing ? 'Stichwort bearbeiten' : 'Neues Stichwort',
    field('Stichwort', word),
    field('Wohin?', choice(Object.entries(TYPES).map(([value, label]) => ({ value, label })), draft.type, (v) => { draft.type = v; renderTarget(); })),
    target,
    h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Speichern'),
    existing && h('div', { class: 'gap' }),
    existing && h('button', {
      class: 'btn ghost danger', type: 'button',
      onclick: () => {
        ctx.store.update((st) => { st.settings.keywords = st.settings.keywords.filter((k) => k.id !== existing.id); });
        ui.close();
        ctx.refresh();
        toast('Stichwort entfernt');
      },
    }, 'Stichwort entfernen'),
  );
}
