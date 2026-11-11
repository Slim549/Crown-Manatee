import { audio } from './audio.js';
import { esc, $, post, toast } from './ui/util.js';
import { FamiliaritySelection } from './ui/selection.js';
import { PlayerQuestion } from './ui/question.js';
import { FinalScoreboard } from './ui/scoreboard.js';
import { HostBoard } from './ui/board.js';
import { buildingSrc } from './assets.js';

const app = $('#app');
const route = location.pathname.startsWith('/host') ? 'host' : location.pathname.startsWith('/play') ? 'play' : 'home';
let META = null;
let S = null;
let offset = 0;
let es = null;
let prev = null;

function shell({ kicker = 'Manatee County Government Game', title, body = '', extra = '' }) {
  return `<main class="entry"><section class="entry-card"><p class="kicker">${kicker}</p><h1>${title}</h1>${body ? `<div class="wait-body">${body}</div>` : ''}${extra}</section></main>`;
}

function toastError(message) { toast(message); }

function left() {
  if (!S) return 0;
  if (S.paused) return Math.max(0, S.pausedLeft || 0);
  if (!S.deadline) return 0;
  return Math.max(0, S.deadline - (Date.now() + offset));
}

function sound(before, next) {
  const music = () => {
    if (next.phase === 'lobby' || next.phase === 'select' || next.phase === 'locked') audio.loop('introMusic');
    else if (next.phase === 'final') audio.stopLoop();
    else audio.loop('gameMusic');
  };
  if (!before) { music(); return; }
  if (before.activeNode !== next.activeNode && next.activeNode) audio.play('buildingActive');
  if (before.phase !== next.phase) {
    if (next.phase === 'reveal') audio.play('roundComplete');
    if (next.phase === 'final') audio.play('celebration');
    music();
  }
}

function connect(query, onState) {
  es?.close();
  es = new EventSource('/events?' + query);
  es.onmessage = (event) => {
    document.querySelector('.conn')?.remove();
    S = JSON.parse(event.data);
    S.nodes = META.nodes;
    offset = S.now - Date.now();
    sound(prev, S);
    prev = S;
    document.body.dataset.phase = S.phase;
    onState();
  };
  es.onerror = () => {
    if (!document.querySelector('.conn')) {
      document.body.insertAdjacentHTML('afterbegin', '<div class="conn" role="alert">Connection lost. Reconnecting…</div>');
    }
  };
}

setInterval(() => {
  if (!S) return;
  const on = S.phase === 'playing' && !!S.deadline;
  const sec = Math.ceil(left() / 1000);
  const text = on ? Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') : '0:00';
  document.querySelectorAll('[data-timer]').forEach((el) => {
    if (el.hidden) return;
    if (el.textContent !== text) {
      el.textContent = text;
      if (on && S.clock === 'question' && sec <= 5 && sec > 0) audio.play(sec === 5 ? 'finalWarning' : 'tick');
    }
    el.classList.toggle('is-low', on && S.clock === 'question' && sec <= 5);
  });
}, 200);

async function sessionAlive(code) {
  try {
    const res = await fetch('/api/session?code=' + encodeURIComponent(code));
    return res.ok;
  } catch {
    return false;
  }
}

const TIMES = [10, 15, 20, 30, 45];

function rememberHost(host) {
  sessionStorage.setItem('mcg-host', JSON.stringify(host));
}

function forgetHost() {
  es?.close();
  es = null;
  S = null;
  prev = null;
  sessionStorage.removeItem('mcg-host');
  localStorage.removeItem('mcg-host');
}

function showHome() {
  localStorage.removeItem('mcg-host');
  app.innerHTML = `<main class="entry">
    <section class="entry-card">
      <p class="kicker">Manatee County</p>
      <h1>Government Game</h1>
      <p class="lede">One shared board for the room. Each student answers on their own device.</p>
      <div class="actions">
        <button type="button" class="btn primary" id="choose-host">Host a game</button>
        <button type="button" class="btn" id="choose-join">Join a game</button>
      </div>
    </section>
  </main>`;
  $('#choose-host').onclick = () => showHostSetup();
  $('#choose-join').onclick = () => player({ forceJoin: true });
}

