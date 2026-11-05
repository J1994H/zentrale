// Gemeinsame Bausteine für Aufgaben: Bearbeiten-Fenster und Aufgaben-Zeile.
import { h, icon, sheet, toast, choice, field } from './ui.js';
import * as D from './dates.js';
import { REPEAT, completeTask, reopenTask, isChecked } from './tasks.js';

export function taskEditor(ctx, { title, initial = {}, saveLabel = 'Speichern', onSave, onDelete }) {
  const s = ctx.store.get();
  const areas = s.settings.areas;
  let area = areas.includes(initial.area) ? initial.area
    : areas.includes(s.settings.lastArea) ? s.settings.lastArea : areas[0];
  let date = initial.date || null;
  let repeat = initial.repeat || 'none';
  const t = D.today();

  const presets = [
    { value: null, label: 'Ohne' },
    { value: t, label: 'Heute' },
    { value: D.addDays(t, 1), label: 'Morgen' },
    { value: D.addDays(t, 7), label: 'In 1 Woche' },
  ];
  const isPreset = presets.some((p) => p.value === date);

  const text = h('input', { value: initial.text || '', 'aria-label': 'Aufgabe', autocapitalize: 'sentences' });
  const dateInput = h('input', { type: 'date', 'aria-label': 'Eigenes Datum', value: isPreset ? undefined : date });
  const dates = choice(presets, isPreset ? date : Symbol('eigenes'), (v) => { date = v; dateInput.value = ''; });
  dateInput.addEventListener('change', () => {
    date = dateInput.value || null;
    dates.select(Symbol('eigenes'));
  });

  const save = () => {
    const values = { text: text.value.trim(), area, date: date || (repeat !== 'none' ? t : null), repeat };
    if (!values.text) return text.focus();
    ui.close();
    onSave(values);
  };

  const ui = sheet(title,
    field('Text', text),
    field('Bereich', choice(areas.map((a) => ({ value: a, label: a })), area, (v) => { area = v; })),
    field('Wann angehen?', dates, h('div', { class: 'gap' }), dateInput),
    field('Wiederholen',
      choice(Object.entries(REPEAT).map(([value, label]) => ({ value, label })), repeat, (v) => { repeat = v; }),
      h('p', { class: 'hint' }, 'Beim Abhaken springt das Datum automatisch zum nächsten Termin.')),
    h('button', { class: 'btn primary', type: 'button', onclick: save }, saveLabel),
    onDelete && h('div', { class: 'gap' }),
    onDelete && h('button', { class: 'btn ghost danger', type: 'button', onclick: () => { ui.close(); onDelete(); } }, 'Aufgabe löschen'),
  );
}

export function editTask(ctx, task) {
  taskEditor(ctx, {
    title: 'Aufgabe bearbeiten',
    initial: task,
    onSave: (v) => {
      ctx.store.update((st) => {
        const t = Object.assign(st.tasks.find((x) => x.id === task.id), v);
        delete t.anchorDay; // Datum wurde neu gesetzt → Tag neu merken
      });
      ctx.refresh();
      toast('Gespeichert');
    },
    onDelete: () => {
      const snap = ctx.store.snapshot();
      ctx.store.update((st) => { st.tasks = st.tasks.filter((x) => x.id !== task.id); });
      ctx.refresh();
      toast('Gelöscht', { action: 'Rückgängig', onAction: () => { ctx.store.restore(snap); ctx.refresh(); } });
    },
  });
}

function toggle(ctx, task) {
  if (isChecked(task)) {
    ctx.store.update((st) => reopenTask(st, task.id));
    ctx.refresh();
    return;
  }
  const snap = ctx.store.snapshot();
  let after;
  ctx.store.update((st) => { after = completeTask(st, task.id); });
  ctx.refresh();
  const msg = after && after.repeat !== 'none' ? `Erledigt · wieder ${D.label(after.date)}` : 'Erledigt';
  toast(msg, { action: 'Rückgängig', onAction: () => { ctx.store.restore(snap); ctx.refresh(); } });
}

export function taskMeta(task, { showArea = true } = {}) {
  const parts = [];
  if (showArea) parts.push(task.area);
  if (task.date) parts.push(D.label(task.date));
  if (task.repeat !== 'none') parts.push(REPEAT[task.repeat]);
  return parts.join(' · ');
}

export function taskRow(ctx, task, { onSwap, showArea = true } = {}) {
  const checked = isChecked(task);
  const overdue = !checked && task.date && task.date < D.today();
  return h('div', { class: 'task' + (checked ? ' done' : '') },
    h('button', {
      class: 'check', type: 'button', 'aria-pressed': String(checked),
      'aria-label': checked ? `Nicht erledigt: ${task.text}` : `Erledigt: ${task.text}`,
      onclick: () => toggle(ctx, task),
    }, icon('check')),
    h('button', { class: 'task-body', type: 'button', onclick: () => editTask(ctx, task) },
      h('span', { class: 'task-text' }, task.text),
      h('span', { class: 'task-meta' + (overdue ? ' overdue' : '') }, taskMeta(task, { showArea }))),
    onSwap && !checked && h('button', { class: 'swap', type: 'button', 'aria-label': `Tauschen: ${task.text}`, onclick: onSwap }, icon('swap')),
  );
}
