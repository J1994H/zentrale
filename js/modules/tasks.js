// Alle Aufgaben: erreichbar über „Alle Aufgaben“ auf dem Heute-Bildschirm (kein eigener Knopf unten).
import { h, icon, toast, choice } from '../ui.js';
import { addTask, byDate } from '../tasks.js';
import { taskRow, taskEditor } from '../taskui.js';
import * as D from '../dates.js';

let filter = 'Alle';

export default {
  id: 'aufgaben',
  title: 'Aufgaben',
  icon: 'list',
  tab: false,      // nicht in der unteren Leiste
  parent: 'heute', // „Heute“ bleibt unten markiert

  render(root, ctx) {
    const s = ctx.store.get();
    if (filter !== 'Alle' && !s.settings.areas.includes(filter)) filter = 'Alle';
    const match = (t) => filter === 'Alle' || t.area === filter;
    const open = s.tasks.filter((t) => !t.done && match(t));
    const dated = open.filter((t) => t.date).sort(byDate);
    const undated = open.filter((t) => !t.date).sort(byDate);
    const done = s.tasks.filter((t) => t.done && match(t)).sort((a, b) => b.doneAt - a.doneAt).slice(0, 30);
    const showArea = filter === 'Alle';

    const filterChips = choice(['Alle', ...s.settings.areas].map((a) => ({ value: a, label: a })), filter, (v) => { filter = v; ctx.refresh(); });
    filterChips.classList.add('scroll');

    root.append(
      h('a', { class: 'back', href: '#heute' }, icon('back'), 'Heute'),
      h('h1', {}, 'Alle Aufgaben'),
      filterChips,
    );

    if (dated.length) root.append(h('h2', {}, 'Mit Datum'), h('div', { class: 'group' }, dated.map((t) => taskRow(ctx, t, { showArea }))));
    if (undated.length) root.append(h('h2', {}, 'Ohne Datum'), h('div', { class: 'group' }, undated.map((t) => taskRow(ctx, t, { showArea }))));
    if (!open.length) root.append(h('p', { class: 'empty' }, 'Keine offenen Aufgaben.'));
    if (done.length) {
      root.append(h('details', {}, h('summary', {}, `Erledigt (${done.length})`),
        h('div', { class: 'group' }, done.map((t) => taskRow(ctx, t, { showArea })))));
    }

    root.append(h('div', { class: 'gap' }), h('button', {
      class: 'btn primary', type: 'button',
      onclick: () => taskEditor(ctx, {
        title: 'Neue Aufgabe',
        initial: { area: filter === 'Alle' ? undefined : filter },
        saveLabel: 'Aufgabe anlegen',
        onSave: (v) => {
          ctx.store.update((st) => { addTask(st, v); st.settings.lastArea = v.area; });
          ctx.refresh();
          toast(`Aufgabe in „${v.area}“` + (v.date ? ` · ${D.label(v.date)}` : ''));
        },
      }),
    }, icon('plus'), 'Neue Aufgabe'));
  },
};
