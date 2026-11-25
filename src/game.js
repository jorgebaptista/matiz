import { applyAnswer, emptyProgress } from "../vendor/openquiz/scheduler.ts";
import { shuffle } from "../vendor/openquiz/shuffle.ts";
import { pack } from "./pack.js";
import { dailyCards, dailyDay } from "./daily.js";
import { dailyBandsFor, gameLevels } from "./bands.js";
import { createSurvival, restoreSurvival, survivalVersion, survivalId, survivalAttempt, restoreAttempts, mergeAttempts } from "./survival.js";

const DAY = 24 * 60 * 60 * 1000;
const INTERVALS = [1, 3, 7, 14, 30];
const SIZE = 5;

/** Bands and words retain pack order and stable save identifiers. */
export const levels = gameLevels(pack);
/** Resolve cards from any band without relying on the current screen. */
export const wordsById = new Map(
  levels.flatMap((level) => level.words.map((word) => [word.id, word])),
);

// Fixed slots keep the daily at four even if more practice bands are added.
const dailyBands = dailyBandsFor(levels);
export const hasDaily = dailyBands.length > 0;
const debutCalendar = hasDaily ? dailyBands[0].words.map(w => w.debutDay)
  .filter(Number.isInteger).sort((a, b) => a - b) : [];
export function practiceLevels(day = dailyDay(), discoveries = {}) {
  return levels.map(band => ({ ...band, words: band.words.filter(w => w.debutDay == null || w.debutDay < day || discoveries[w.id]?.seen) }));
}
export function startDaily(state, now = Date.now()) {
  if (!hasDaily) return;
  state.survivalActive = false;
  const day = dailyDay(now);
  const released = debutCalendar.filter(date => date <= day);
  const latest = released[released.length - 1];
  const debut = latest === day;
  if (state.daily?.day !== day || (debut && !state.daily.debut && !state.daily.answers.length)) {
    // The first unscheduled day reprises the first published set, then the next.
    let sourceDay = latest;
    if (released.length && !debut)
      sourceDay = released[(day - latest - 1) % released.length];
    const bands = dailyBands.map(band => ({ ...band, words: band.words.filter(w => w.debutDay === sourceDay) }));
    delete state.dailyReplay;
    state.daily = { day, debut, cards: dailyCards(bands, sourceDay ?? day), cursor: 0, answers: [] };
  }
  state.dailyActive = true;
  state.active = false;
}

export function retryDaily(state) {
  const daily = state.daily;
  if (!state.dailyActive || !daily || daily.cursor !== daily.cards.length) return;
  state.dailyReplay = { ...daily, cards: daily.cards.map(card => ({
    ...card, options: shuffle(card.options),
  })), cursor: 0, answers: [] };
}

export const activeSession = state => state.survivalActive ? state.survival : state.dailyActive ? (state.dailyReplay ?? state.daily) : state.active ? state.session : null;

/** Resume Survival, or accept a particular challenge without changing practice or daily saves. */
export function startSurvival(state, seed, target = null, challengeLevels = levels) {
  rememberSurvival(state);
  if (!state.survival || seed !== undefined) {
    const version = survivalVersion(challengeLevels);
    if (seed === undefined) {
      seed = crypto.getRandomValues(new Uint32Array(1))[0];
      while (state.survivalAttempts?.[`${version}:${seed}`]) seed = (seed + 1) >>> 0;
    }
    const run = createSurvival(challengeLevels, seed, target);
    const previous = state.survivalAttempts?.[survivalId(run)];
    state.survival = previous
      ? restoreSurvival({ ...run, answers: previous.answers, cursor: previous.cursor }) ?? run
      : run;
  }
  state.survivalActive = true;
  state.dailyActive = false;
  state.active = false;
  rememberSurvival(state);
  return state.survival;
}

function rememberSurvival(state) {
  const run = state.survival;
  if (!run) return;
  state.survivalAttempts = mergeAttempts({
    ...state.survivalAttempts, [survivalId(run)]: survivalAttempt(run),
  }, state.survivalAttempts ?? {});
}

/** Reconcile first attempts saved by another tab before writing this tab's state. */
export function reconcileSurvival(state, saved) {
  state.survivalAttempts = mergeAttempts(state.survivalAttempts ?? {}, restoreAttempts(saved?.survivalAttempts));
  const run = state.survival;
  if (run) {
    const attempt = state.survivalAttempts[survivalId(run)];
    if (attempt) state.survival = restoreSurvival({ ...run, answers: attempt.answers, cursor: attempt.cursor }) ?? run;
  }
  state.survivalBests ??= {};
  if (saved) {
    for (const key of Object.keys(state.survivalAttempts)) {
      const version = key.split(":")[0];
      const best = saved.survivalBests?.[version];
      state.survivalBests[version] = Number.isSafeInteger(best) && best >= 0 ? best : 0;
    }
  }
  for (const [key, attempt] of Object.entries(state.survivalAttempts)) {
    const version = key.split(":")[0];
    state.survivalBests[version] = Math.max(state.survivalBests[version] ?? 0, attempt.score);
  }
}

