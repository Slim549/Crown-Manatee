import { esc } from './util.js';

const PHASE = {
  lobby: 'Lobby',
  select: 'Choosing areas',
  locked: 'Selections locked',
  question: 'Question open',
  reveal: 'Answer revealed',
  final: 'Final results',
};

export function HostControls(state, { confirming = null } = {}) {
  const phase = state.phase;
  const node = state.nodes.find((item) => item.id === state.activeNode);
  const connected = state.players.filter((player) => player.connected).length;
  const settings = state.settings;
  const needsPlayers = phase === 'lobby' && connected < state.minPlayers;

  let actions = '';
  if (confirming) {
    const copy = confirming === 'end'
      ? 'End the game and show results now?'
      : 'Clear this game and return everyone to the lobby?';
    actions = `<div class="confirm" role="alertdialog" aria-label="Confirm">
      <p>${copy}</p>
      <div class="row">
        <button type="button" class="btn ${confirming === 'reset' || confirming === 'end' ? 'danger' : 'primary'}" data-confirm="${confirming}">Confirm</button>
        <button type="button" class="btn btn-quiet" data-confirm="cancel">Cancel</button>
      </div>
    </div>`;
  } else {
    const bits = [];
    if (phase === 'lobby') bits.push(`<button type="button" class="btn primary" data-act="openSelection" ${needsPlayers ? 'disabled' : ''}>Open area selection</button>`);
    if (phase === 'select') bits.push('<button type="button" class="btn primary" data-act="lock">Lock selections</button>');
    if (phase === 'locked') bits.push('<button type="button" class="btn primary" data-act="start">Start game</button>');
    if (phase === 'question') {
      bits.push(`<button type="button" class="btn" data-act="${state.paused ? 'resume' : 'pause'}">${state.paused ? 'Resume' : 'Pause'}</button>`);
      bits.push('<button type="button" class="btn" data-act="next">Close question</button>');
    }
    if (phase === 'reveal') bits.push('<button type="button" class="btn primary" data-act="next">Next question</button>');
    if (!['lobby', 'final'].includes(phase)) bits.push('<button type="button" class="btn danger" data-act="end">End game</button>');
    bits.push('<button type="button" class="btn btn-quiet" data-act="reset">Reset to lobby</button>');
    actions = `<div class="row">${bits.join('')}</div>`;
  }

  const players = state.players.map((player) => {
    const areas = (player.nodes || []).map((id) => state.nodes.find((node) => node.id === id)?.name).filter(Boolean);
    return `<li class="plist">
      <span><i class="presence ${player.connected ? 'is-on' : ''}"></i>${esc(player.name)}</span>
      <span class="plist-meta">${['question', 'reveal', 'final'].includes(phase) ? player.correct + ' correct' : esc(player.status || (player.picked ? 'Ready' : 'Joining'))}</span>
      ${areas.length && ['select', 'locked'].includes(phase) ? `<span class="plist-areas">${areas.map(esc).join(' · ')}</span>` : ''}
    </li>`;
  }).join('');

  const live = phase === 'question' || phase === 'reveal';
  const fields = [
    ['timerSeconds', 'Timer seconds', settings.timerSeconds],
    ['questionsPerPlayerPerNode', 'Questions per building', settings.questionsPerPlayerPerNode],
    ['pointsPerCorrect', 'Points per correct', settings.pointsPerCorrect],
  ].map(([key, label, value]) => `<label>${label}<input type="number" min="1" data-set="${key}" value="${value}" ${live ? 'disabled' : ''}></label>`).join('');

  return `<div class="side-scroll">
    <p class="kicker">Host</p>
    <h2>Session controls</h2>
    <p class="side-code"><span>Code</span> <strong>${esc(state.code)}</strong></p>
    <p class="side-meta">${esc(PHASE[phase] || phase)}${node ? ` · ${node.number}. ${esc(node.name)}` : ''}${phase === 'question' || phase === 'reveal' ? ` · ${state.qIdx + 1} of ${state.qTotal}` : ''}${state.paused ? ' · Paused' : ''}</p>
    ${actions}
    ${needsPlayers ? `<p class="side-note">At least ${state.minPlayers} connected players are required.</p>` : ''}
    <h3>Players</h3>
    <ul class="plist-wrap">${players || '<li class="side-note">No one has joined.</li>'}</ul>
    <h3>Rules for the next game</h3>
    <div class="settings">${fields}
      <label class="check"><input type="checkbox" data-set="speedBonus" ${settings.speedBonus ? 'checked' : ''} ${live ? 'disabled' : ''}> Speed bonus</label>
      <label class="check"><input type="checkbox" data-set="revealCorrect" ${settings.revealCorrect ? 'checked' : ''} ${live ? 'disabled' : ''}> Reveal the correct answer</label>
    </div>
    <p class="side-note">${live ? 'Rule changes apply between games. ' : ''}Ties stay shared. The server scores every answer.</p>
  </div>`;
}
