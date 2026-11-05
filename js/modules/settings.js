// Einstellungen: sammelt die Abschnitte der anderen Module, dazu Bereiche und Datensicherung.
import { h, icon, sheet, toast, field } from '../ui.js';
import * as D from '../dates.js';

function areaSheet(ctx, existing) {
  const input = h('input', { value: existing || '', placeholder: 'z. B. Gesundheit', 'aria-label': 'Name des Bereichs', autocapitalize: 'words' });
  const save = () => {
    const name = input.value.trim();
    const areas = ctx.store.get().settings.areas;
    if (!name) return input.focus();
    if (name !== existing && areas.includes(name)) return toast('Diesen Bereich gibt es schon');
    ctx.store.update((st) => {
      if (!existing) {
        st.settings.areas.push(name);
        return;
      }
      // Umbenennen: auch alle Aufgaben und Stichwörter mitnehmen
      st.settings.areas = st.settings.areas.map((a) => (a === existing ? name : a));
      st.tasks.forEach((t) => { if (t.area === existing) t.area = name; });
      st.settings.keywords.forEach((k) => { if (k.area === existing) k.area = name; });
      if (st.settings.lastArea === existing) st.settings.lastArea = name;
    });
    ui.close();
    ctx.refresh();
    toast('Gespeichert');
  };

  const remove = () => {
    const s = ctx.store.get();
    if (s.settings.areas.length <= 1) return toast('Mindestens ein Bereich muss bleiben');
    const fallback = s.settings.areas.find((a) => a !== existing);
    const count = s.tasks.filter((t) => t.area === existing && !t.done).length;
    if (count && !confirm(`${count} Aufgabe(n) wandern nach „${fallback}“. Bereich trotzdem entfernen?`)) return;
    ctx.store.update((st) => {
      st.settings.areas = st.settings.areas.filter((a) => a !== existing);
      st.tasks.forEach((t) => { if (t.area === existing) t.area = fallback; });
      st.settings.keywords.forEach((k) => { if (k.area === existing) k.area = fallback; });
      if (st.settings.lastArea === existing) st.settings.lastArea = fallback;
    });
    ui.close();
    ctx.refresh();
    toast('Bereich entfernt');
  };

  const ui = sheet(existing ? 'Bereich bearbeiten' : 'Neuer Bereich',
    field('Name', input),
    h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Speichern'),
    existing && h('div', { class: 'gap' }),
    existing && h('button', { class: 'btn ghost danger', type: 'button', onclick: remove }, 'Bereich entfernen'),
  );
}

async function backup(ctx) {
  const name = `zentrale-sicherung-${D.today()}.json`;
  const file = new File([ctx.store.exportJSON()], name, { type: 'application/json' });
  // Auf dem iPhone: Teilen-Menü → „In Dateien sichern“
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function restoreFrom(ctx, input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  file.text().then((text) => {
    if (!confirm('Alle aktuellen Daten werden durch die Sicherung ersetzt. Fortfahren?')) return;
    ctx.store.importJSON(text);
    ctx.refresh();
    toast('Sicherung wiederhergestellt');
  }).catch((e) => alert('Wiederherstellen hat nicht geklappt: ' + e.message));
}

export default {
  id: 'einstellungen',
  title: 'Einstellungen',
  icon: 'sliders',

  render(root, ctx) {
    const s = ctx.store.get();
    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: () => restoreFrom(ctx, fileInput) });

    root.append(
      h('h1', {}, 'Einstellungen'),
      ...ctx.modules.filter((m) => m.settings && m.id !== 'einstellungen').map((m) => m.settings(ctx)),

      h('h2', {}, 'Bereiche für Aufgaben'),
      h('div', { class: 'group' },
        s.settings.areas.map((a) => h('button', { class: 'row-btn', type: 'button', onclick: () => areaSheet(ctx, a) },
          h('span', {}, a),
          h('span', { class: 'meta' }, String(s.tasks.filter((t) => t.area === a && !t.done).length)),
          icon('chevron'))),
        h('button', { class: 'row-btn', type: 'button', onclick: () => areaSheet(ctx, null) }, icon('plus'), 'Bereich hinzufügen'),
      ),

      h('h2', {}, 'Deine Daten'),
      h('p', { class: 'sub' }, 'Alles liegt nur auf diesem iPhone. Sichere ab und zu, z. B. in die Dateien-App.'),
      h('div', { class: 'stack' },
        h('button', { class: 'btn', type: 'button', onclick: () => backup(ctx) }, 'Sichern'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => fileInput.click() }, 'Wiederherstellen'),
      ),
      fileInput,
      h('p', { class: 'hint' }, 'Version 1 · Die App baut keine Verbindung zu fremden Servern auf.'),
    );
  },
};
