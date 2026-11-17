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

test("pack has 60 distinct targets, four distinct choices and a PT-PT usage example each", () => {
  assert.deepEqual(
    levels.map((l) => l.words.length),
    [10, 20, 30],
  );
  const ids = new Set();
  for (const w of levels.flatMap((l) => l.words)) {
    assert.equal(ids.has(w.id), false);
    ids.add(w.id);
    assert.equal(
      new Set(w.choices.map((v) => v.toLocaleLowerCase("pt-PT"))).size,
      4,
    );
    const forms = [w.word, w.word.replace(/o$/, "a")];
    assert.ok(
      forms.some((form) => w.example.toLocaleLowerCase("pt-PT").includes(form)),
      w.word,
    );
  }
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
      assert.ok(++answered < 50);
    }
    finish(state, level);
  }
  assert.ok(seenAgain);
  assert.equal(fixedCount(state, level), 10);
  const before = structuredClone(state.progress);
  start(state, level);
  assert.ok(state.sessions[level.id].replay);
  answer(state, level, null);
  assert.deepEqual(state.progress, before);
});
