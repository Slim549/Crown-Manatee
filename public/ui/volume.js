import { audio } from '../audio.js';

export function volumeMarkup() {
  const settings = audio.settings;
  return `<div class="volume">
    <label>Sound <input type="range" min="0" max="1" step="0.05" value="${settings.volume}" data-vol aria-valuemin="0" aria-valuemax="1"></label>
    <button type="button" class="btn btn-quiet" data-mute aria-pressed="${settings.muted}">${settings.muted ? 'Unmute' : 'Mute'}</button>
  </div>`;
}

export function mountVolume(root) {
  root.querySelector('[data-vol]')?.addEventListener('input', (event) => {
    audio.set('volume', +event.target.value);
  });
  root.querySelector('[data-mute]')?.addEventListener('click', (event) => {
    audio.set('muted', !audio.settings.muted);
    event.currentTarget.textContent = audio.settings.muted ? 'Unmute' : 'Mute';
    event.currentTarget.setAttribute('aria-pressed', String(audio.settings.muted));
  });
}
