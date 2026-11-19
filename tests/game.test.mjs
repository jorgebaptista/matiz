import test from "node:test";
import assert from "node:assert/strict";
import pack from "../packs/pt-PT.json" with { type: "json" };
import { emptyProgress } from "../vendor/openquiz/scheduler.ts";
import {
  levels, practiceLevels, wordsById, restoreState, fresh, start, answer, next, finish,
  roundScore, learned, missedWords, retryMissed, collectionCounts, nextMilestone,
} from "../src/game.js";

const DAY = 86_400_000;
const RETRY = 600_000;
const NOW = Date.UTC(2026, 9, 1, 12);
const rng = () => 0.23;
const first = levels[0].words[0];
const words = practiceLevels(NOW / DAY).flatMap(band => band.words);
const key = (card) => wordsById.get(card.id).key;

function progress(word, overrides = {}) {
  return {
    ...emptyProgress(word.levelId, word.id),
    seen: 1,
    correct: 1,
    box: 1,
    status: "learning",
    lastSeen: NOW,
    reviewStep: 0,
    delayedReviews: 0,
    retry: false,
    dueAt: NOW + DAY,
    ...overrides,
  };
}

function allSeen() {
  const state = fresh();
  state.progress = Object.fromEntries(words.map((word) => [word.id, progress(word)]));
  return state;
}

function oneCard(state, word = first, practice = false) {
  state.session = {
    cards: [{ id: word.id, options: [...word.choices], practice }],
    cursor: 0,
    answers: [],
    practice,
  };
  state.active = true;
}

function completeRound(state, now, valueFor = key) {
  for (const card of state.session.cards) {
    answer(state, valueFor(card), now);
    next(state);
  }
  finish(state);
}

test("exports pack order, stable IDs and a cross-band word map", () => {
  assert.equal(levels[0].id, "0");
  assert.deepEqual(levels.map((level) => level.id), pack.levels.map((level) => level.id));
  assert.equal(wordsById.size, levels.reduce((n, level) => n + level.words.length, 0));
  for (const level of levels) for (const word of level.words) {
    assert.equal(wordsById.get(word.id), word);
    assert.equal(word.levelId, level.id);
    const source = pack.levels.flatMap(band => band.words).find(entry => entry.id === word.id);
    assert.equal(word.phrase, source.phrase);
    assert.deepEqual(Object.keys(word).sort(),
      ["id", "word", "key", "choices", "example", "levelId", ...(source.phrase ? ["phrase"] : []),
        ...(word.debutDay == null ? [] : ["debutDay"])].sort());
  }
});

test("fresh rounds contain five distinct first-band words and reproducible shuffled choices", () => {
  const a = fresh(), b = fresh();
  assert.deepEqual(a, { version: 2, progress: {}, session: null, active: false });
  start(a, NOW, rng);
  start(b, NOW, rng);
  assert.deepEqual(a, b);
  assert.equal(a.session.cards.length, 5);
  assert.equal(new Set(a.session.cards.map((card) => card.id)).size, 5);
  for (const card of a.session.cards) {
    assert.equal(wordsById.get(card.id).levelId, "0");
    assert.deepEqual([...card.options].sort(), [...wordsById.get(card.id).choices].sort());
    assert.equal(card.practice, false);
  }
  assert.notDeepEqual(a.session.cards[0].options, wordsById.get(a.session.cards[0].id).choices);
});

test("overdue cards win across every band, oldest due first, before unseen cards", () => {
  const state = fresh();
  const hard = levels.at(-1).words[0];
  const middle = levels[1].words[0];
  state.progress[hard.id] = progress(hard, { dueAt: NOW - 3 * DAY });
  state.progress[first.id] = progress(first, { dueAt: NOW - DAY });
  state.progress[middle.id] = progress(middle, { dueAt: NOW });
  start(state, NOW, rng);
  assert.deepEqual(state.session.cards.slice(0, 3).map((card) => card.id),
    [hard.id, first.id, middle.id]);
  assert.equal(state.session.cards.length, 5);
  for (const card of state.session.cards.slice(3)) {
    assert.equal(wordsById.get(card.id).levelId, "0");
    assert.equal(state.progress[card.id], undefined);
  }
});

test("a review backlog fills the round without new words or duplicates", () => {
  const state = allSeen();
  const overdue = words.slice(-7).reverse();
  overdue.forEach((word, i) => { state.progress[word.id].dueAt = NOW - (7 - i) * DAY; });
  start(state, NOW, rng);
  assert.deepEqual(state.session.cards.map((card) => card.id), overdue.slice(0, 5).map((word) => word.id));
});

