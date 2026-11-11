// Classroom name check. Players never see this list.
// A short word has to be the whole name or a whole word, so Class and Michelle still join.
// A longer word is caught inside a name, including spaces, dots, and swapped letters.

const SHORT = [
  'ass', 'sex', 'cum', 'tit', 'fag', 'hoe', 'damn', 'hell', 'crap', 'piss', 'dick', 'cock',
  'anus', 'nude', 'porn', 'nazi', 'xxx', 'jizz', 'twat', 'cunt', 'kys', 'anal', 'rape',
  'clit', 'milf', 'thot', 'spic', 'gook', 'kike', 'dyke', 'slut', 'poop', 'fart',
];

const LONG = [
  'fuck', 'fuk', 'fuq', 'fck', 'fvck', 'phuck', 'shit', 'shyt', 'bullshit', 'bitch', 'biatch', 'bastard',
  'asshole', 'jackass', 'dumbass', 'badass', 'motherfucker', 'nigger', 'nigga', 'negro',
  'faggot', 'retard', 'pussy', 'whore', 'penis', 'vagina', 'dildo', 'hitler', 'chink',
  'wetback', 'beaner', 'tranny', 'boobs', 'tits', 'titty', 'horny', 'goddamn', 'wanker',
  'bollocks', 'bugger', 'skank', 'semen', 'testicle', 'scrotum', 'blowjob', 'handjob',
  'dickhead', 'shithead', 'dipshit', 'clusterfuck', 'pornography', 'slutty',
];

function norm(value) {
  let text = String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return text
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b');
}

const letters = (value) => value.replace(/[^a-z]/g, '');
const squeeze = (value) => value.replace(/([a-z])\1{2,}/g, '$1');

function blocked(name) {
  const text = norm(name);
  const raw = letters(text);
  const flat = squeeze(raw);
  if (!raw) return false;
  const tokens = new Set([raw, flat, ...text.split(/[^a-z]+/).map(letters).filter(Boolean)]);
  for (const token of tokens) {
    if (SHORT.includes(token) || SHORT.includes(squeeze(token))) return true;
  }
  for (const term of LONG) {
    if (raw.includes(term) || flat.includes(squeeze(term))) return true;
  }
  return false;
}

const displayName = (name) => (blocked(name) ? 'Removed' : name);

module.exports = { blocked, displayName };
