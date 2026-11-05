// Kleine Bausteine für die Oberfläche: Elemente, Icons, Fenster von unten, Meldungen.

// h('button', { class: 'btn', onclick: fn }, 'Text') baut ein Element.
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value') value = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  if (value !== undefined) el.value = value;
  return el;
}

const PATHS = {
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  pen: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
  list: 'M10 6.5h10M10 12h10M10 17.5h10M3.5 6.5l1.5 1.5 2.5-2.5M3.5 12l1.5 1.5L7.5 11M3.5 17.5l1.5 1.5 2.5-2.5',
  sliders: 'M4 7h9M17 7h3M15 4.5v5M4 17h3M11 17h9M9 14.5v5',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  out: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  check: 'M6 12.5l4 4L18 8',
  swap: 'M7 4L3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
};

export function icon(name) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  const attrs = {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', PATHS[name] || '');
  svg.append(path);
  return svg;
}

// Auswahl aus mehreren Chips, genau einer ist aktiv.
export function choice(options, selected, onChange) {
  const wrap = h('div', { class: 'chips', role: 'group' });
  const btns = options.map((o) => {
    const b = h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(o.value === selected),
      onclick: () => { wrap.select(o.value); onChange(o.value); },
    }, o.label);
    b._value = o.value;
    return b;
  });
  wrap.append(...btns);
  wrap.select = (v) => btns.forEach((b) => b.setAttribute('aria-pressed', String(b._value === v)));
  return wrap;
}

export function field(label, ...content) {
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label), ...content);
}

// Fenster, das von unten hereinfährt (gut mit dem Daumen erreichbar).
export function sheet(title, ...content) {
  document.querySelector('.toast')?.remove();
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'handle' }), h('h3', {}, title), ...content);
  const overlay = h('div', { class: 'overlay' }, panel);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    if (!document.querySelector('.overlay')) document.documentElement.classList.remove('locked');
  }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.documentElement.classList.add('locked');
  document.body.append(overlay);
  return { close, panel };
}

// Kurze Meldung unten, optional mit „Rückgängig“.
let toastTimer;
export function toast(message, { action, onAction, ms = 4000 } = {}) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = h('div', { class: 'toast', role: 'status' }, h('span', {}, message),
    action && h('button', { type: 'button', onclick: () => { el.remove(); onAction(); } }, action));
  document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), ms);
}
