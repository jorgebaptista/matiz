import test from "node:test";
import assert from "node:assert/strict";
import {
  levels,
  fresh,
  start,
  answer,
  next,
  finish,
  fixedCount,
  unlocked,
} from "../src/game.js";

test("a round saved before the editorial pack format resumes with its original word and choices", () => {
  const state = fresh();
  state.active = "1";
  state.sessions["1"] = {
    cards: [
      {
        id: "renitente",
        options: ["impaciente", "relutante", "distraído", "indeciso"],
      },
    ],
    answers: [],
    cursor: 0,
    replay: false,
  };
  start(state, levels[0]);
  answer(state, levels[0], "relutante");
  assert.equal(state.progress.renitente.box, 1);
  next(state, levels[0]);
  finish(state, levels[0]);
  assert.equal(state.active, null);
});
test("misses and skips return, a saved answer counts once, and review preserves mastery", () => {
  const state = fresh(),
    level = levels[0];
  start(state, levels[1]);
  assert.equal(state.active, null);
  let missed,
    seenAgain = false,
    answered = 0;
  while (!unlocked(state, levels[1])) {
    start(state, level, () => 0.23);
    const s = state.sessions[level.id];
    for (const card of s.cards) {
      const word = level.words.find((w) => w.id === card.id);
      if (!missed) {
        missed = word;
        answer(state, level, null);
      } else {
        if (missed.id === word.id) seenAgain = true;
        answer(state, level, word.key);
      }
      const before = structuredClone(state.progress);
      answer(state, level, word.key);
      assert.deepEqual(state.progress, before);
      next(state, level);
      assert.ok(++answered < level.words.length * 3 + 5);
    }
    finish(state, level);
  }
  assert.ok(seenAgain);
  assert.equal(fixedCount(state, level), level.words.length);
  const before = structuredClone(state.progress);
  start(state, level);
  assert.ok(state.sessions[level.id].replay);
  answer(state, level, null);
  assert.deepEqual(state.progress, before);
});