/** Create local progress before any game mode has been played. */
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
  if (Number.isSafeInteger(saved.answerBest) && saved.answerBest > 0) {
    state.answerBest = saved.answerBest;
    state.answerRun = Number.isSafeInteger(saved.answerRun) && saved.answerRun >= 0
      ? Math.min(saved.answerRun, saved.answerBest) : 0;
  }
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
          ? 0
          : INTERVALS[Math.max(0, progress.reviewStep)] * DAY)
        : 0;
    }
    // Older saves used a countdown and an optional early free-practice review.
    if (progress.scheduledDueAt != null) progress.dueAt = progress.scheduledDueAt;
    else if (progress.retry && progress.questionsLeft != null) progress.dueAt = progress.lastSeen;
    delete progress.scheduledDueAt;
    delete progress.questionsLeft;
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
    if (hasDaily && Number.isSafeInteger(saved.daily?.day)) {
      const daily = restoreSession(saved.daily);
      if (daily) {
        state.daily = daily;
        // Credit answers still present in a pre-collection daily save.
        if (daily.discoveries == null) daily.answers.forEach((value, index) =>
          discoverDailyWord(state, daily, daily.cards[index], value, daily.day * DAY));

        if (daily.cursor === daily.cards.length && saved.dailyReplay?.day === daily.day) {
          const replay = restoreSession(saved.dailyReplay);
          if (replay) state.dailyReplay = replay;
        }
        state.dailyActive = Boolean(saved.dailyActive);
        if (state.dailyActive) state.active = false;
      }
    }
    if (saved.survival) state.survival = restoreSurvival(saved.survival);
    if (Object.hasOwn(saved, "survivalActive")) state.survivalActive = Boolean(state.survival && saved.survivalActive);
    if (saved.survivalBests) state.survivalBests = Object.fromEntries(Object.entries(saved.survivalBests)
      .filter(([version, score]) => /^s1-[a-f0-9]{8}$/.test(version) && Number.isSafeInteger(score) && score >= 0));
    if (saved.survivalAttempts) state.survivalAttempts = restoreAttempts(saved.survivalAttempts);
    rememberSurvival(state);
    if (state.survivalActive) {
      state.active = false;
      state.dailyActive = false;
    }
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

function struggling(state, available) {
  return available.find((level) => {
    const encountered = level.words.filter((word) => seen(state, word));
    const retries = encountered.filter((word) => state.progress[word.id].retry);
    // Pause introductions, not reviews. Small bands use a reachable threshold.
    return retries.length >= Math.min(3, level.words.length) &&
      retries.length * 2 >= encountered.length && encountered.length > 0;
  });
}

