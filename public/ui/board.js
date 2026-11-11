import { BOARD, CROWN, NODE_ART, TAG, buildingSrc } from '../assets.js';
import { esc, pct } from './util.js';
import { FinalScoreboard } from './scoreboard.js';
import { audio } from '../audio.js';

const W = BOARD.designW;
const H = BOARD.designH;

const CROWDS = {
  1: { crowd: '1', w: TAG.w, h: TAG.h, gapX: 8, gapY: 6 },
  2: { crowd: '2', w: 188, h: 46, gapX: 6, gapY: 4 },
  3: { crowd: '3', w: 150, h: 38, gapX: 5, gapY: 4 },
  4: { crowd: '4', w: 122, h: 32, gapX: 4, gapY: 3 },
};

function crowdLevel(count) {
  if (count <= 4) return 1;
  if (count <= 8) return 2;
  if (count <= 16) return 3;
  return 4;
}

function metrics(count, wide) {
  const spec = CROWDS[crowdLevel(count)];
  const cap = wide
    ? (count <= 4 ? 4 : count <= 8 ? 4 : count <= 16 ? 6 : 8)
    : (count <= 4 ? 1 : count <= 8 ? 2 : count <= 16 ? 3 : 5);
  return { ...spec, cols: Math.max(1, Math.min(count, cap)) };
}

function place(index, count, anchor, wide) {
  const m = metrics(count, wide);
  const col = index % m.cols;
  const row = Math.floor(index / m.cols);
  const cellW = m.w + m.gapX;
  const cellH = m.h + m.gapY;
  const rows = Math.ceil(count / m.cols);
  const blockW = m.cols * cellW - m.gapX;
  const blockH = rows * cellH - m.gapY;
  let x = anchor.x;
  let y = anchor.y;
  if (anchor.alignX === 'center') x -= blockW / 2;
  if (anchor.alignX === 'end') x -= blockW;
  if (anchor.alignY === 'center') y -= blockH / 2;
  if (anchor.alignY === 'end') y -= blockH;
  x = Math.max(8, Math.min(W - blockW - 8, x));
  y = Math.max(8, Math.min(H - blockH - 8, y));
  return { x: x + col * cellW, y: y + row * cellH, crowd: m.crowd };
}

function slot(nodeId, index, count) {
  const art = NODE_ART[nodeId];
  const [sx, sy] = art.star;
  const [bx, by, bw, bh] = art.box;
  const dir = art.tags || 'below';
  const pad = 16;
  const anchor = count <= 4
    ? (dir === 'below' ? { x: sx, y: sy + 40, alignX: 'center', alignY: 'start' }
      : dir === 'above' ? { x: sx, y: sy - 40, alignX: 'center', alignY: 'end' }
      : dir === 'right' ? { x: sx + 40, y: sy, alignX: 'start', alignY: 'center' }
      : { x: sx - 40, y: sy, alignX: 'end', alignY: 'center' })
    : (dir === 'below' ? { x: bx + bw / 2, y: by + bh + pad, alignX: 'center', alignY: 'start' }
      : dir === 'above' ? { x: bx + bw / 2, y: by - pad, alignX: 'center', alignY: 'end' }
      : dir === 'right' ? { x: bx + bw + pad, y: by + bh / 2, alignX: 'start', alignY: 'center' }
      : { x: bx - pad, y: by + bh / 2, alignX: 'end', alignY: 'center' });
  return place(index, count, anchor, false);
}

function homeSlot(index, count) {
  return place(index, count, { x: W / 2, y: H - 16, alignX: 'center', alignY: 'end' }, true);
}

