import assert from "node:assert/strict";
import { test } from "node:test";
import { dailyShareText } from "../src/share.js";
import { wordsById } from "../src/game.js";

test("daily sharing uses saved keys and date, counts skips as misses and hides answers", () => {
  const word = wordsById.values().next().value;
  const session = {
    day: Date.parse("2026-11-17") / 86_400_000,
    cards: [
      { id: word.id, key: "older answer" },
      { id: word.id, key: "correct" },
      { id: word.id },
      { id: word.id, key: "correct" },
    ],
    answers: ["older answer", "wrong", word.key, null],
  };
  const original = JSON.stringify(session);
  const text = dailyShareText(session, "https://example.test/matiz/daily/pt-PT/?old=1#fragment");
  assert.match(text, /Matiz · Palavras do dia · pt-PT/);
  assert.match(text, /17.*(?:nov|11).*2026/);
  assert.match(text, /🟩⬜🟩⬜ 2\/4/);
  assert.ok(text.endsWith("https://example.test/matiz/daily/pt-PT/"));
  for (const spoiler of [word.word, word.key, "older answer", "correct"])
    assert.ok(!text.includes(spoiler));
  assert.equal(JSON.stringify(session), original);
});

test("unfinished and empty dailies cannot be shared", () => {
  assert.throws(() => dailyShareText({ cards: [{}], answers: [] }, "https://example.test"));
  assert.throws(() => dailyShareText({ cards: [], answers: [] }, "https://example.test"));
});