function showHostSetup() {
  app.innerHTML = `<main class="entry">
    <section class="entry-card">
      <p class="kicker">Host</p>
      <h1>How long should the game run?</h1>
      <p class="lede">Everyone answers at their own pace. Each building starts with 5 questions, then a player can keep going to crown it or move on.</p>
      <div class="time-choices" role="group" aria-label="Game length">${TIMES.map((minutes) => `<button type="button" class="btn${minutes === 20 ? ' primary' : ''}" data-time="${minutes}" aria-pressed="${minutes === 20}">${minutes} min</button>`).join('')}</div>
      <div class="actions">
        <button type="button" class="btn primary" id="create-game">Continue</button>
        <button type="button" class="btn" id="back-home">Back</button>
      </div>
    </section>
  </main>`;
  let chosen = 20;
  app.querySelectorAll('[data-time]').forEach((button) => {
    button.onclick = () => {
      chosen = +button.dataset.time;
      app.querySelectorAll('[data-time]').forEach((item) => {
        const on = item === button;
        item.setAttribute('aria-pressed', String(on));
        item.classList.toggle('primary', on);
      });
    };
  });
  $('#back-home').onclick = showHome;
  $('#create-game').onclick = async () => {
    const created = await post('create', { gameMinutes: chosen });
    if (!created) return;
    const H = { code: created.code, key: created.hostKey };
    rememberHost(H);
    hostSession(H);
  };
}

