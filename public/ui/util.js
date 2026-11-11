export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('on'), 2800);
}

export async function post(act, data = {}) {
  try {
    const res = await fetch('/api/' + act, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(body.error || 'Something went wrong');
      return null;
    }
    return body;
  } catch {
    toast('Network problem. Try again.');
    return null;
  }
}

export function pct(value, total) {
  return (value / total) * 100 + '%';
}
