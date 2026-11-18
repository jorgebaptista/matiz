import assert from "node:assert/strict";
import test from "node:test";
import { dailyDay } from "../src/daily.js";
import { completedDay, loadDays, streakCounts, streakPrefix } from "../src/streak.js";

test("today stays open until the next Lisbon midnight, including summer time", () => {
  const first = dailyDay(Date.parse("2026-06-01T22:59:00Z"));
  const today = dailyDay(Date.parse("2026-06-01T23:00:00Z"));
  assert.equal(today, first + 1);
  const days = new Set([first, first - 1, today + 9]);
  assert.deepEqual(streakCounts(days, today), { current: 2, best: 2, freezes: 2, protectedYesterday: false });
  assert.deepEqual(streakCounts(days, today + 1), { current: 2, best: 2, freezes: 1, protectedYesterday: true });
  days.add(today + 1);
  assert.deepEqual(streakCounts(days, today + 1), { current: 3, best: 3, freezes: 2, protectedYesterday: true });
});

test("completed legacy editions share a day, and partial or corrupt saves earn nothing", () => {
  const daily = { day: 21, cards: [1, 2, 3, 4], answers: [false, false, false, false] };
  assert.equal(completedDay({ ...daily, answers: [false] }), undefined);
  const storage = {
    "matiz.pt-PT.v1": JSON.stringify({ daily }),
    "matiz.en-GB.v1": JSON.stringify({ daily }),
    "matiz.es.v1": "bad",
    [streakPrefix + 20]: "1",
    getItem(key) { return this[key] ?? null; },
    setItem(key, value) { this[key] = value; },
  };
  assert.deepEqual(loadDays(storage), new Set([20, 21]));
  delete storage["matiz.pt-PT.v1"];
  delete storage["matiz.en-GB.v1"];
  assert.deepEqual(streakCounts(loadDays(storage), 21), { current: 2, best: 2, freezes: 2, protectedYesterday: false });
});

test("the first daily earns one freeze and playing again after a protected day replenishes it", () => {
  const days = new Set([1]);
  assert.equal(streakCounts(days, 1).freezes, 1);
  assert.deepEqual(streakCounts(days, 3), { current: 1, best: 1, freezes: 0, protectedYesterday: true });
  days.add(3);
  assert.deepEqual(streakCounts(days, 3), { current: 2, best: 2, freezes: 1, protectedYesterday: true });
});

test("two banked freezes protect two misses; a third miss breaks the streak", () => {
  const days = new Set([1, 2, 3]);
  assert.equal(streakCounts(days, 3).freezes, 2);
  assert.deepEqual(streakCounts(days, 6), { current: 3, best: 3, freezes: 0, protectedYesterday: true });
  assert.deepEqual(streakCounts(new Set([...days, 6]), 6), { current: 4, best: 4, freezes: 1, protectedYesterday: true });
  assert.deepEqual(streakCounts(days, 7), { current: 0, best: 3, freezes: 0, protectedYesterday: false });
  days.add(7);
  assert.deepEqual(streakCounts(days, 7), { current: 1, best: 3, freezes: 1, protectedYesterday: false });
});
