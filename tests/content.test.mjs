import assert from "node:assert/strict";
import test from "node:test";
import { checkContent, readContent } from "../scripts/content.mjs";

const [pack, drafts] = await Promise.all([
  readContent("packs"),
  readContent("editorial"),
]);

test("the current pack and suggestion queue validate together", () => {
  const { pilot, reviewed, draft } = checkContent(pack, drafts);
  assert.equal(
    pilot + reviewed,
    pack.levels.flatMap((level) => level.words).length,
  );
  assert.equal(draft, drafts.words.length);
});

const candidate = {
  id: "novo",
  word: "novo",
  answer: "recente",
  alternatives: ["leve", "firme", "lento"],
  example: "É um fenómeno novo.",
  origin: "human-written",
  status: "draft",
  sense: "Que surgiu há pouco tempo.",
  references: ["https://dicionario.priberam.org/novo"],
  targetLevel: 2,
};
const first = {
  ...candidate,
  id: "antigo",
  word: "antigo",
  answer: "velho",
  status: "pilot",
};
const sample = {
  locale: "pt-PT",
  levels: [{ id: "1", name: "Primeiro", words: [first] }],
};

test("daily content requires a real date and exactly one word per band", () => {
  const broken = structuredClone(pack);
  const date = broken.levels[0].words.find(w => w.dailyOn).dailyOn;
  const word = broken.levels[1].words.find(w => w.dailyOn === date);
  word.dailyOn = "2026-02-30";
  assert.throws(() => checkContent(broken), /invalid daily debut/);
  delete word.dailyOn;
  assert.throws(() => checkContent(broken), /one daily debut per band/);
  broken.levels[0].words[0].dailyOn = date;
  assert.throws(() => checkContent(broken), /duplicate daily band/);
});

test("new levels accept reviewed questions and reviewed builds require review for every playable question", () => {
  const updated = structuredClone(sample);
  const words = [
    { ...candidate, status: "reviewed", reviewedBy: "test-reviewer" },
  ];
  updated.levels.push({ id: "2", name: "Segundo", words });
  assert.throws(
    () => checkContent(updated, null, { reviewedOnly: true }),
    /1 pilot/,
  );
  updated.levels[0].words[0] = {
    ...first,
    status: "reviewed",
    reviewedBy: "test-reviewer",
  };
  assert.equal(checkContent(updated, null, { reviewedOnly: true }).reviewed, 2);
  delete words[0].reviewedBy;
  assert.throws(() => checkContent(updated), /reviewer/);
});

test("drafts stay outside the game, and duplicated IDs or choices cannot slip in", () => {
  const queue = (card) => ({ locale: "pt-PT", words: [card] });
  assert.throws(
    () => checkContent(sample, queue({ ...candidate, id: first.id })),
    /duplicate ID/,
  );
  assert.throws(
    () => checkContent(sample, queue({ ...candidate, answer: "FIRME" })),
    /distinct/,
  );
  assert.throws(
    () => checkContent(sample, queue({ ...candidate, references: [] })),
    /reference/,
  );
  assert.throws(
    () =>
      checkContent({
        ...sample,
        levels: [{ ...sample.levels[0], words: [candidate] }],
      }),
    /status/,
  );
});