test("spare places cross band boundaries without old mastery gates", () => {
  const state = fresh();
  for (const word of practiceLevels(Math.floor(NOW / DAY))[0].words.slice(0, -2)) state.progress[word.id] = progress(word);
  start(state, NOW, rng);
  assert.deepEqual(state.session.cards.map((card) => wordsById.get(card.id).levelId),
    ["0", "0", "1", "1", "1"]);
  assert.equal(levels[0].words.some((word) => learned(state, word)), false);
});

test("answers are validated and scored once, using injected answer time", () => {
  const state = fresh();
  oneCard(state);
  next(state);
  finish(state);
  assert.equal(state.session.cursor, 0);
  answer(state, "not an option", NOW);
  answer(state, undefined, NOW);
  assert.deepEqual(state.session.answers, []);
  answer(state, first.key, NOW + 1234);
  const saved = structuredClone(state);
  answer(state, null, NOW + DAY);
  assert.deepEqual(state, saved);
  assert.equal(roundScore(state.session), 1);
  assert.equal(state.progress[first.id].seen, 1);
  assert.equal(state.progress[first.id].box, 1);
  assert.equal(state.progress[first.id].lastSeen, NOW + 1234);
  assert.equal(state.progress[first.id].dueAt, NOW + 1234 + DAY);
  assert.equal(learned(state, first), false);
  next(state);
  next(state);
  assert.equal(state.session.cursor, 1);
  finish(state);
  assert.equal(state.session, null);
  assert.equal(state.active, false);
});

test("delayed successes schedule 1, 3, 7, 14, 30 then repeated 30 days", () => {
  const state = fresh();
  let now = NOW;
  for (const [i, days] of [1, 3, 7, 14, 30, 30, 30].entries()) {
    oneCard(state);
    answer(state, first.key, now);
    const p = state.progress[first.id];
    assert.equal(p.dueAt, now + days * DAY);
    assert.equal(p.delayedReviews, i);
    assert.equal(learned(state, first), i > 0);
    now = p.dueAt + 321; // A late review schedules from the answer, not the old due date.
  }
});

test("misses and skips retry at round end and retry success is not a delayed review", () => {
  for (const value of [null, first.choices[1]]) {
    const state = fresh();
    oneCard(state);
    answer(state, value, NOW);
    assert.equal(roundScore(state.session), 0);
    assert.equal(state.progress[first.id].dueAt, NOW);
    assert.equal(state.progress[first.id].incorrect, 1);
    next(state);
    assert.equal(state.session.cards[1].correction, true);
    answer(state, first.key, NOW + RETRY);
    assert.equal(state.progress[first.id].dueAt, NOW + RETRY + DAY);
    assert.equal(learned(state, first), false);
    oneCard(state);
    answer(state, first.key, NOW + RETRY + DAY);
    assert.equal(learned(state, first), true);
    oneCard(state);
    answer(state, null, state.progress[first.id].dueAt);
    assert.equal(learned(state, first), true);
    assert.equal(state.progress[first.id].reviewStep, -1);
  }
});

test("exit and JSON restore resume choices, feedback and score without counting again", () => {
  let state = fresh();
  start(state, NOW, rng);
  answer(state, key(state.session.cards[0]), NOW);
  state.active = false;
  const saved = JSON.parse(JSON.stringify(state));
  state = restoreState(saved);
  answer(state, null, NOW);
  next(state);
  assert.equal(state.session.cursor, 0);
  start(state, NOW + DAY, () => { throw new Error("resume must not redraw"); });
  assert.deepEqual(state.session.cards, saved.session.cards);
  assert.deepEqual(state.session.answers, saved.session.answers);
  const before = structuredClone(state.progress);
  answer(state, key(state.session.cards[0]), NOW + DAY);
  assert.deepEqual(state.progress, before);
  assert.equal(roundScore(state.session), 1);
  next(state);
  assert.equal(state.session.cursor, 1);
  assert.deepEqual(saved, { ...state, active: false, session: { ...state.session, cursor: 0 } });
});

test("legacy partial rounds retain original options, answers, score and fixed counts", () => {
  const renitente = wordsById.get("renitente");
  const other = levels.find((level) => level.id === "1").words[1];
  const legacy = {
    version: 1,
    progress: {
      [renitente.id]: { ...emptyProgress("1", renitente.id), box: 2, seen: 2, correct: 2, lastSeen: NOW },
      [other.id]: { ...emptyProgress("1", other.id), box: 1, seen: 1, correct: 1, lastSeen: NOW },
    },
    sessions: { "1": {
      cards: [
        { id: renitente.id, options: ["impaciente", "relutante", "distraído", "indeciso"] },
        { id: other.id, options: [...other.choices].reverse() },
      ],
      answers: ["relutante"], cursor: 0, replay: false,
    } },
    active: "1",
  };
  const snapshot = structuredClone(legacy);
  const state = restoreState(legacy);
  assert.equal(state.version, 2);
  assert.equal(state.active, true);
  assert.equal(roundScore(state.session), 1);
  assert.deepEqual(state.session.cards.map((card) => card.options), legacy.sessions["1"].cards.map((card) => card.options));
  assert.equal(learned(state, renitente), true);
  assert.equal(learned(state, other), false);
  const before = structuredClone(state.progress);
  answer(state, "relutante", NOW);
  assert.deepEqual(state.progress, before);
  next(state);
  answer(state, other.key, NOW); // An old parked card may now be early practice.
  assert.equal(roundScore(state.session), 2);
  assert.deepEqual(legacy, snapshot);
  oneCard(state, renitente);
  answer(state, null, NOW + 3 * DAY);
  assert.equal(learned(state, renitente), true);
});

