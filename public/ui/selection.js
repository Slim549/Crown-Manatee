import { buildingSrc } from '../assets.js';
import { esc } from './util.js';

export function FamiliaritySelection({ nodes, picks, required, saved }) {
  const items = nodes.map((node) => {
    const on = picks.has(node.id);
    return `<li>
      <button type="button" class="area" data-id="${node.id}" aria-pressed="${on}">
        <img src="${buildingSrc(node.id)}" alt="">
        <span class="area-num">${String(node.number).padStart(2, '0')}</span>
        <span class="area-copy">
          <span class="area-name">${esc(node.name)}</span>
          <span class="area-focus">${esc(node.focus)}</span>
        </span>
      </button>
    </li>`;
  }).join('');

  return `<main class="sheet">
    <section class="sheet-card">
      <header class="sheet-head">
        <p class="kicker">Before the board opens</p>
        <h1>Which three areas of local government are you most familiar with?</h1>
        <p>Your three choices are the buildings you can compete for. This is about familiarity, not a claim that you already know the answers. You can change them until the host locks selection.</p>
        <p class="pick-count" aria-live="polite"><strong>${picks.size}</strong> of ${required} selected</p>
      </header>
      <ul class="areas" role="group" aria-label="Government areas">${items}</ul>
      <footer class="sheet-foot">
        <button type="button" class="btn primary" id="confirm-picks" ${picks.size === required ? '' : 'disabled'}>${saved ? 'Update choices' : 'Confirm three areas'}</button>
      </footer>
    </section>
  </main>`;
}
