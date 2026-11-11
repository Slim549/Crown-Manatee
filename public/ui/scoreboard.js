import { CROWN, buildingSrc } from '../assets.js';
import { esc } from './util.js';

export function FinalScoreboard(state, { host = false } = {}) {
  const results = state.results;
  const byId = Object.fromEntries(state.players.map((player) => [player.id, player]));
  const names = results.overall.map((id) => byId[id]?.name).filter(Boolean);
  const headline = !results.overall.length
    ? 'No correct answers recorded'
    : results.overallTie
      ? 'Tie — ' + names.join(' and ')
      : names.join(' and ');

  const buildings = results.nodes.map((row) => {
    const node = state.nodes.find((item) => item.id === row.id);
    let outcome = 'No correct answers';
    if (row.unclaimed) outcome = 'Unclaimed — no eligible player';
    else if (row.winners.length) {
      const who = row.winners.map((id) => byId[id]?.name || 'Player').join(' and ');
      outcome = (row.tie ? 'Tie — ' : '') + who;
    }
    return `<li>
      <img src="${buildingSrc(row.id)}" alt="">
      <div>
        <p class="score-node">${node.number}. ${esc(node.name)}</p>
        <p class="score-outcome">${esc(outcome)}</p>
      </div>
      ${row.winners.length ? `<img class="score-crown" src="${CROWN}" alt="">` : ''}
    </li>`;
  }).join('');

  const rows = results.rows.map((row) => {
    const tied = results.rows.filter((item) => item.rank === row.rank).length > 1;
    return `<tr>
      <td>${row.rank}${tied ? ' · tie' : ''}</td>
      <td>${esc(row.name)}</td>
      <td>${row.correct}</td>
      <td>${row.asked}</td>
      <td>${row.accuracy}%</td>
      <td>${row.points}</td>
    </tr>`;
  }).join('');

  return `<section class="score" aria-label="Final scoreboard">
    <p class="kicker">Final results</p>
    <h1>${esc(headline)}</h1>
    ${results.overall.length ? `<img class="score-crown score-crown-lg" src="${CROWN}" alt="">` : ''}
    <p class="score-note">${!results.overall.length ? 'Nobody recorded a correct answer, so there is no overall winner.' : results.overallTie ? 'Overall placement is shared. No tie was broken.' : 'Overall placement is the most correct answers, then points.'}</p>
    <h2>Building results</h2>
    <ul class="score-buildings">${buildings}</ul>
    <h2>Players</h2>
    <div class="table-wrap">
      <table>
        <caption class="sr">Correct answers, questions faced, and accuracy</caption>
        <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Correct</th><th scope="col">Asked</th><th scope="col">Accuracy</th><th scope="col">Points</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${host ? '<div class="score-actions"><button type="button" class="btn primary" data-act="reset">Return to lobby</button></div>' : ''}
  </section>`;
}