test("all legacy parked rounds survive migration, JSON restore and sequential completion", () => {
  const a = levels[1].words[0], b = levels[2].words[0], c = levels[3].words[0];
  const session = (word, answered = false, replay = false) => ({
    cards: [{ id: word.id, options: [...word.choices].reverse() }],
    cursor: 0, answers: answered ? [word.key] : [], replay,
  });
  let state = restoreState({
    version: 1, progress: {}, active: "2",
    sessions: { "1": session(a, true), "2": session(b), "3": session(c, false, true) },
  });
  assert.equal(state.session.cards[0].id, b.id);
  completeRound(state, NOW);
  state = restoreState(JSON.parse(JSON.stringify(state)));
  start(state, NOW, rng);
  assert.equal(state.session.cards[0].id, a.id);
  assert.equal(roundScore(state.session), 1);
  const before = structuredClone(state.progress);
  answer(state, a.key, NOW);
  assert.deepEqual(state.progress, before);
  next(state);
  finish(state);
  start(state, NOW, rng);
  assert.equal(state.session.cards[0].id, c.id);
  assert.equal(state.session.cards[0].practice, true);
  answer(state, c.key, NOW);
  assert.deepEqual(state.progress, before);
  assert.equal(state.parkedSessions, undefined);
});

test("inactive legacy rounds and completed summaries resume without losing answers", () => {
  for (const cursor of [0, 1]) {
    const state = restoreState({
      version: 1, progress: {}, active: null,
      sessions: { "1": { cards: [{ id: first.id, options: first.choices }],
        cursor, answers: [first.key], replay: false } },
    });
    assert.equal(state.active, false);
    start(state, NOW, rng);
    assert.equal(state.session.cursor, cursor);
    assert.equal(roundScore(state.session), 1);
    assert.deepEqual(state.progress, {});
  }
});

test("migration derives due dates without a wall clock and handles invalid save shapes", () => {
  const state = restoreState({ version: 1, active: null, sessions: {}, progress: {
    [first.id]: { ...emptyProgress("0", first.id), seen: 1, lastSeen: NOW },
  } });
  assert.equal(state.progress[first.id].dueAt, NOW);
  for (const saved of [null, {}, { version: 3 }, { version: 2, progress: [] }])
    assert.deepEqual(restoreState(saved), fresh());
  const invalid = restoreState({ version: 2, progress: {}, active: true,
    session: { cards: [{ id: "missing", options: [] }], cursor: 0, answers: [] } });
  assert.equal(invalid.session, null);
  assert.equal(invalid.active, false);
});

test("all seen and none due permits flagged free practice without promotions or postponements", () => {
  const state = allSeen();
  const before = structuredClone(state.progress);
  start(state, NOW, rng);
  assert.equal(state.session.practice, true);
  assert.ok(state.session.cards.every((card) => card.practice));
  assert.equal(new Set(state.session.cards.map((card) => card.id)).size, 5);
  completeRound(state, NOW);
  assert.deepEqual(state.progress, before);
  assert.equal(words.some((word) => learned(state, word)), false);
});

test("a free-practice correction preserves the scheduled review across reload", () => {
  let state = allSeen();
  oneCard(state, first, true);
  const before = structuredClone(state.progress[first.id]);
  answer(state, null, NOW);
  next(state);
  state = restoreState(JSON.parse(JSON.stringify(state)));
  assert.equal(state.session.cards[1].correction, true);
  answer(state, first.key, NOW + DAY);
  assert.deepEqual(state.progress[first.id], before);
  assert.equal(roundScore(state.session), 0);
});

test("a practice card held past the real due time cannot satisfy or delay the review", () => {
  const state = allSeen();
  start(state, NOW, rng);
  const word = wordsById.get(state.session.cards[0].id);
  const before = structuredClone(state.progress[word.id]);
  answer(state, word.key, NOW + 2 * DAY);
  assert.deepEqual(state.progress[word.id], before);
  assert.equal(learned(state, word), false);
  next(state);
  answer(state, null, NOW + 2 * DAY);
  assert.equal(state.progress[state.session.cards[1].id].dueAt, NOW + DAY);
});

