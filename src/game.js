import { applyAnswer, emptyProgress } from "../vendor/openquiz/scheduler.ts";
import { shuffle } from "../vendor/openquiz/shuffle.ts";
import { pack } from "./pack.js";

const DAY = 24 * 60 * 60 * 1000;
const RETRY = 10 * 60 * 1000;
const RETRY_GAP = 5;
const INTERVALS = [1, 3, 7, 14, 30];
const SIZE = 5;

/** Bands and words retain pack order and stable save identifiers. */
export const levels = pack.levels.map(({ id, name, words }) => ({
  id,
  name,
  words: words.map(({ id: wordId, word, answer, alternatives, example }) => ({
    id: wordId,
    word,
    key: answer,
    choices: [answer, ...alternatives],
    example,
    levelId: id,
  })),
}));
/** Resolve cards from any band without relying on the current screen. */
export const wordsById = new Map(
  levels.flatMap((level) => level.words.map((word) => [word.id, word])),
);

/** Create an offline save with one resumable session. */
export const fresh = () => ({
  version: 2,
  progress: {},
  session: null,
  active: false,
});

function restoreSession(saved) {
  if (
    !saved ||
    !Array.isArray(saved.cards) ||
    !saved.cards.length ||
    !saved.cards.every(
      (card) => wordsById.has(card?.id) && Array.isArray(card.options),
    ) ||
    !Array.isArray(saved.answers) ||
    !Number.isInteger(saved.cursor) ||
    saved.cursor < 0 ||
    saved.cursor > saved.cards.length ||
    saved.answers.length < saved.cursor ||
    saved.answers.length > Math.min(saved.cursor + 1, saved.cards.length)
  ) return null;
  const session = { ...saved, answers: [...saved.answers] };
  session.cards = session.cards.map((card) => ({
    ...card,
    options: [...card.options],
    key: card.key ?? wordsById.get(card.id).key,
    practice: Boolean(card.practice || session.practice || session.replay),
  }));
  return session;
}

/** Restore v2 or migrate v1 without replaying already counted answers. */
export function restoreState(saved) {
  if (
    !saved ||
    ![1, 2].includes(saved.version) ||
    !saved.progress ||
    typeof saved.progress !== "object" ||
    Array.isArray(saved.progress)
  ) return fresh();
  const state = fresh();
  for (const [id, value] of Object.entries(saved.progress)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const word = wordsById.get(id);
    const progress = {
      ...emptyProgress(word?.levelId ?? value.setId, id),
      ...value,
    };
    if (saved.version === 1) {
      // Old "fixed" words retain their tally even after a later lapse.
      progress.legacyLearned = progress.box >= 2;
      progress.reviewStep = Math.min(4, Math.max(-1, progress.box - 1));
      progress.delayedReviews = 0;
      progress.retry = progress.seen > 0 && progress.box === 0;
      progress.dueAt = progress.seen > 0
        ? progress.lastSeen + (progress.retry
          ? RETRY
          : INTERVALS[Math.max(0, progress.reviewStep)] * DAY)
        : 0;
    }
    if ((progress.retry || progress.scheduledDueAt != null) && progress.questionsLeft == null)
      progress.questionsLeft = RETRY_GAP;
    state.progress[id] = progress;
  }
  if (saved.version === 1) {
    const sessions = saved.sessions && typeof saved.sessions === "object"
      ? Object.entries(saved.sessions)
      : [];
    // Resume the active legacy band first; keep every other parked round.
    sessions.sort(([a], [b]) =>
      Number(b === saved.active) - Number(a === saved.active));
    const restored = sessions.map(([, session]) => restoreSession(session))
      .filter(Boolean);
    state.session = restored.shift() ?? null;
    if (restored.length) state.parkedSessions = restored;
    state.active = Boolean(state.session && typeof saved.active === "string" &&
      saved.sessions[saved.active]);
  } else {
    state.session = restoreSession(saved.session);
    const parked = Array.isArray(saved.parkedSessions)
      ? saved.parkedSessions.map(restoreSession).filter(Boolean)
      : [];
    if (parked.length) state.parkedSessions = parked;
    state.active = Boolean(state.session && saved.active);
  }
  return state;
}

/** Learned means a successful delayed review, or a preserved v1 fixed word. */
export function learned(state, word) {
  const progress = state.progress[word.id];
  return Boolean(progress?.legacyLearned || progress?.delayedReviews > 0);
}

const seen = (state, word) => (state.progress[word.id]?.seen ?? 0) > 0;
const dueAt = (progress) => Number.isFinite(progress?.dueAt)
  ? progress.dueAt : 0;

function struggling(state) {
  return levels.find((level) => {
    const encountered = level.words.filter((word) => seen(state, word));
    const retries = encountered.filter((word) => state.progress[word.id].retry);
    // Pause introductions, not reviews. Small bands use a reachable threshold.
    return retries.length >= Math.min(3, level.words.length) &&
      retries.length * 2 >= encountered.length && encountered.length > 0;
  });
}

