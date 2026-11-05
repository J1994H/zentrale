// Listen: To-do, Packliste, Einkauf, Essensplan. Mit Vorlagen und „Alle Haken zurücksetzen“.
import { h, icon, sheet, toast, choice, field } from '../ui.js';
import { uid } from '../store.js';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const KINDS = [
  { value: 'todo', label: 'Liste' },
  { value: 'meals', label: 'Essensplan' },
];

// „Socken, Zahnbürste“ → zwei Einträge
const splitItems = (text) => text.split(',').map((t) => t.trim()).filter(Boolean);
const todayIndex = () => (new Date().getDay() + 6) % 7; // Montag = 0

function undoToast(ctx, msg, snap) {
  toast(msg, { action: 'Rückgängig', onAction: () => { ctx.store.restore(snap); ctx.refresh(); } });
}

function createList(st, { name, kind = 'todo', template = null }) {
  const list = {
    id: uid(),
    name,
    kind,
    items: (template?.items || []).map((text) => ({ id: uid(), text, checked: false })),
  };
  if (kind === 'meals') list.days = template?.days ? [...template.days] : Array(7).fill('');
  st.lists.push(list);
  return list;
}

function summary(l) {
  if (l.kind === 'meals') {
    const planned = l.days.filter((d) => d.trim()).length;
    return `${planned} von 7 Tagen`;
  }
  if (!l.items.length) return 'leer';
  const open = l.items.filter((i) => !i.checked).length;
  return open ? `${open} offen` : 'alles erledigt';
}

// ---------- Fenster ----------

function newListSheet(ctx) {
  const s = ctx.store.get();
  let kind = 'todo';
  let template = null;
  const name = h('input', { placeholder: 'z. B. Packliste Urlaub', 'aria-label': 'Name der Liste', autocapitalize: 'words' });
  const kindChoice = choice(KINDS, kind, (v) => { kind = v; });

  const create = () => {
    const n = name.value.trim() || template?.name;
    if (!n) return name.focus();
    let list;
    ctx.store.update((st) => { list = createList(st, { name: n, kind: template?.kind || kind, template }); });
    ui.close();
    ctx.go('listen/' + list.id);
  };

  const ui = sheet('Neue Liste',
    s.templates.length > 0 && field('Aus Vorlage (optional)', choice(
      [{ value: null, label: 'Ohne' }, ...s.templates.map((t) => ({ value: t.id, label: t.name }))],
      null,
      (v) => {
        template = s.templates.find((t) => t.id === v) || null;
        if (template) { name.value = template.name; kindChoice.select(template.kind); kind = template.kind; }
      })),
    field('Name', name),
    field('Art', kindChoice),
    h('button', { class: 'btn primary', type: 'button', onclick: create }, 'Liste anlegen'),
  );
}

function templateSheet(ctx, t) {
  const count = t.kind === 'meals' ? `${t.days.filter((d) => d.trim()).length} Tage geplant` : `${t.items.length} Einträge`;
  const ui = sheet(t.name,
    h('p', { class: 'sub' }, `Vorlage · ${count}`),
    t.items.length > 0 && h('ul', { class: 'entries' }, t.items.slice(0, 8).map((x) => h('li', {}, x)), t.items.length > 8 && h('li', {}, '…')),
    h('button', {
      class: 'btn primary', type: 'button',
      onclick: () => {
        let list;
        ctx.store.update((st) => { list = createList(st, { name: t.name, kind: t.kind, template: t }); });
        ui.close();
        ctx.go('listen/' + list.id);
      },
    }, 'Liste daraus erstellen'),
    h('div', { class: 'gap' }),
    h('button', {
      class: 'btn ghost danger', type: 'button',
      onclick: () => {
        const snap = ctx.store.snapshot();
        ctx.store.update((st) => { st.templates = st.templates.filter((x) => x.id !== t.id); });
        ui.close();
        ctx.refresh();
        undoToast(ctx, 'Vorlage gelöscht', snap);
      },
    }, 'Vorlage löschen'),
  );
}

