import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { dailyBandIds } from "../src/bands.js";

export const projectRoot = fileURLToPath(new URL("..", import.meta.url));
export const defaultLocale = "pt-PT";
const reference = JSON.parse(await readFile(new URL("../locales/pt-PT.json", import.meta.url), "utf8"));

const filled = (value) => typeof value === "string" && value.trim().length > 0;
const fold = (value, locale) =>
  value.trim().normalize("NFC").toLocaleLowerCase(locale);

function requireContent(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalLocale(value) {
  try {
    return filled(value) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value) &&
      Intl.getCanonicalLocales(value)[0] === value;
  } catch {
    return false;
  }
}

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const placeholders = (value) => [...value.matchAll(/\{([a-zA-Z]+)\}/g)]
  .map((match) => match[1]).sort().join(",");

/** Validate filename/metadata identity and the complete UI translation contract. */
export function checkLocale(pack, locale, filename = pack?.locale) {
  requireContent(canonicalLocale(filename), "Expected a canonical BCP47 filename such as pt-PT.json.");
  requireContent(pack?.locale === filename && locale?.locale === filename,
    filename + ": pack, locale metadata and filename must match.");
  for (const key of ["languageName", "title", "description"])
    requireContent(filled(locale[key]), filename + ": supply metadata " + key);
  requireContent(object(locale.strings), filename + ": expected UI strings.");
  const missing = Object.keys(reference.strings).filter((key) => !Object.hasOwn(locale.strings, key));
  const unknown = Object.keys(locale.strings).filter((key) => !Object.hasOwn(reference.strings, key));
  requireContent(!missing.length && !unknown.length,
    filename + ": UI keys must match locales/pt-PT.json; missing: " + missing.join(", ") + "; unknown: " + unknown.join(", "));
  const categories = new Intl.PluralRules(filename).resolvedOptions().pluralCategories;
  for (const [key, source] of Object.entries(reference.strings)) {
    const expected = placeholders(typeof source === "string" ? source : source.other);
    const message = locale.strings[key];
    const label = filename + ": " + key;
    const variants = typeof message === "string" ? [message] : object(message) ? Object.values(message) : [];
    requireContent(variants.length > 0, label + ": expected a string or plural forms.");
    if (typeof message !== "string") {
      requireContent(expected.split(",").includes("count"), label + ": plurals require {count}.");
      requireContent(categories.every((category) => filled(message[category])) &&
        Object.keys(message).every((category) => ["zero", "one", "two", "few", "many", "other"].includes(category)),
      label + ": supply plural forms " + categories.join(", ") + ".");
    }
    for (const variant of variants) {
      requireContent(filled(variant), label + ": empty translation.");
      requireContent(placeholders(variant) === expected && !/[{}]/.test(variant.replace(/\{[a-zA-Z]+\}/g, "")),
        label + ": placeholder names and counts must match (" + expected + ").");
    }
  }
}

export function checkContent(pack, drafts, { reviewedOnly = false } = {}) {
  requireContent(
    canonicalLocale(pack.locale),
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
      check(filled(card.reviewedBy), "credit the native-language reviewer");
    counts[card.status]++;
  }

  requireContent(
    Array.isArray(pack.levels) && pack.levels.length > 0,
    "Expected at least one level.",
  );
  const levelIds = new Set();
  const debutDates = new Map();
  for (const level of pack.levels) {
    requireContent(
      typeof level.id === "string" &&
        /^(0|[1-9]\d*)$/.test(level.id) &&
        !levelIds.has(level.id) &&
        filled(level.name),
      "Expected a named level with a unique numeric ID: " + level.id,
    );
    levelIds.add(level.id);
    requireContent(
      Array.isArray(level.words) && level.words.length > 0,
      "Empty level " + level.id,
    );
    for (const card of level.words) {
      checkWord(card, ["pilot", "reviewed"]);
      if (!Object.hasOwn(card, "dailyOn")) continue;
      const date = card.dailyOn;
      requireContent(dailyBandIds.includes(level.id) &&
        typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        Number.isFinite(Date.parse(date)) && new Date(date).toISOString().startsWith(date + "T"),
        card.id + ": invalid daily debut");
      if (!debutDates.has(date)) debutDates.set(date, new Set());
      const bands = debutDates.get(date);
      requireContent(!bands.has(level.id), date + ": duplicate daily band " + level.id);
      bands.add(level.id);
    }
    requireContent(level.words.some(card => !card.dailyOn), "Each level needs a regular practice word");
  }
  for (const [date, bands] of debutDates)
    requireContent(bands.size === dailyBandIds.length, date + ": expected one daily debut per band");
  if (drafts) {
    requireContent(
      drafts.locale === pack.locale && Array.isArray(drafts.words),
      "Draft locale or word list mismatch.",
    );
    for (const card of drafts.words) {
      checkWord(card, ["draft"]);
      requireContent(
        Number.isSafeInteger(card.targetLevel) && card.targetLevel >= 0,
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

export async function readContent(folder, locale = defaultLocale, root = projectRoot) {
  requireContent(canonicalLocale(locale), "Invalid locale " + locale);
  return JSON.parse(await readFile(path.join(root, folder, locale + ".json"), "utf8"));
}

async function jsonLocales(root, folder, optional = false) {
  try {
    return (await readdir(path.join(root, folder))).filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -5)).sort();
  } catch (error) {
    if (optional && error.code === "ENOENT") return [];
    throw error;
  }
}

/** Discover and validate all paired packs before any output is generated. */
export async function readLanguages({ root = projectRoot, reviewedOnly = false } = {}) {
  const [packs, locales, drafts] = await Promise.all([
    jsonLocales(root, "packs"), jsonLocales(root, "locales"), jsonLocales(root, "editorial", true),
  ]);
  requireContent(packs.includes(defaultLocale), "The default pt-PT pack is required.");
  requireContent(packs.join(",") === locales.join(","), "Every packs/<locale>.json needs a matching locales/<locale>.json, and vice versa.");
  requireContent(drafts.every((locale) => packs.includes(locale)), "Draft files need a matching playable pack.");
  return Promise.all(packs.map(async (id) => {
    const [pack, locale, draft] = await Promise.all([
      readContent("packs", id, root), readContent("locales", id, root),
      drafts.includes(id) ? readContent("editorial", id, root) : null,
    ]);
    checkLocale(pack, locale, id);
    requireContent(!drafts.includes(id) || object(draft), id + ": expected a draft object.");
    const counts = checkContent(pack, draft, { reviewedOnly });
    return { pack, locale, counts };
  }));
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    const languages = await readLanguages({
      reviewedOnly: process.argv.includes("--reviewed"),
    });
    for (const { pack, counts } of languages) console.log(
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