export function HostBoard(stage) {
  stage.innerHTML = `<div class="board" id="board">
    <img class="board-base" alt="" src="${BOARD.image}" width="${BOARD.w}" height="${BOARD.h}">
    <div class="timer-slot" hidden></div>
    <time class="timer" data-timer>0:00</time>
    <div class="board-banner" id="board-banner" hidden></div>
    <div class="board-overlay" id="board-overlay"></div>
  </div>`;
  const board = stage.querySelector('#board');
  const places = new Map();
  let overlayKey = '';
  let built = false;

  function ensureNodes(nodes) {
    if (built) return;
    nodes.forEach((node, index) => {
      const art = NODE_ART[node.id];
      const [x, y, w, h] = art.box;
      const [lx, ly, lw] = art.label;
      const float = `--float-time:${(3.1 + (index % 4) * 0.45).toFixed(2)}s;--float-delay:${(index * 0.27).toFixed(2)}s`;
      board.insertAdjacentHTML('beforeend', `
        <div class="building is-idle" id="b-${node.id}" style="left:${pct(x, W)};top:${pct(y, H)};width:${pct(w, W)};height:${pct(h, H)};${float}">
          <img src="${buildingSrc(node.id)}" alt="${esc(node.name)}">
        </div>
        <p class="node-label" id="l-${node.id}" style="left:${pct(lx, W)};top:${pct(ly, H)};width:${pct(lw, W)}">
          <span>${esc(node.name)}</span><small></small>
        </p>`);
    });
    built = true;
  }

  function locateAll(state) {
    const groups = new Map();
    const home = [];
    state.players.forEach((player) => {
      let nodeId = null;
      if ((state.phase === 'playing' || state.phase === 'final') && player.currentNode) nodeId = player.currentNode;
      if (nodeId && !NODE_ART[nodeId]) nodeId = null;
      if (nodeId) {
        if (!groups.has(nodeId)) groups.set(nodeId, []);
        groups.get(nodeId).push(player);
      } else home.push(player);
    });
    const located = [];
    groups.forEach((players, nodeId) => {
      players.forEach((player, index) => {
        const spot = slot(nodeId, index, players.length);
        located.push({ player, nodeId, position: [spot.x, spot.y], crowd: spot.crowd });
      });
    });
    home.forEach((player, index) => {
      const spot = homeSlot(index, home.length);
      located.push({ player, nodeId: null, position: [spot.x, spot.y], crowd: spot.crowd });
    });
    return located;
  }

  function buildingLeaders(state) {
    const marks = [];
    if (!['playing', 'final'].includes(state.phase)) return marks;
    // One player can lead several buildings. Each building is crowned on its own.
    for (const node of state.nodes) {
      const scores = state.nodeScores?.[node.id] || {};
      const max = Math.max(0, ...Object.values(scores));
      if (max <= 0) continue;
      Object.entries(scores).filter(([, value]) => value === max).forEach(([id], index) => {
        marks.push({ key: node.id + '-' + id, nodeId: node.id, pid: id, index });
      });
    }
    return marks;
  }

  function syncBuildings(state) {
    for (const node of state.nodes) {
      const eligible = state.players.filter((player) => player.nodes?.includes(node.id));
      const here = state.players.filter((player) => player.currentNode === node.id).length;
      const scores = state.nodeScores?.[node.id] || {};
      const crowned = Math.max(0, ...Object.values(scores)) > 0;
      const active = here > 0;
      const unclaimed = ['playing', 'final'].includes(state.phase) && !eligible.length;
      const el = board.querySelector('#b-' + node.id);
      el.className = 'building ' + (active ? 'is-active' : crowned ? 'is-done' : unclaimed ? 'is-unclaimed' : 'is-idle');
      const note = el && board.querySelector('#l-' + node.id + ' small');
      note.textContent = unclaimed ? 'No eligible players' : here ? `${here} playing` : crowned ? 'Crowned' : '';
    }
  }

  function syncTags(located, state) {
    const seen = new Set();
    let moved = false;
    const showScore = ['playing', 'final'].includes(state.phase);
    for (const item of located) {
      const id = item.player.id;
      seen.add(id);
      let el = document.getElementById('t-' + id);
      if (!el) {
        el = document.createElement('div');
        el.id = 't-' + id;
        el.className = 'tag';
        el.innerHTML = '<span class="tag-name"></span><span class="tag-score"></span>';
        el.style.left = pct(item.position[0], W);
        el.style.top = pct(item.position[1], H);
        board.appendChild(el);
      }
      const place = item.nodeId || 'home';
      const prev = places.get(id);
      if (prev && prev !== place) moved = true;
      places.set(id, place);
      el.style.left = pct(item.position[0], W);
      el.style.top = pct(item.position[1], H);
      el.dataset.crowd = item.crowd || '1';
      el.classList.toggle('is-off', !item.player.connected);
      el.dataset.status = item.player.status || '';
      el.querySelector('.tag-name').textContent = item.player.name;
      const score = el.querySelector('.tag-score');
      score.hidden = !showScore;
      score.textContent = showScore ? String(item.player.correct) : '';
    }
    board.querySelectorAll('.tag').forEach((el) => {
      if (!seen.has(el.id.slice(2))) {
        places.delete(el.id.slice(2));
        el.remove();
      }
    });
    if (moved) audio.play('tagMove');
  }

  function syncCrowns(state) {
    const marks = buildingLeaders(state);
    const seen = new Set();
    const prev = new Set([...board.querySelectorAll('.crown')].map((el) => el.id));
    for (const mark of marks) {
      seen.add(mark.key);
      const [sx, sy] = NODE_ART[mark.nodeId].star;
      const left = pct(sx + mark.index * 150, W);
      const top = pct(sy - 20, H);
      const name = state.players.find((player) => player.id === mark.pid)?.name || '';
      let el = document.getElementById('c-' + mark.key);
      if (!el) {
        el = document.createElement('div');
        el.id = 'c-' + mark.key;
        el.className = 'crown';
        el.innerHTML = `<img alt="" src="${CROWN}"><span class="crown-name"></span>`;
        el.style.left = left;
        el.style.top = top;
        board.appendChild(el);
      } else {
        el.style.left = left;
        el.style.top = top;
      }
      el.querySelector('.crown-name').textContent = name;
    }
    board.querySelectorAll('.crown').forEach((el) => {
      if (!seen.has(el.id.slice(2))) el.remove();
    });
    const changed = seen.size !== prev.size || [...seen].some((id) => !prev.has('c-' + id));
    if (changed && seen.size) audio.play('crown');
  }

  function banner(state) {
    const el = board.querySelector('#board-banner');
    let text = '';
    if (state.paused) text = 'Paused';
    else if (state.phase === 'select') {
      const ready = state.players.filter((player) => player.picked).length;
      text = `Choosing areas · ${ready} of ${state.players.length} ready`;
    } else if (state.phase === 'locked') text = 'Selections locked';
    el.hidden = !text;
    if (el.textContent !== text) el.textContent = text;
  }

  function overlay(state, host) {
    let html = '';
    let key = state.phase;
    if (state.phase === 'lobby') {
      const roster = state.players.map((player) => `<li><span class="presence ${player.connected ? 'is-on' : ''}"></span>${esc(player.name)}<em>${player.connected ? 'Connected' : 'Offline'}</em></li>`).join('');
      html = `<section class="modal modal-lobby">
        <p class="kicker">Join on your own device</p>
        <h1>Manatee County Government Game</h1>
        <p class="modal-lead">Open <strong>${esc(location.host)}/play</strong> and enter this code.</p>
        <p class="join-code" aria-label="Join code">${esc(state.code)}</p>
        <p class="roster-label">${state.players.length ? state.players.length + ' in this session' : 'Waiting for players'}</p>
        <ul class="roster">${roster}</ul>
      </section>`;
      key += state.players.map((player) => player.id + player.connected + player.name).join();
    } else if (state.phase === 'final') {
      html = `<div class="modal modal-score">${FinalScoreboard(state, { host })}</div>`;
      key += JSON.stringify(state.results);
    }
    const holder = board.querySelector('#board-overlay');
    if (key !== overlayKey) {
      overlayKey = key;
      holder.innerHTML = html;
    }
  }

  return {
    sync(state, { host = true } = {}) {
      ensureNodes(state.nodes);
      syncBuildings(state);
      const located = locateAll(state);
      syncTags(located, state);
      syncCrowns(state);
      banner(state);
      const showClock = host && state.phase === 'playing';
      board.querySelector('[data-timer]').hidden = !showClock;
      board.querySelector('.timer-slot').hidden = showClock;
    overlay(state, host);
    },
  };
}