test("misses return once, in order, and remain due after a second miss", () => {
  const state = fresh();
  start(state, NOW, rng);
  const original = state.session.cards.map(card => card.id);
  for (const card of state.session.cards.slice()) {
    answer(state, null, NOW);
    next(state);
  }
  assert.deepEqual(state.session.cards.slice(5).map(card => card.id), original);
  for (const card of state.session.cards.slice(5)) {
    answer(state, null, NOW);
    next(state);
  }
  assert.equal(state.session.cards.length, 10);
  finish(state);
  start(state, NOW, rng);
  assert.deepEqual(new Set(state.session.cards.map(card => card.id)), new Set(original));
});

test("bands smaller than five do not deadlock or introduce harder words on the first draw", () => {
  const originalLevels = [...levels];
  const originalWords = new Map(wordsById);
  try {
    levels.splice(0, levels.length,
      { ...originalLevels[0], words: originalLevels[0].words.slice(0, 2) },
      { ...originalLevels[1], words: originalLevels[1].words.slice(0, 2) });
    wordsById.clear();
    for (const level of levels) for (const word of level.words) wordsById.set(word.id, word);
    const state = fresh();
    start(state, NOW, rng);
    assert.equal(state.session.cards.length, 2);
    assert.ok(state.session.cards.every((card) => wordsById.get(card.id).levelId === "0"));
    completeRound(state, NOW, () => null);
    start(state, NOW + 1, rng);
    assert.ok(state.session.cards.every(card => wordsById.get(card.id).levelId === "0"));
    completeRound(state, NOW + 1);
    start(state, NOW + 2, rng);
    assert.ok(state.session.cards.every(card => wordsById.get(card.id).levelId === "1"));
    completeRound(state, NOW + 2);
    start(state, NOW + 3, rng);
    assert.equal(state.session.practice, true);
  } finally {
    levels.splice(0, levels.length, ...originalLevels);
    wordsById.clear();
    for (const [id, word] of originalWords) wordsById.set(id, word);
  }
});

test("optional passes shrink to unresolved words, resume mid-pass, and preserve the first score", () => {
  let state = fresh();
  start(state, NOW, rng);
  const [a, b, c] = state.session.cards;
  function step(correct) {
    const card = state.session.cards[state.session.cursor];
    answer(state, correct ? card.key : null, NOW);
    next(state);
  }
  for (const card of state.session.cards.slice()) step(![a, b, c].includes(card));
  step(false);
  step(true);
  step(false);
  assert.deepEqual(missedWords(state.session).map(card => card.id), [a.id, c.id]);
  const score = roundScore(state.session);
  const streak = state.answerRun;
  retryMissed(state);
  step(true);
  state = restoreState(JSON.parse(JSON.stringify(state)));
  assert.equal(state.session.cards[state.session.cursor].id, c.id);
  step(false);
  retryMissed(state);
  assert.deepEqual(state.session.cards.slice(state.session.retryStart).map(card => card.id), [c.id]);
  step(true);
  assert.deepEqual(missedWords(state.session), []);
  assert.equal(roundScore(state.session), score);
  assert.equal(state.answerRun, streak);
  finish(state);
  assert.equal(state.session, null);
});

test("a correction counts as one discovery and a later scheduled recall earns mastery", () => {
  let state = fresh();
  for (const word of words.filter(w => w.id !== first.id).slice(0, 4))
    state.progress[word.id] = progress(word, { delayedReviews: 1 });
  oneCard(state);
  answer(state, null, NOW);
  next(state);
  answer(state, first.key, NOW);
  next(state);
  assert.equal(state.session.discoveries, 1);
  assert.equal(state.session.promotions ?? 0, 0);
  assert.deepEqual(state.session.collection, { total: collectionCounts(state).total, discovered: 5, mastered: 4 });
  state = restoreState(structuredClone(state));
  oneCard(state);
  answer(state, first.key, state.progress[first.id].dueAt);
  next(state);
  assert.equal(state.session.discoveries ?? 0, 0);
  assert.equal(state.session.promotions, 1);
  assert.equal(state.session.milestone, 5);
  assert.equal(state.session.collection.mastered, 5);
  assert.deepEqual(restoreState(state).session.collection, state.session.collection);
});

test("collection goals start small, grow and stop at the pack size", () => {
  assert.deepEqual([0, 4, 5, 9, 10, 24, 25, 50].map(n => nextMilestone(n, 61)), [5, 5, 10, 10, 25, 25, 50, 61]);
  assert.equal(nextMilestone(0, 3), 3);
});