function saveTemplateSheet(ctx, list) {
  const name = h('input', { value: list.name, 'aria-label': 'Name der Vorlage', autocapitalize: 'words' });
  const save = () => {
    const n = name.value.trim();
    if (!n) return name.focus();
    let replaced = false;
    ctx.store.update((st) => {
      const l = st.lists.find((x) => x.id === list.id);
      const tpl = { id: uid(), name: n, kind: l.kind, items: l.items.map((i) => i.text) };
      if (l.kind === 'meals') tpl.days = [...l.days];
      const i = st.templates.findIndex((x) => x.name.toLowerCase() === n.toLowerCase());
      replaced = i >= 0;
      if (replaced) st.templates[i] = { ...tpl, id: st.templates[i].id };
      else st.templates.push(tpl);
    });
    ui.close();
    toast(replaced ? `Vorlage „${n}“ aktualisiert` : `Als Vorlage „${n}“ gespeichert`);
  };
  const ui = sheet('Als Vorlage speichern',
    field('Name der Vorlage', name),
    h('p', { class: 'hint' }, 'Gespeichert werden alle Einträge, ohne Haken. Gibt es den Namen schon, wird die Vorlage ersetzt.'),
    h('div', { class: 'gap' }),
    h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Speichern'),
  );
}

function renameSheet(ctx, list) {
  const name = h('input', { value: list.name, 'aria-label': 'Name der Liste', autocapitalize: 'words' });
  const ui = sheet('Umbenennen', field('Name', name),
    h('button', {
      class: 'btn primary', type: 'button',
      onclick: () => {
        const n = name.value.trim();
        if (!n) return name.focus();
        ctx.store.update((st) => { st.lists.find((x) => x.id === list.id).name = n; });
        ui.close();
        ctx.refresh();
      },
    }, 'Speichern'));
}

function moreSheet(ctx, list) {
  const update = (fn, msg) => {
    const snap = ctx.store.snapshot();
    ctx.store.update((st) => fn(st.lists.find((x) => x.id === list.id), st));
    ui.close();
    ctx.refresh();
    undoToast(ctx, msg, snap);
  };
  const row = (label, onclick, cls = '') => h('button', { class: 'row-btn ' + cls, type: 'button', onclick }, label);
  const ui = sheet(list.name,
    h('div', { class: 'group' },
      row('Als Vorlage speichern', () => { ui.close(); saveTemplateSheet(ctx, list); }),
      list.kind === 'meals' && row('Woche leeren', () => update((l) => { l.days = Array(7).fill(''); }, 'Woche geleert')),
      list.items.some((i) => i.checked) && row('Erledigte entfernen', () => update((l) => { l.items = l.items.filter((i) => !i.checked); }, 'Erledigte entfernt')),
      row('Umbenennen', () => { ui.close(); renameSheet(ctx, list); }),
    ),
    h('div', { class: 'gap' }),
    h('button', {
      class: 'btn ghost danger', type: 'button',
      onclick: () => {
        const snap = ctx.store.snapshot();
        ctx.store.update((st) => { st.lists = st.lists.filter((x) => x.id !== list.id); });
        ui.close();
        ctx.go('listen');
        undoToast(ctx, `„${list.name}“ gelöscht`, snap);
      },
    }, 'Liste löschen'),
  );
}

function itemSheet(ctx, list, item) {
  const text = h('input', { value: item.text, 'aria-label': 'Eintrag', autocapitalize: 'sentences' });
  const ui = sheet('Eintrag bearbeiten', field('Text', text),
    h('button', {
      class: 'btn primary', type: 'button',
      onclick: () => {
        const t = text.value.trim();
        if (!t) return text.focus();
        ctx.store.update((st) => { st.lists.find((l) => l.id === list.id).items.find((i) => i.id === item.id).text = t; });
        ui.close();
        ctx.refresh();
      },
    }, 'Speichern'),
    h('div', { class: 'gap' }),
    h('button', {
      class: 'btn ghost danger', type: 'button',
      onclick: () => {
        const snap = ctx.store.snapshot();
        ctx.store.update((st) => {
          const l = st.lists.find((x) => x.id === list.id);
          l.items = l.items.filter((i) => i.id !== item.id);
        });
        ui.close();
        ctx.refresh();
        undoToast(ctx, 'Eintrag gelöscht', snap);
      },
    }, 'Eintrag löschen'),
  );
}

// ---------- Ansichten ----------

function itemRow(ctx, list, item) {
  return h('div', { class: 'task' + (item.checked ? ' done' : '') },
    h('button', {
      class: 'check', type: 'button', 'aria-pressed': String(item.checked),
      'aria-label': (item.checked ? 'Haken entfernen: ' : 'Abhaken: ') + item.text,
      onclick: () => {
        ctx.store.update((st) => {
          const i = st.lists.find((l) => l.id === list.id).items.find((x) => x.id === item.id);
          i.checked = !i.checked;
        });
        ctx.refresh();
      },
    }, icon('check')),
    h('button', { class: 'task-body', type: 'button', onclick: () => itemSheet(ctx, list, item) },
      h('span', { class: 'task-text' }, item.text)),
  );
}