/** Resume, or draw overdue cards then easy-to-hard unseen cards; idle play is free practice. */
export function start(state, now = Date.now(), rng = Math.random) {
  if (state.session) {
    state.active = true;
    return state.session;
  }
  if (state.parkedSessions?.length) {
    state.session = state.parkedSessions.shift();
    if (!state.parkedSessions.length) delete state.parkedSessions;
    state.active = true;
    return state.session;
  }
  const words = [...wordsById.values()];
  const reviews = words.filter((word) => {
    const p = state.progress[word.id];
    return p?.seen > 0 && (dueAt(p) <= now || p.questionsLeft != null);
  }).sort((a, b) => dueAt(state.progress[a.id]) - dueAt(state.progress[b.id]));
  const difficultyPause = struggling(state);
  const pristine = !words.some((word) => seen(state, word));
  const bands = pristine ? levels.slice(0, 1) : levels;
  const unseen = bands.flatMap(level => shuffle(level.words.filter(w => !seen(state, w)), rng));
  const practicePool = shuffle(words.filter(w => seen(state, w) && !reviews.includes(w)), rng);
  if (difficultyPause) practicePool.sort((a, b) =>
    Number(b.levelId === difficultyPause.id) - Number(a.levelId === difficultyPause.id));
  const cards = [];
  while (cards.length < SIZE) {
    // Earlier slots in this round will each supply one intervening answer.
    const i = reviews.findIndex(w => {
      const p = state.progress[w.id];
      return dueAt(p) <= now || p.questionsLeft <= cards.length;
    });
    let word = i >= 0 ? reviews.splice(i, 1)[0] : undefined;
    let practice = false;
    if (!word && !difficultyPause) word = unseen.shift();
    if (!word && (reviews.length || cards.every(card => card.practice))) {
      word = practicePool.shift();
      practice = Boolean(word);
      // A new word can bridge a gap when every familiar word is awaiting a retry.
      if (!word && reviews.length) word = unseen.shift();
    }
    if (!word) break;
    cards.push({ id: word.id, key: word.key, options: shuffle(word.choices, rng), practice });
  }
  if (!cards.length) return null;
  state.session = {
    cards,
    cursor: 0,
    answers: [],
    practice: cards.every(card => card.practice),
  };
  state.active = true;
  return state.session;
}

/** Count an answer once and schedule from answer time, never from round creation. */
export function answer(state, value, now = Date.now()) {
  const session = state.session;
  if (!state.active || !session || session.cursor >= session.cards.length ||
    session.answers.length !== session.cursor) return;
  const card = session.cards[session.cursor];
  const word = wordsById.get(card.id);
  if (!word || (value !== null && !card.options.includes(value))) return;
  session.answers.push(value);
  for (const p of Object.values(state.progress)) {
    if (p.termId !== word.id && p.questionsLeft > 0) p.questionsLeft--;
  }
  const correct = value === (card.key ?? word.key);
  const prior = state.progress[word.id] ?? emptyProgress(word.levelId, word.id);
  const ready = dueAt(prior) <= now || prior.questionsLeft === 0;
  const earlyRetry = prior.scheduledDueAt > now && ready;
  const practice = card.practice || session.practice || session.replay ||
    earlyRetry || (prior.seen > 0 && !ready);
  if (practice) {
    // Practice never promotes or postpones a review, including one now overdue.
    if (!correct) {
      state.progress[word.id] = {
        ...prior,
        questionsLeft: RETRY_GAP,
        // Keep the real review separate from an optional, earlier retry.
        scheduledDueAt: prior.scheduledDueAt ?? dueAt(prior),
        dueAt: Math.min(dueAt(prior), now + RETRY),
      };
      if (earlyRetry) state.progress[word.id].dueAt =
        Math.min(prior.scheduledDueAt, now + RETRY);
    } else if (earlyRetry && !card.practice && !session.practice && !session.replay) {
      state.progress[word.id] = { ...prior, dueAt: prior.scheduledDueAt };
      delete state.progress[word.id].scheduledDueAt;
      delete state.progress[word.id].questionsLeft;
    }
    return;
  }
  const progress = applyAnswer(prior, correct, now);
  delete progress.scheduledDueAt;
  if (correct) delete progress.questionsLeft;
  else progress.questionsLeft = RETRY_GAP;
  progress.delayedReviews = prior.delayedReviews ?? 0;
  progress.reviewStep = correct
    ? Math.min(INTERVALS.length - 1, (prior.retry ? -1 : prior.reviewStep ?? -1) + 1)
    : -1;
  if (correct && !prior.retry && prior.reviewStep >= 0 && prior.seen > 0)
    progress.delayedReviews++;
  progress.retry = !correct;
  progress.dueAt = now + (correct ? INTERVALS[progress.reviewStep] * DAY : RETRY);
  state.progress[word.id] = progress;
}

/** Advance only past an answered card. */
export function next(state) {
  const session = state.session;
  if (state.active && session && session.answers.length > session.cursor)
    session.cursor++;
}

/** Clear only a fully completed round; exiting instead sets active to false. */
export function finish(state) {
  const session = state.session;
  if (!session || session.cursor !== session.cards.length) return;
  state.session = null;
  state.active = false;
}

/** Score saved answers across bands without updating progress. */
export function roundScore(session) {
  return session.answers.reduce((score, value, index) => {
    const card = session.cards[index];
    const key = card?.key ?? wordsById.get(card?.id)?.key;
    return score + Number(key !== undefined && value === key);
  }, 0);
}
