// Aufgaben: anlegen, abhaken, wiederholen, „3 für heute“. Wird von mehreren Bereichen benutzt.
import { uid } from './store.js';
import * as D from './dates.js';

export const REPEAT = {
  none: 'Nie',
  daily: 'Täglich',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
};

export function addTask(state, { text, area, date = null, repeat = 'none' }) {
  const task = { id: uid(), text, area, date, repeat, done: false, created: Date.now() };
  state.tasks.push(task);
  return task;
}

// Nächster Termin einer wiederkehrenden Aufgabe (immer nach heute).
export function nextDate(task, today = D.today()) {
  const start = task.date || today;
  if (task.repeat === 'daily') return D.addDays(start > today ? start : today, 1);
  // Monatlich/jährlich: mindestens einen Schritt weiter, und den ursprünglichen Tag behalten
  // (z. B. 31. → 30. Nov. → 31. Dez.).
  const step = task.repeat === 'yearly' ? 12 : 1;
  const anchor = task.anchorDay || D.parse(start).getDate();
  const withAnchor = (s) => {
    const d = D.parse(s);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(anchor, last));
    return D.iso(d);
  };
  let d = withAnchor(D.addMonths(start, step));
  while (d <= today) d = withAnchor(D.addMonths(d, step));
  return d;
}

export function completeTask(state, id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return null;
  if (t.repeat === 'none') {
    t.done = true;
    t.doneAt = Date.now();
  } else {
    t.prevDate = t.date;
    if (t.repeat !== 'daily' && t.date && !t.anchorDay) t.anchorDay = D.parse(t.date).getDate();
    t.lastDone = D.today();
    t.date = nextDate(t);
  }
  return t;
}

export function reopenTask(state, id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  if (t.done) {
    t.done = false;
    delete t.doneAt;
  } else if (t.lastDone === D.today()) {
    t.date = t.prevDate ?? t.date;
    delete t.lastDone;
    delete t.prevDate;
  }
}

export const isDoneToday = (t) => (t.done ? D.iso(new Date(t.doneAt)) === D.today() : t.lastDone === D.today());
export const isChecked = (t) => t.done || t.lastDone === D.today();

// Offen und heute noch nicht abgehakt
export const isOpenToday = (t) => !t.done && t.lastDone !== D.today();

export function byDate(a, b) {
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  return a.created - b.created;
}

// „3 für heute“: die App schlägt die dringendsten vor (überfällig, dann heute).
// Getauschte oder entfernte Aufgaben merkt sie sich für den Tag.
export function focusTasks(state) {
  const today = D.today();
  if (!state.focus || state.focus.date !== today) state.focus = { date: today, picks: [], skipped: [] };
  const f = state.focus;
  f.picks = f.picks.filter((id) => state.tasks.some((t) => t.id === id && (!t.done || isDoneToday(t))));
  if (f.picks.length < 3) {
    const candidates = state.tasks
      .filter((t) => isOpenToday(t) && t.date && t.date <= today && !f.picks.includes(t.id) && !f.skipped.includes(t.id))
      .sort(byDate);
    f.picks.push(...candidates.slice(0, 3 - f.picks.length).map((t) => t.id));
  }
  return f.picks.map((id) => state.tasks.find((t) => t.id === id));
}