function renderOverview(root, ctx) {
  const s = ctx.store.get();
  root.append(
    h('h1', {}, 'Listen'),
    s.lists.length
      ? h('div', { class: 'group' }, s.lists.map((l) =>
        h('a', { class: 'row-btn', href: '#listen/' + encodeURIComponent(l.id) },
          h('span', {}, l.name), h('span', { class: 'meta' }, summary(l)), icon('chevron'))))
      : h('p', { class: 'empty' }, 'Noch keine Listen.'),
    h('div', { class: 'gap' }),
    h('button', { class: 'btn', type: 'button', onclick: () => newListSheet(ctx) }, icon('plus'), 'Neue Liste'),
    h('h2', {}, 'Vorlagen'),
  );
  if (s.templates.length) {
    root.append(h('div', { class: 'group' }, s.templates.map((t) =>
      h('button', { class: 'row-btn', type: 'button', onclick: () => templateSheet(ctx, t) },
        h('span', {}, t.name), h('span', { class: 'meta' }, t.kind === 'meals' ? 'Essensplan' : `${t.items.length} Einträge`), icon('chevron')))));
  } else {
    root.append(h('p', { class: 'hint' }, 'Öffne eine Liste und speichere sie über „Mehr“ als Vorlage, z. B. „Packliste Wochenendausflug“.'));
  }
}

function renderList(root, ctx, list) {
  const addInput = h('input', {
    placeholder: list.kind === 'meals' ? 'Essensidee hinzufügen …' : 'Hinzufügen …',
    'aria-label': 'Neuer Eintrag', autocapitalize: 'sentences', enterkeyhint: 'enter',
  });
  const add = () => {
    const parts = splitItems(addInput.value);
    if (!parts.length) return addInput.focus();
    ctx.store.update((st) => {
      st.lists.find((l) => l.id === list.id).items.push(...parts.map((text) => ({ id: uid(), text, checked: false })));
    });
    ctx.refresh();
    // Tastatur offen lassen, damit du direkt weitertippen kannst
    document.querySelector('.add-item input')?.focus();
  };
  addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

  root.append(
    h('a', { class: 'back', href: '#listen' }, icon('back'), 'Listen'),
    h('h1', {}, list.name),
  );

  if (list.kind === 'meals') {
    const today = todayIndex();
    root.append(h('p', { class: 'sub' }, 'Diese Woche'), h('div', { class: 'group' }, DAYS.map((d, i) => {
      const input = h('input', {
        value: list.days[i], placeholder: '–', 'aria-label': `Essen am ${DAY_NAMES[i]}`, autocapitalize: 'sentences',
        onchange: () => ctx.store.update((st) => { st.lists.find((l) => l.id === list.id).days[i] = input.value.trim(); }),
      });
      return h('label', { class: 'day-row' + (i === today ? ' today' : '') }, h('span', {}, d), input);
    })), h('h2', {}, 'Ideen'));
  }

  // Reihenfolge bleibt beim Abhaken gleich, damit nichts unter dem Daumen wegrutscht.
  const done = list.items.filter((i) => i.checked);
  if (list.items.length) {
    root.append(h('div', { class: 'group' }, list.items.map((item) => itemRow(ctx, list, item))));
  } else if (list.kind !== 'meals') {
    root.append(h('p', { class: 'empty' }, 'Noch leer.'));
  }

  root.append(h('div', { class: 'add-item' }, addInput,
    h('button', { class: 'btn primary icon-btn', type: 'button', 'aria-label': 'Hinzufügen', onclick: add }, icon('plus'))));

  root.append(h('div', { class: 'gap' }), h('div', { class: 'actions' },
    done.length > 0 && h('button', {
      class: 'btn', type: 'button',
      onclick: () => {
        const snap = ctx.store.snapshot();
        ctx.store.update((st) => { st.lists.find((l) => l.id === list.id).items.forEach((i) => { i.checked = false; }); });
        ctx.refresh();
        undoToast(ctx, 'Alle Haken zurückgesetzt', snap);
      },
    }, 'Alle zurücksetzen'),
    h('button', { class: 'btn ghost', type: 'button', onclick: () => moreSheet(ctx, list) }, 'Mehr …'),
  ));
}

export default {
  id: 'listen',
  title: 'Listen',
  icon: 'list',

  render(root, ctx) {
    const list = ctx.param && ctx.store.get().lists.find((l) => l.id === ctx.param);
    if (list) renderList(root, ctx, list);
    else renderOverview(root, ctx);
  },
};