/** Resume, or draw overdue cards then easy-to-hard unseen cards; idle play is free practice. */
export function start(state, now = Date.now(), rng = Math.random) {
  state.survivalActive = false;
  if (state.dailyActive) state.dailyActive = false;
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
  const available = practiceLevels(dailyDay(now));
  const words = available.flatMap(band => band.words);
  const reviews = words.filter((word) => {
    const p = state.progress[word.id];
    return p?.seen > 0 && dueAt(p) <= now;
  }).sort((a, b) => dueAt(state.progress[a.id]) - dueAt(state.progress[b.id]));
  const difficultyPause = struggling(state, available);
  const pristine = !words.some((word) => seen(state, word));
  const bands = pristine ? available.slice(0, 1) : available;
  const unseen = bands.flatMap(level => shuffle(level.words.filter(w => !seen(state, w)), rng));
  const practicePool = shuffle(words.filter(w => seen(state, w) && !reviews.includes(w)), rng);
  if (difficultyPause) practicePool.sort((a, b) =>
    Number(b.levelId === difficultyPause.id) - Number(a.levelId === difficultyPause.id));
  const cards = [];
  while (cards.length < SIZE) {
    let word = reviews.shift();
    let practice = false;
    if (!word && !difficultyPause) word = unseen.shift();
    if (!word && cards.every(card => card.practice)) {
      word = practicePool.shift();
      practice = Boolean(word);
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

export function collectionCounts(state, available = practiceLevels(dailyDay(), state.progress)) {
  let total = 0, discovered = 0, mastered = 0;
  for (const band of available) {
    total += band.words.length;
    for (const word of band.words) {
      if (learned(state, word)) {
        mastered++;
        discovered++;
      } else if (seen(state, word)) discovered++;
    }
  }
  return { total, discovered, mastered };
}

export function nextMilestone(mastered, total) {
  const goal = mastered < 5 ? 5 : mastered < 10 ? 10 : 25 * (Math.floor(mastered / 25) + 1);
  return Math.min(goal, total);
}

function discoverDailyWord(state, daily, card, value, now) {
  daily.discoveries ??= 0;
  const word = wordsById.get(card.id);
  if (seen(state, word) || learned(state, word)) return;
  const correct = value === card.key;
  const progress = applyAnswer(emptyProgress(word.levelId, word.id), correct, now);
  // Lisbon midnight is either 00:00 UTC or 23:00 UTC on the previous date.
  const tomorrow = dailyDay(now) + 1;
  const summerMidnight = tomorrow * DAY - 3_600_000;
  progress.dueAt = dailyDay(summerMidnight) === tomorrow ? summerMidnight : tomorrow * DAY;
  progress.retry = !correct;
  progress.reviewStep = correct ? 0 : -1;
  progress.delayedReviews = 0;
  state.progress[word.id] = progress;
  daily.discoveries++;
}

/** Count an answer once and schedule from answer time, never from round creation. */
export function answer(state, value, now = Date.now()) {
  const session = activeSession(state);
  if (!session || session.cursor >= session.cards.length ||
    session.answers.length !== session.cursor) return;
  const card = session.cards[session.cursor];
  const word = state.survivalActive ? card : wordsById.get(card.id);
  if (!word || (value !== null && !card.options.includes(value))) return;
  session.answers.push(value);
  const correct = value === (card.key ?? word.key);
  if (!(state.dailyActive && state.dailyReplay) && !card.correction) {
    state.answerRun = correct ? (state.answerRun ?? 0) + 1 : 0;
    state.answerBest = Math.max(state.answerBest ?? 0, state.answerRun);
  }
  if (state.survivalActive) {
    state.survivalBests ??= {};
    state.survivalBests[session.version] = Math.max(state.survivalBests[session.version] ?? 0, roundScore(session));
    rememberSurvival(state);
    return;
  }
  if (state.dailyActive) {
    if (!state.dailyReplay) discoverDailyWord(state, session, card, value, now);
    return;
  }
  const wasLearned = learned(state, word);
  if (wasLearned) card.learnedReview = true;
  if (!correct && !card.correction) {
    session.cards.push({ ...card, correction: true, options: shuffle(card.options) });
  }
  const prior = state.progress[word.id] ?? emptyProgress(word.levelId, word.id);
  if (card.practice || session.practice || session.replay || (prior.seen > 0 && dueAt(prior) > now)) return;
  const progress = applyAnswer(prior, correct, now);
  progress.delayedReviews = prior.delayedReviews ?? 0;
  progress.reviewStep = correct
    ? Math.min(INTERVALS.length - 1, (prior.retry ? -1 : prior.reviewStep ?? -1) + 1)
    : -1;
  if (correct && !prior.retry && prior.reviewStep >= 0 && prior.seen > 0)
    progress.delayedReviews++;
  progress.retry = !correct;
  progress.dueAt = now + (correct ? INTERVALS[progress.reviewStep] * DAY : 0);
  state.progress[word.id] = progress;
  if (!prior.seen) session.discoveries = (session.discoveries ?? 0) + 1;
  if (!wasLearned && learned(state, word)) {
    session.promotions = (session.promotions ?? 0) + 1;
    const { mastered, total } = collectionCounts(state);
    if (nextMilestone(mastered - 1, total) === mastered) session.milestone = mastered;
  }
}

/** Advance only past an answered card. */
export function next(state) {
  const session = activeSession(state);
  if (!session || session.answers.length <= session.cursor) return;
  if (state.survivalActive && session.answers[session.cursor] !== session.cards[session.cursor].key)
    session.cursor = session.cards.length;
  else session.cursor++;
  if (state.survivalActive) rememberSurvival(state);
  else if (session.cursor === session.cards.length && !(state.dailyActive && state.dailyReplay))
    session.collection = collectionCounts(state);
}

/** Only the latest answer for each word in the finished pass matters here. */
export function missedWords(session) {
  if (!session || session.cursor !== session.cards.length) return [];
  const missed = new Map();
  for (let i = session.retryStart ?? 0; i < session.cards.length; i++) {
    const card = session.cards[i];
    if (session.answers[i] === (card.key ?? wordsById.get(card.id)?.key)) missed.delete(card.id);
    else missed.set(card.id, card);
  }
  return [...missed.values()];
}

export function retryMissed(state) {
  if (!state.active || state.dailyActive || state.survivalActive) return;
  const session = state.session;
  const missed = missedWords(session);
  if (!missed.length) return;
  // Retain the scored round and replace only its optional practice pass.
  session.retryStart ??= session.cards.length;
  session.cursor = session.retryStart;
  session.answers.length = session.retryStart;
  session.cards.splice(session.retryStart, Infinity, ...missed.map(card => ({
    ...card, correction: true, options: shuffle(card.options),
  })));
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
    return score + Number(!card?.correction && key !== undefined && value === key);
  }, 0);
}
