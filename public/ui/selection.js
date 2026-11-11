import { buildingSrc } from '../assets.js';
import { esc } from './util.js';

export function FamiliaritySelection({ nodes, picks, required, saved }) {
  const items = nodes.map((node) => {
    const on = picks.has(node.id);
    return `<li>
      <button type="button" class="area" data-id="${node.id}" aria-pressed="${on}">
        <img src="${buildingSrc(node.id)}" alt="">
        <span class="area-name">${esc(node.name)}</span>
      </button>
    </li>`;
  }).join('');

  return `<main class="sheet">
    <section class="sheet-card">
      <header class="sheet-head">
        <h1>Which three areas are you most familiar with?</h1>
        <p class="pick-count" aria-live="polite"><strong>${picks.size}</strong> of ${required}</p>
      </header>
      <ul class="areas" role="group" aria-label="Government areas">${items}</ul>
      <footer class="sheet-foot">
        <button type="button" class="btn primary" id="confirm-picks" ${picks.size === required ? '' : 'disabled'}>${saved ? 'Update choices' : 'Confirm three areas'}</button>
      </footer>
    </section>
  </main>`;
}
