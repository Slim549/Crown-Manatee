import { buildingSrc } from '../assets.js';
import { esc } from './util.js';

export function AnswerChoice({ key, text, pressed, locked, mark }) {
  const cls = mark ? `choice is-${mark}` : 'choice';
  const note = mark === 'correct' ? 'Correct' : mark === 'wrong' ? 'Your answer' : pressed && locked ? 'Locked' : '';
  return `<button type="button" class="${cls}" data-k="${key}" aria-pressed="${pressed}" ${locked ? 'disabled' : ''}>
    <span class="choice-key">${key}</span>
    <span class="choice-text">${esc(text)}</span>
    ${note ? `<span class="choice-mark">${note}</span>` : ''}
  </button>`;
}

export function PlayerQuestion({ node, question, phase, choice }) {
  const showing = phase === 'result';
  const locked = showing;
  const selected = showing ? question.myChoice : choice;
  const progress = question.bonus ? 100 : Math.min(100, (question.number / question.required) * 100);
  const label = question.bonus
    ? `Bonus question ${question.number - question.required}`
    : `Question ${question.number} of ${question.required}`;
  const choices = ['A', 'B', 'C', 'D'].map((key) => {
    let mark = '';
    if (showing && question.correctAnswer) {
      if (key === question.correctAnswer) mark = 'correct';
      else if (key === question.myChoice) mark = 'wrong';
    }
    return AnswerChoice({ key, text: question.choices[key], pressed: selected === key, locked, mark });
  }).join('');

  const outcome = showing
    ? `<p class="outcome" role="status">${
        { correct: 'Correct.', incorrect: 'Not the right answer. Press Next when you are ready.', unanswered: 'Time ran out on this question.' }[question.outcome] || 'Answer recorded.'
      }</p><div class="submit-row"><button type="button" class="btn primary" id="advance-question">Next</button>${question.bonus ? `<button type="button" class="btn" id="move-on">${question.home ? 'Back to buildings' : 'Move on'}</button>` : ''}</div>`
    : `<div class="submit-row"><button type="button" class="btn primary" id="submit-answer" ${choice ? '' : 'disabled'}>Lock in answer</button>${question.bonus ? `<button type="button" class="btn" id="move-on">${question.home ? 'Back to buildings' : 'Move on'}</button>` : ''}<p class="hint">A–D to choose. Enter to lock in. Your pace is your own.</p></div>`;

  return `<main class="question">
    <aside class="q-aside">
      <p class="kicker">Now at this building</p>
      <h2>${esc(node.name)}</h2>
      <img src="${buildingSrc(node.id)}" alt="">
      <div class="q-progress">
        <p>${label}</p>
        <div class="bar" aria-hidden="true"><span style="width:${progress}%"></span></div>
      </div>
      <button type="button" class="btn" id="see-map">See Map</button>
    </aside>
    <section class="q-main">
      <h1 class="prompt">${esc(question.prompt)}</h1>
      <div class="choices" role="group" aria-label="Answers">${choices}</div>
      ${outcome}
    </section>
  </main>`;
}
