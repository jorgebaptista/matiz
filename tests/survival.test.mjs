import assert from "node:assert/strict";
import test from "node:test";
import { createSurvival, restoreSurvival, survivalVersion, readChallenge, restoreAttempts } from "../src/survival.js";
import { fresh, levels, start, startDaily, startSurvival, answer, next, roundScore, restoreState, reconcileSurvival } from "../src/game.js";
import { survivalShareText } from "../src/share.js";

test("a seed reproduces both question and choice order, with a gradual, unique deck", () => {
  const run = createSurvival(levels, 12345);
  assert.deepEqual(run, createSurvival(levels, 12345));
  assert.notDeepEqual(run.cards, createSurvival(levels, 54321).cards);
  assert.equal(new Set(run.cards.map(card => card.id)).size, run.cards.length);
  assert.deepEqual(run.cards.slice(0, 12).map(card => card.levelId), ["0", "0", "0", "1", "1", "1", "2", "2", "2", "3", "3", "3"]);
  const regular = levels.flatMap(level => level.words.filter(word => word.debutDay == null));
  assert.ok(run.cards.every(card => regular.some(word => word.id === card.id)));
  assert.ok(run.cards.every(card => card.options.length === 4 && card.options.includes(card.key)));
  assert.equal(run.cards.length, 9 + regular.filter(word => word.levelId === "3").length);
  const tiny = [{ ...levels[0], words: levels[0].words.slice(0, 1) }];
  assert.equal(createSurvival(tiny, 0).cards.length, 1);
  for (const seed of [-1, 1.5, 0x100000000, "12"]) assert.throws(() => createSurvival(levels, seed));
});

test("one mistake or skip ends a run, preserves feedback and cannot count twice", () => {
  for (const skip of [true, false]) {
    let state = fresh();
    start(state);
    startDaily(state);
    const baseline = restoreState(JSON.parse(JSON.stringify(state)));
    const practice = JSON.stringify(baseline.session), daily = JSON.stringify(baseline.daily);
    startSurvival(state, 7);
    const first = state.survival.cards[0];
    answer(state, first.key);
    answer(state, first.key);
    next(state);
    const card = state.survival.cards[1];
    answer(state, skip ? null : card.options.find(option => option !== card.key));
    state = restoreState(JSON.parse(JSON.stringify(state)));
    assert.equal(state.survival.cursor, 1);
    assert.equal(roundScore(state.survival), 1);
    next(state);
    assert.equal(state.survival.cursor, state.survival.cards.length);
    answer(state, first.key);
    next(state);
    assert.equal(state.survival.answers.length, 2);
    assert.equal(state.survivalBests[state.survival.version], 1);
    assert.deepEqual(state.progress, {});
    assert.equal(JSON.stringify(state.session), practice);
    assert.equal(JSON.stringify(state.daily), daily);
    assert.ok(restoreSurvival(state.survival));
    startSurvival(state, 8);
    answer(state, null);
    next(state);
    assert.equal(state.survivalBests[state.survival.version], 1);
  }
});

test("clearing the deck gives one point per word and saves the personal best", () => {
  let state = fresh();
  startSurvival(state, 0);
  for (const card of state.survival.cards) {
    answer(state, card.key);
    next(state);
  }
  state = restoreState(JSON.parse(JSON.stringify(state)));
  assert.equal(roundScore(state.survival), state.survival.cards.length);
  assert.equal(state.survival.cursor, state.survival.cards.length);
  assert.equal(state.survivalBests[state.survival.version], state.survival.cards.length);
});

