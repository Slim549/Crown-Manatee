import { CROWN, buildingSrc } from '../assets.js';
import { esc } from './util.js';

export function FinalScoreboard(state, { host = false } = {}) {
  const results = state.results;
  const byId = Object.fromEntries(state.players.map((player) => [player.id, player]));
  const leaders = results.overall.map((id) => byId[id]).filter(Boolean);
  const best = leaders[0] ? results.rows.find((row) => row.id === leaders[0].id) : null;
  const leaderLine = !leaders.length
    ? 'No correct answers'
    : `${leaders.map((player) => player.name).join(', ')} · ${best ? best.correct : 0}`;

  const buildings = results.nodes.map((row) => {
    const node = state.nodes.find((item) => item.id === row.id);
    const who = row.winners.map((id) => byId[id]?.name).filter(Boolean);
    return `<li>
      <img src="${buildingSrc(row.id)}" alt="">
      <div>
        <p class="score-node">${esc(node.name)}</p>
        <p class="score-outcome">${esc(who.length ? who.join(', ') : 'No crown')}</p>
      </div>
      ${who.length ? `<img class="score-crown" src="${CROWN}" alt="">` : ''}
    </li>`;
  }).join('');

  const people = results.rows.map((row) => {
    const name = byId[row.id]?.name || row.name;
    return `<li><span>${esc(name)}</span><span>${row.correct}</span></li>`;
  }).join('');

  return `<section class="score" aria-label="Final results">
    <h1>Most correct</h1>
    <p class="score-winner">${esc(leaderLine)}</p>
    <h2>Crowns</h2>
    <ul class="score-buildings">${buildings}</ul>
    <h2>Everyone</h2>
    <ol class="score-people">${people}</ol>
    ${host ? '<div class="score-actions"><button type="button" class="btn primary" data-act="reset">Return to lobby</button></div>' : ''}
  </section>`;
}
