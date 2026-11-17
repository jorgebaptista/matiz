import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const filled = (value) => typeof value === "string" && value.trim().length > 0;
const fold = (value, locale) =>
  value.trim().normalize("NFC").toLocaleLowerCase(locale);

function requireContent(condition, message) {
  if (!condition) throw new Error(message);
}

export function checkContent(pack, drafts, { reviewedOnly = false } = {}) {
  requireContent(
    filled(pack.locale) &&
      Intl.getCanonicalLocales(pack.locale)[0] === pack.locale,
    "Expected a locale such as pt-PT.",
  );
  const counts = { pilot: 0, reviewed: 0, draft: 0 };
  const ids = new Set();
  const targets = new Set();
  function checkWord(card, allowed) {
    const label = card?.id ?? "(missing ID)";
    const check = (ok, why) => requireContent(ok, label + ": " + why);
    check(
      card &&
        filled(card.id) &&
        /^[\p{L}\p{N}_-]+$/u.test(card.id) &&
        !(card.id in Object.prototype),
      "invalid stable ID",
    );
    const id = fold(card.id, pack.locale);
    check(!ids.has(id), "duplicate ID");
    ids.add(id);
    check(
      [card.word, card.answer, card.example].every(filled),
      "supply the word, answer and an original example",
    );
    const target = fold(card.word, pack.locale);
    check(
      !targets.has(target),
      "duplicate target in a context-free synonym question",
    );
    targets.add(target);
    check(
      Array.isArray(card.alternatives) &&
        card.alternatives.length === 3 &&
        card.alternatives.every(filled),
      "expected three alternatives",
    );
    const choices = new Set(
      [card.answer, ...card.alternatives].map((v) => fold(v, pack.locale)),
    );
    check(
      choices.size === 4 && !choices.has(target),
      "choices must be distinct from each other and the target",
    );
    check(
      ["ai-drafted", "human-written"].includes(card.origin),
      "record who drafted the question",
    );
    check(
      allowed.includes(card.status),
      "unexpected editorial status " + card.status,
    );
    if (card.status !== "pilot") {
      check(filled(card.sense), "specify the intended sense");
      check(
        Array.isArray(card.references) &&
          card.references.length > 0 &&
          card.references.every(
            (url) =>
              filled(url) &&
              URL.canParse(url) &&
              new URL(url).protocol === "https:",
          ),
        "supply a reference link",
      );
    }
    if (card.status === "reviewed")
      check(filled(card.reviewedBy), "credit the PT-PT reviewer");
    counts[card.status]++;
  }

  requireContent(
    Array.isArray(pack.levels) && pack.levels.length > 0,
    "Expected at least one level.",
  );
  for (const [i, level] of pack.levels.entries()) {
    requireContent(
      level.id === String(i + 1) && filled(level.name),
      "Expected a named sequential level at " + (i + 1),
    );
    requireContent(
      Array.isArray(level.words) && level.words.length > 0,
      "Empty level " + level.id,
    );
    for (const card of level.words) checkWord(card, ["pilot", "reviewed"]);
  }
  if (drafts) {
    requireContent(
      drafts.locale === pack.locale && Array.isArray(drafts.words),
      "Draft locale or word list mismatch.",
    );
    for (const card of drafts.words) {
      checkWord(card, ["draft"]);
      requireContent(
        Number.isSafeInteger(card.targetLevel) && card.targetLevel > 0,
        card.id + ": choose a target level",
      );
    }
  }
  requireContent(
    !reviewedOnly || !counts.pilot,
    counts.pilot +
      " pilot questions still need a native-speaker review for a reviewed build.",
  );
  return counts;
}

export async function readContent(folder) {
  return JSON.parse(
    await readFile(
      new URL("../" + folder + "/pt-PT.json", import.meta.url),
      "utf8",
    ),
  );
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    const [pack, drafts] = await Promise.all([
      readContent("packs"),
      readContent("editorial"),
    ]);
    const counts = checkContent(pack, drafts, {
      reviewedOnly: process.argv.includes("--reviewed"),
    });
    console.log(
      pack.locale +
        ": " +
        counts.pilot +
        " pilot, " +
        counts.reviewed +
        " reviewed, " +
        counts.draft +
        " draft.",
    );
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
