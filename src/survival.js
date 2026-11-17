import { shuffle } from "../vendor/openquiz/shuffle.ts";
import { seededRandom } from "./daily.js";

function pool(levels) {
  return levels.map(level => ({ ...level, words: level.words
    .filter(word => word.debutDay == null)
    .sort((a, b) => a.id < b.id ? -1 : Number(a.id > b.id)),
  })).filter(level => level.words.length);
}

/** Identify both the question content and the Survival rules used by a link. */
export function survivalVersion(levels) {
  const content = pool(levels).map(level => [level.id, level.words.map(word =>
    [word.id, word.word, word.key, word.choices, word.example])]);
  let hash = 2166136261;
  for (const character of JSON.stringify(content)) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619) >>> 0;
  }
  return "s1-" + hash.toString(16).padStart(8, "0");
}

/** Draw three words per introductory band, then all words in the hardest band. */
export function createSurvival(levels, seed, target = null) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Invalid challenge seed.");
  const bands = pool(levels);
  const random = seededRandom(seed);
  const cards = bands.flatMap((band, index) => {
    const words = shuffle(band.words, random);
    return (index === bands.length - 1 ? words : words.slice(0, 3)).map(word => ({
      id: word.id, word: word.word, levelId: word.levelId,
      key: word.key, example: word.example, options: shuffle(word.choices, random),
    }));
  });
  return { seed, version: survivalVersion(levels), target, cards, cursor: 0, answers: [] };
}

/** Restore saved question snapshots so an app update can preserve an unfinished run. */
export function restoreSurvival(saved) {
  if (!saved || !Number.isInteger(saved.seed) || saved.seed < 0 || saved.seed > 0xffffffff ||
    !/^s1-[a-f0-9]{8}$/.test(saved.version) || !Array.isArray(saved.cards) ||
    !saved.cards.length || !Array.isArray(saved.answers) ||
    !Number.isInteger(saved.cursor) || saved.cursor < 0 || saved.cursor > saved.cards.length ||
    saved.answers.length > saved.cards.length ||
    !saved.cards.every(card => card && [card.id, card.word, card.levelId, card.key, card.example]
      .every(value => typeof value === "string") && Array.isArray(card.options) &&
      card.options.length === 4 && card.options.every(value => typeof value === "string") &&
      new Set(card.options).size === 4 && card.options.includes(card.key)) ||
    new Set(saved.cards.map(card => card.id)).size !== saved.cards.length) return null;
  const missed = saved.answers.findIndex((value, index) => value !== saved.cards[index].key);
  if (missed >= 0 && missed !== saved.answers.length - 1) return null;
  if (!saved.answers.every((value, index) => value === null || saved.cards[index].options.includes(value))) return null;
  if (saved.cursor === saved.cards.length) {
    if (missed < 0 && saved.answers.length !== saved.cards.length) return null;
  } else if (saved.answers.length < saved.cursor || saved.answers.length > saved.cursor + 1 ||
    (missed >= 0 && missed !== saved.cursor)) return null;
  const target = Number.isInteger(saved.target) && saved.target >= 0 && saved.target <= saved.cards.length
    ? saved.target : null;
  return { ...saved, target, cards: saved.cards.map(card => ({ ...card, options: [...card.options] })), answers: [...saved.answers] };
}

/** Validate an invitation before starting or replacing a saved run. */
export function readChallenge(params, levels) {
  const seed = params.get("seed"), version = params.get("v"), score = params.get("score");
  if (!/^(0|[1-9]\d{0,9})$/.test(seed ?? "") || Number(seed) > 0xffffffff ||
    !/^s1-[a-f0-9]{8}$/.test(version ?? "") ||
    (score !== null && !/^(0|[1-9]\d{0,5})$/.test(score))) return { error: "invalidChallenge" };
  if (version !== survivalVersion(levels)) return { error: "oldChallenge" };
  const run = createSurvival(levels, Number(seed), score === null ? null : Number(score));
  if (run.target > run.cards.length) return { error: "invalidChallenge" };
  return { run };
}
