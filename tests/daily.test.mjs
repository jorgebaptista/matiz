import assert from "node:assert/strict";
import test from "node:test";
import { dailyCards, dailyDay } from "../src/daily.js";
import { fresh, levels, practiceLevels, wordsById, start, startDaily, answer, next, restoreState, roundScore } from "../src/game.js";

test("the shared date changes at Lisbon midnight in winter and summer", () => {
  for (const midnight of ["2026-11-18T00:00Z", "2026-07-17T23:00Z", "2026-03-29T23:00Z", "2026-10-26T00:00Z"]) {
    const time = Date.parse(midnight);
    assert.equal(dailyDay(time), dailyDay(time - 1) + 1);
  }
});

test("four ordered bands rotate through every word with reproducible options", () => {
  const day = dailyDay();
  const cards = dailyCards(levels, day);
  assert.deepEqual(cards, dailyCards(levels, day));
  assert.deepEqual(cards.map(c => wordsById.get(c.id).levelId), ["0", "1", "2", "3"]);
  for (const [i, band] of levels.entries()) {
    const ids = new Set(band.words.map((_, offset) => dailyCards(levels, day + offset)[i].id));
    assert.equal(ids.size, band.words.length);
    assert.deepEqual(new Set(cards[i].options), new Set(wordsById.get(cards[i].id).choices));
  }
});

test("daily feedback, completion and tomorrow's draw preserve the parked practice round", () => {
  const today = Date.parse("2026-11-17T12:00Z");
  let state = fresh();
  start(state, today);
  answer(state, null, today);
  const practice = structuredClone(state.session), progress = structuredClone(state.progress);
  startDaily(state, today);
  const first = state.daily.cards.map(c => c.id);
  answer(state, null);
  state = restoreState(JSON.parse(JSON.stringify(state)));
  assert.equal(state.dailyActive, true);
  assert.deepEqual(state.daily.answers, [null]);
  answer(state, state.daily.cards[0].key);
  next(state);
  start(state);
  assert.deepEqual(state.session, practice);
  startDaily(state, today);
  while (state.daily.cursor < state.daily.cards.length) {
    answer(state, state.daily.cards[state.daily.cursor].key);
    next(state);
  }
  startDaily(state, today);
  assert.equal(roundScore(state.daily), 3);
  assert.equal(state.daily.cursor, 4);
  startDaily(state, today + 86400000);
  assert.equal(state.daily.cursor, 0);
  assert.notDeepEqual(state.daily.cards.map(c => c.id), first);
  assert.deepEqual(state.session, practice);
  assert.deepEqual(state.progress, progress);
});

test("a debut is exclusive that day, joins its own band tomorrow, and never leaks into an encore", () => {
  const state = fresh(), today = Date.parse("2026-11-17T12:00Z"), day = dailyDay(today);
  startDaily(state, today);
  assert.equal(state.daily.debut, true);
  const available = n => practiceLevels(n).flatMap(band => band.words.map(w => w.id));
  for (const card of state.daily.cards) {
    assert.ok(!available(day).includes(card.id));
    assert.ok(available(day + 1).includes(card.id));
    assert.equal(wordsById.get(card.id).debutDay, day);
  }
  state.daily.debut = false;
  answer(state, null);
  const started = structuredClone(state.daily);
  startDaily(state, today);
  assert.deepEqual(state.daily, started);
  startDaily(state, today - 86400000);
  assert.equal(state.daily.debut, false);
  assert.ok(state.daily.cards.every(c => available(day - 1).includes(c.id)));
});

test("every scheduled set is unique, then the entire calendar loops intact", () => {
  const state = fresh(), ids = new Set();
  const dates = levels[0].words.map(w => w.debutDay).filter(Number.isInteger).sort((a,b) => a-b);
  assert.ok(dates.length >= 30);
  const after = dates.at(-1) + 1;
  for (const [i, date] of dates.entries()) {
    startDaily(state, (date + 0.5) * 86400000);
    assert.equal(state.daily.debut, true);
    const original = state.daily.cards;
    for (const card of original) ids.add(card.id);
    startDaily(state, (after + i + 0.5) * 86400000);
    assert.equal(state.daily.debut, false);
    assert.deepEqual(state.daily.cards, original);
  }
  assert.equal(ids.size, dates.length * 4);
});