function hostSession(H) {
  let board = null;
  let view = '';
  let starting = false;

  async function hostAct(name) {
    return post(name, { code: S?.code || H.code, key: H.key });
  }

  function renderCode() {
    const connected = S.players.filter((player) => player.connected);
    const ready = connected.length >= S.minPlayers;
    const markup = `<main class="entry"><section class="entry-card">
      <p class="kicker">Game code</p>
      <h1 class="join-code">${esc(S.code)}</h1>
      <p class="lede">Open this same address in another window and choose <strong>Join a game</strong>. Enter code <strong>${esc(S.code)}</strong>.</p>
      <p class="roster-label">${S.players.length ? S.players.length + ' joined' : 'Waiting for players'}</p>
      <ul class="code-roster">${S.players.map((player) => `<li><span class="presence ${player.connected ? 'is-on' : ''}"></span>${esc(player.name)}</li>`).join('') || '<li>No one yet</li>'}</ul>
      <div class="actions"><button type="button" class="btn primary" id="begin" ${ready ? '' : 'disabled'}>Begin</button><button type="button" class="btn" id="leave-host">Leave</button></div>
      ${ready ? '' : `<p class="side-note">At least ${S.minPlayers} players need to be connected.</p>`}
    </section></main>`;
    const key = S.players.map((player) => player.id + player.connected).join() + ready;
    if (view === 'code:' + key) return;
    view = 'code:' + key;
    app.innerHTML = markup;
    const begin = $('#begin');
    if (begin) begin.onclick = () => hostAct('openSelection');
    $('#leave-host').onclick = () => { forgetHost(); showHome(); };
  }

  function clockText() {
    if (S.phase !== 'playing' || !S.deadline) return '';
    const sec = Math.max(0, Math.ceil(left() / 1000));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  function renderLeaderboard() {
    const el = $('#leaderboard');
    if (!el || !S) return;
    const names = Object.fromEntries((S.nodes || []).map((node) => [node.id, node.name]));
    const rows = [...S.players].sort((a, b) => (b.correct - a.correct) || (b.points - a.points) || a.name.localeCompare(b.name));
    const where = (player) => {
      if (player.mode === 'done') return 'Choosing a building';
      if (player.mode === 'choice') return 'Deciding on a crown';
      if (player.currentNode && names[player.currentNode]) return names[player.currentNode];
      if (player.picked) return 'Ready';
      return player.connected ? 'Joined' : 'Offline';
    };
    el.innerHTML = `<h2>Leaderboard</h2>
      ${S.phase === 'playing' ? `<p class="lb-clock"><time data-timer>${clockText()}</time></p>` : ''}
      <ol class="lb-list">${rows.map((player, index) => `<li>
        <span class="lb-rank">${index + 1}</span>
        <span class="lb-name">${esc(player.name)}</span>
        <span class="lb-score">${player.correct}</span>
        <span class="lb-where">${esc(where(player))}</span>
      </li>`).join('') || '<li class="lb-empty">No players yet</li>'}</ol>
      ${S.phase === 'final' ? '<button type="button" class="btn primary" data-act="reset">Return to lobby</button>' : ''}`;
  }

  function ensureBoard() {
    if (board && $('#stage')) return;
    app.innerHTML = '<div class="host-app"><div class="stage" id="stage"></div><aside class="leaderboard" id="leaderboard" aria-label="Leaderboard"></aside></div>';
    board = HostBoard($('#stage'));
    app.onclick = (event) => {
      const button = event.target.closest('[data-act="reset"]');
      if (button) hostAct('reset');
    };
  }

  function onState() {
    if (!S) return;
    if (S.phase === 'lobby') {
      board = null;
      renderCode();
      return;
    }
    ensureBoard();
    board.sync(S, { host: true });
    renderLeaderboard();
    view = S.phase;
    const connected = S.players.filter((player) => player.connected);
    const readyToStart = S.phase === 'locked' || (S.phase === 'select' && connected.length >= S.minPlayers && connected.every((player) => player.picked));
    if (readyToStart && !starting) {
      starting = true;
      const begin = async () => {
        if (S.phase === 'select') {
          const locked = await hostAct('lock');
          if (!locked) return;
        }
        await hostAct('start');
      };
      begin().finally(() => { starting = false; });
    }
  }

  connect(`code=${H.code}&role=host&key=${H.key}`, onState);
}

async function boot() {
  app.innerHTML = shell({ title: 'Opening the session', body: 'Connecting to the game.' });
  try {
    META = await (await fetch('/api/meta')).json();
  } catch {
    app.innerHTML = shell({ title: 'The game server is not responding', body: 'Start the server, then reload this page.' });
    return;
  }
  let tabHost = null;
  try { tabHost = JSON.parse(sessionStorage.getItem('mcg-host') || 'null'); } catch { tabHost = null; }
  if (route !== 'play' && tabHost?.code && await sessionAlive(tabHost.code)) {
    hostSession({ code: tabHost.code, key: tabHost.key || tabHost.hostKey });
    return;
  }
  if (tabHost) sessionStorage.removeItem('mcg-host');
  if (route === 'play') { player(); return; }
  if (route === 'host') { showHostSetup(); return; }
  showHome();
}

boot();

const play = {};
function player(options = {}) {
  let me = null;
  try { me = JSON.parse(sessionStorage.getItem('mcg-player') || 'null'); } catch { me = null; }
  let picks = null;
  let choice = null;
  let viewKey = '';
  let lastSound = '';
  const params = new URLSearchParams(location.search);

  function drawJoin(error = '') {
    viewKey = 'join';
    app.innerHTML = `<main class="entry"><form class="entry-card" id="join">
      <p class="kicker">Player</p>
      <h1>Join the game</h1>
      <label for="code">Join code</label>
      <input id="code" name="code" maxlength="4" autocomplete="off" spellcheck="false" value="${esc(params.get('code') || '')}" required>
      <label for="name">Display name</label>
      <input id="name" name="name" maxlength="18" autocomplete="nickname" required>
      <div class="actions"><button class="btn primary" type="submit">Join</button><button type="button" class="btn" id="back-home">Back</button></div>
      <p class="form-error" role="alert">${esc(error)}</p>
    </form></main>`;
    $('#back-home').onclick = showHome;
    $('#join').onsubmit = async (event) => {
      event.preventDefault();
      const joined = await post('join', { code: $('#code').value, name: $('#name').value, pid: me?.pid });
      if (!joined) return;
      me = { code: joined.code, pid: joined.pid };
      sessionStorage.setItem('mcg-player', JSON.stringify(me));
      viewKey = '';
      go();
    };
  }

  function go() {
    connect(`code=${me.code}&role=player&pid=${me.pid}`, render);
  }

  let mapBoard = null;
  function closeMap() {
    document.getElementById('player-map')?.remove();
    mapBoard = null;
  }
  function openMap() {
    if (!S) return;
    let layer = document.getElementById('player-map');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'player-map';
      layer.className = 'player-map';
      layer.innerHTML = '<div class="player-map-bar"><p>Who is at each building</p><button type="button" class="btn" id="close-map">Close</button></div><div class="player-map-stage" id="player-map-stage"></div>';
      document.body.appendChild(layer);
      mapBoard = HostBoard($('#player-map-stage'));
      $('#close-map').onclick = closeMap;
    }
    mapBoard.sync(S, { host: false });
  }

  function render() {
    if (mapBoard) mapBoard.sync(S, { host: false });
    const phase = S.phase;
    const mine = S.me?.nodes || [];
    if (phase === 'lobby') {
      if (viewKey !== 'lobby') {
        viewKey = 'lobby';
        picks = null;
        choice = null;
        app.innerHTML = shell({
          title: 'You’re in.',
          body: 'Keep this page open. The host will ask you to choose three areas of local government.',
          extra: '<div class="actions"><button type="button" class="btn" id="leave-player">Leave</button></div>',
        });
        $('#leave-player').onclick = () => {
          closeMap();
          es?.close();
          es = null;
          S = null;
          sessionStorage.removeItem('mcg-player');
          showHome();
        };
      }
      return;
    }
    if (phase === 'select') {
      if (!picks) picks = new Set(mine);
      if (viewKey !== 'select') {
        viewKey = 'select';
        drawSelection();
      } else {
        const button = $('#confirm-picks');
        if (button) button.textContent = mine.length ? 'Update choices' : 'Confirm three areas';
      }
      return;
    }
    if (phase === 'locked') {
      const key = 'locked:' + mine.join();
      if (viewKey !== key) {
        viewKey = key;
        app.innerHTML = shell({
          title: 'Selections are locked',
          body: mine.length
            ? 'You will compete for:<br>' + mine.map((id) => esc(META.nodes.find((node) => node.id === id).name)).join('<br>')
            : 'You did not confirm three areas, so you will sit this game out.',
        });
      }
      return;
    }
    if (phase === 'playing' && S.me?.mode === 'choice') {
      const node = META.nodes.find((item) => item.id === S.me.currentNode);
      const key = 'choice:' + (node?.id || '');
      if (viewKey !== key) {
        viewKey = key;
        app.innerHTML = `<main class="entry"><section class="entry-card">
          <p class="kicker">${esc(node?.name || 'This building')}</p>
          <h1>Crown it, or move on?</h1>
          <p class="lede">You finished the ${S.me.required} required questions. Keep answering here to take the crown, or leave your score and go to your next building.</p>
          <div class="actions"><button type="button" class="btn primary" id="keep-going">Keep going</button><button type="button" class="btn" id="move-on">Move on</button><button type="button" class="btn" id="see-map">See Map</button></div>
        </section></main>`;
      }
      return;
    }
    if (phase === 'playing' && S.me?.mode === 'done') {
      const buildings = S.me.buildings || [];
      const key = 'done:' + buildings.map((item) => [item.id, item.left, item.correct].join('.')).join();
      if (viewKey !== key) {
        viewKey = key;
        app.innerHTML = `<main class="entry"><section class="entry-card return-card">
          <p class="kicker">Keep competing</p>
          <h1>Your buildings</h1>
          <p class="lede">You have been through each stop. Open one to answer more questions and compete for its crown.</p>
          <ul class="return-list">${buildings.map((item) => {
            const node = META.nodes.find((entry) => entry.id === item.id);
            const open = item.left > 0;
            return `<li><button type="button" class="return-building" data-revisit="${esc(item.id)}" ${open ? '' : 'disabled'}>
              <img src="${buildingSrc(item.id)}" alt="">
              <span><strong>${esc(node?.name || item.id)}</strong><small>${item.correct} correct · ${open ? `${item.left} left` : 'Every question answered'}</small></span>
            </button></li>`;
          }).join('')}</ul>
          <div class="actions"><button type="button" class="btn" id="see-map">See Map</button></div>
        </section></main>`;
      }
      return;
    }
    if (phase === 'final') {
      const key = 'final:' + JSON.stringify(S.results?.overall);
      if (viewKey !== key) {
        viewKey = key;
        app.innerHTML = `<main class="score-page">${FinalScoreboard(S)}</main>`;
      }
      return;
    }
    if (S.question && S.me?.currentNode) {
      const Q = S.question;
      if (choice && viewKey && !viewKey.includes(Q.id)) choice = null;
      const key = ['q', Q.id, S.me.mode, Q.myChoice || '', Q.outcome || '', Q.correctAnswer || '', choice || ''].join(':');
      if (viewKey !== key) {
        viewKey = key;
        const node = META.nodes.find((item) => item.id === S.me.currentNode);
        app.innerHTML = PlayerQuestion({ node, question: Q, phase: S.me.mode, choice });
      }
      if (S.me.mode === 'result' && Q.outcome && lastSound !== Q.id + Q.outcome) {
        lastSound = Q.id + Q.outcome;
        if (Q.outcome === 'correct') audio.play('correct');
        else if (Q.outcome === 'incorrect') audio.play('incorrect');
      }
      return;
    }
    const key = 'wait:' + phase;
    if (viewKey !== key) {
      viewKey = key;
      app.innerHTML = shell({
        title: mine.length ? 'Get ready' : 'You’re sitting this one out',
        body: mine.length
          ? 'The game is starting. Your questions will show up here, and you will not have to wait for anyone else.'
          : 'You did not confirm three areas, so you will sit this game out.',
      });
    }
  }

  function drawSelection() {
    app.innerHTML = FamiliaritySelection({
      nodes: META.nodes,
      picks,
      required: S.picks,
      saved: !!(S.me?.nodes || []).length,
    });
  }

  play.onClick = async (event) => {
    if (event.target.id === 'see-map') { openMap(); return; }
    const revisit = event.target.closest('[data-revisit]');
    if (revisit && !revisit.disabled) {
      post('revisit', { code: me.code, pid: me.pid, node: revisit.dataset.revisit });
      return;
    }
    if (!S) return;
    const area = event.target.closest('.area');
    if (area && S.phase === 'select') {
      const id = area.dataset.id;
      if (picks.has(id)) picks.delete(id);
      else if (picks.size < S.picks) picks.add(id);
      else { toastError(`Choose only ${S.picks}. Unselect one first.`); return; }
      drawSelection();
      app.querySelector(`[data-id="${id}"]`)?.focus();
      return;
    }
    if (event.target.id === 'confirm-picks') {
      if (picks.size !== S.picks) return;
      const saved = await post('select', { code: me.code, pid: me.pid, nodes: [...picks] });
      if (saved) toast('Saved. You can still change this until the host locks.');
      return;
    }
    const choiceBtn = event.target.closest('.choice');
    if (choiceBtn && S.me?.mode === 'question' && S.question && !S.question.myChoice) {
      choice = choiceBtn.dataset.k;
      viewKey = '';
      render();
      app.querySelector(`[data-k="${choice}"]`)?.focus();
      return;
    }
    if (event.target.id === 'submit-answer') submitAnswer();
    if (event.target.id === 'advance-question') post('advance', { code: me.code, pid: me.pid });
    if (event.target.id === 'keep-going') post('continue', { code: me.code, pid: me.pid });
    if (event.target.id === 'move-on') post('move', { code: me.code, pid: me.pid });
  };

  play.onKey = (event) => {
    if (!S || S.me?.mode !== 'question' || !S.question || S.question.myChoice) return;
    if (event.target.matches('input, textarea')) return;
    const key = event.key.length === 1 ? event.key.toUpperCase() : '';
    if ('ABCD'.includes(key) && key) {
      choice = key;
      viewKey = '';
      render();
      return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') ) {
      const order = ['A', 'B', 'C', 'D'];
      const index = Math.max(0, order.indexOf(choice));
      const next = event.key === 'ArrowDown' ? Math.min(3, choice ? index + 1 : 0) : Math.max(0, index - 1);
      choice = order[next];
      viewKey = '';
      render();
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter' && choice) {
      event.preventDefault();
      submitAnswer();
    }
  };

  async function submitAnswer() {
    if (!choice || !S?.question || S.question.myChoice || S.me?.mode !== 'question') return;
    const saved = await post('answer', { code: me.code, pid: me.pid, qid: S.question.id, choice });
    if (saved) audio.play('submitted');
  }

  if (!play.bound) {
    play.bound = true;
    app.addEventListener('click', (event) => play.onClick?.(event));
    document.addEventListener('keydown', (event) => play.onKey?.(event));
  }

  (async () => {
    if (options.forceJoin) { drawJoin(); return; }
    const urlCode = (params.get('code') || '').toUpperCase();
    if (me && (!urlCode || urlCode === me.code) && await sessionAlive(me.code)) go();
    else {
      if (me && urlCode && urlCode !== me.code) me = null;
      if (me && !(await sessionAlive(me.code))) { sessionStorage.removeItem('mcg-player'); me = null; }
      drawJoin();
    }
  })();
}
