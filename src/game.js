import {
  applyAnswer,
  buildRound,
  emptyProgress,
} from "../vendor/openquiz/scheduler.ts";
import { shuffle } from "../vendor/openquiz/shuffle.ts";
import pack from "../packs/pt-PT.json" with { type: "json" };

export const levels = pack.levels.map(({ name, rows }, index) => ({
  name,
  id: String(index + 1),
  words: rows.map(([word, key, a, b, c, example]) => ({
    id: word,
    word,
    key,
    choices: [key, a, b, c],
    example,
  })),
}));
export const fresh = () => ({
  version: 1,
  progress: {},
  sessions: {},
  active: null,
});
export const wordBox = (state, word) => state.progress[word.id]?.box ?? 0;
export const fixedCount = (state, level) =>
  level.words.filter((w) => wordBox(state, w) >= 2).length;
export const complete = (state, level) =>
  fixedCount(state, level) === level.words.length;
export function unlocked(state, level) {
  const i = levels.indexOf(level);
  return i === 0 || complete(state, levels[i - 1]);
}
export function start(state, level, rng = Math.random) {
  if (!unlocked(state, level)) return;
  state.active = level.id;
  if (state.sessions[level.id]) return;
  const replay = complete(state, level);
  const pending = level.words.filter((w) => wordBox(state, w) < 2);
  const progress = new Map(Object.entries(state.progress));
  const last = state.last?.[level.id];
  const draw = replay
    ? shuffle(level.words, rng).slice(0, 5)
    : buildRound(pending, progress, { size: 5, lastTermId: last, rng });
  state.sessions[level.id] = {
    cards: draw.map((w) => ({ id: w.id, options: shuffle(w.choices, rng) })),
    answers: [],
    cursor: 0,
    replay,
  };
}
export function answer(state, level, value) {
  const s = state.sessions[level.id];
  if (
    !s ||
    state.active !== level.id ||
    s.cursor >= s.cards.length ||
    s.answers.length !== s.cursor
  )
    return;
  const card = s.cards[s.cursor];
  const word = level.words.find((w) => w.id === card.id);
  if (value !== null && !card.options.includes(value)) return;
  s.answers.push(value);
  if (!s.replay) {
    const prior = state.progress[word.id] ?? emptyProgress(level.id, word.id);
    state.progress[word.id] = applyAnswer(prior, value === word.key);
  }
  (state.last ??= {})[level.id] = word.id;
}
export function next(state, level) {
  const s = state.sessions[level.id];
  if (s && s.answers.length > s.cursor) s.cursor++;
}
export function finish(state, level) {
  const s = state.sessions[level.id];
  if (!s || s.cursor !== s.cards.length) return;
  delete state.sessions[level.id];
  state.active = null;
}
export function roundScore(s, level) {
  return s.answers.reduce(
    (n, a, i) =>
      n + (level.words.find((w) => w.id === s.cards[i].id).key === a ? 1 : 0),
    0,
  );
}
