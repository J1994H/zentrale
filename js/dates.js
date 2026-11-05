// Datums-Helfer. Daten werden als Text „JJJJ-MM-TT“ gespeichert (Ortszeit).
const pad = (n) => String(n).padStart(2, '0');

export const iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso();

export function parse(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function addMonths(s, n) {
  const d = parse(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return iso(d);
}

export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 86400000);

// Freundliche Beschriftung: Heute, Morgen, Fr., 14. Nov.
export function label(s) {
  if (!s) return '';
  const diff = diffDays(s, today());
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  if (diff === -1) return 'Gestern';
  if (diff < 0) return `seit ${-diff} Tagen`;
  const d = parse(s);
  if (diff < 7) return d.toLocaleDateString('de-DE', { weekday: 'long' });
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}