test("a shared invitation reproduces the run, target and version without answer spoilers", () => {
  const state = fresh();
  startSurvival(state, 42);
  answer(state, state.survival.cards[0].key);
  next(state);
  assert.throws(() => survivalShareText(state.survival, "https://example.test/jogar/"));
  answer(state, null);
  next(state);
  const text = survivalShareText(state.survival, "https://example.test/matiz/jogar/?old=1#old");
  const url = new URL(text.split("\n").at(-1));
  const invitation = readChallenge(url.searchParams, levels);
  assert.deepEqual(invitation.run.cards, state.survival.cards);
  assert.equal(invitation.run.target, 1);
  assert.equal(url.hash, "");
  assert.equal(url.searchParams.has("old"), false);
  assert.match(text, /Acertei 1 palavra/);
  for (const card of state.survival.cards) assert.ok(!text.includes(card.key));
  for (const [key, value] of [["seed", "-1"], ["seed", "4294967296"], ["score", "999999"], ["v", "oops"]]) {
    const params = new URLSearchParams(url.search);
    params.set(key, value);
    assert.equal(readChallenge(params, levels).error, "invalidChallenge");
  }
  url.searchParams.set("v", "s1-00000000");
  assert.equal(readChallenge(url.searchParams, levels).error, "oldChallenge");
});

test("pack edits invalidate new invitations while saved runs retain their original questions", () => {
  const run = createSurvival(levels, 10);
  const edited = structuredClone(levels);
  edited[0].words[0].phrase = "a different reading";
  assert.notEqual(survivalVersion(edited), run.version);
  delete edited[0].words[0].phrase;
  edited[0].words[0].key = "edited answer";
  assert.notEqual(survivalVersion(edited), run.version);
  assert.deepEqual(restoreSurvival(JSON.parse(JSON.stringify(run))), run);
  for (const change of [
    run => { run.cards[0].options = []; },
    run => { run.cursor = run.cards.length; },
    run => { run.answers = [null, run.cards[1].key]; run.cursor = 2; },
    run => { run.cards[1] = run.cards[0]; },
  ]) {
    const broken = structuredClone(run);
    change(broken);
    assert.equal(restoreSurvival(broken), null);
  }
});

test("reopening a challenge keeps its first result after other runs and reloads", () => {
  let state = fresh();
  startSurvival(state, 42);
  answer(state, state.survival.cards[0].key);
  next(state);
  answer(state, null);
  next(state);
  const original = structuredClone(state.survival);
  startSurvival(state, 123);
  answer(state, state.survival.cards[0].key);
  next(state);
  state = restoreState(JSON.parse(JSON.stringify(state)));
  startSurvival(state, 42);
  assert.deepEqual(state.survival, original);
  answer(state, state.survival.cards[0].key);
  assert.equal(roundScore(state.survival), 1);
  startSurvival(state, 123);
  assert.equal(state.survival.cursor, 1);
  assert.equal(roundScore(state.survival), 1);
});

test("Play again draws a fresh seed even if the random source repeats", t => {
  const state = fresh();
  startSurvival(state, 42);
  const original = structuredClone(state.survival.cards);
  answer(state, null);
  next(state);
  t.mock.method(crypto, "getRandomValues", array => { array[0] = 42; return array; });
  state.survival = null;
  startSurvival(state);
  assert.equal(state.survival.seed, 43);
  assert.notDeepEqual(state.survival.cards, original);
});

test("older saves migrate their current run into the first-attempt history", () => {
  const state = fresh();
  startSurvival(state, 19);
  answer(state, null);
  next(state);
  delete state.survivalAttempts;
  const restored = restoreState(state);
  startSurvival(restored, 20);
  startSurvival(restored, 19);
  assert.equal(restored.survival.cursor, restored.survival.cards.length);
  assert.equal(roundScore(restored.survival), 0);
  assert.deepEqual(restoreAttempts({ bad: null }), {});
});

test("a stale tab cannot replace the first answer, finished score or best", () => {
  const first = fresh();
  startSurvival(first, 3);
  const stale = structuredClone(first);
  answer(first, null);
  next(first);
  answer(stale, stale.survival.cards[0].key);
  next(stale);
  reconcileSurvival(stale, first);
  assert.equal(roundScore(stale.survival), 0);
  assert.equal(stale.survival.cursor, stale.survival.cards.length);
  assert.equal(stale.survivalBests[stale.survival.version], 0);
});
