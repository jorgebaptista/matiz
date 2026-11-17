import { shuffle } from "../vendor/openquiz/shuffle.ts";
import { seededRandom } from "./daily.js";
import { survivalPool, survivalVersion } from "./survival-pack.js";
export { survivalVersion } from "./survival-pack.js";

/** Draw three words per introductory band, then all words in the hardest band. */
export function createSurvival(levels, seed, target = null) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Invalid challenge seed.");
  const bands = survivalPool(levels);
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

/** Index first attempts independently of whichever challenge is currently open. */
export const survivalId = run => `${run.version}:${run.seed}`;

/** Store only answers and position; archived packs supply the question snapshots. */
export function survivalAttempt(run) {
  const score = run.answers.filter((answer, index) => answer === run.cards[index].key).length;
  return { answers: [...run.answers], cursor: run.cursor, total: run.cards.length, score };
}

/** Discard malformed attempt records without losing valid results or ordinary progress. */
export function restoreAttempts(saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
  return Object.fromEntries(Object.entries(saved).filter(([key, attempt]) => {
    if (!/^s1-[a-f0-9]{8}:(0|[1-9]\d{0,9})$/.test(key) || Number(key.split(":")[1]) > 0xffffffff ||
      !attempt || !Array.isArray(attempt.answers) || !attempt.answers.every(value => value === null || typeof value === "string") ||
      !Number.isSafeInteger(attempt.total) || attempt.total <= 0 || attempt.answers.length > attempt.total ||
      !Number.isInteger(attempt.cursor) || attempt.cursor < 0 || attempt.cursor > attempt.total ||
      !Number.isInteger(attempt.score) || attempt.score < Math.max(0, attempt.answers.length - 1) ||
      attempt.score > attempt.answers.length) return false;
    if (attempt.cursor === attempt.total)
      return attempt.answers.length > 0 && (attempt.score < attempt.answers.length || attempt.answers.length === attempt.total);
    return attempt.answers.length === attempt.cursor || attempt.answers.length === attempt.cursor + 1;
  }));
}

/** Extend the first saved answer sequence; conflicting later answers cannot replace it. */
export function mergeAttempts(current, saved) {
  const merged = { ...current };
  for (const [key, previous] of Object.entries(saved)) {
    const next = merged[key];
    const extendsPrevious = next && next.total === previous.total && next.cursor >= previous.cursor &&
      next.answers.length >= previous.answers.length && previous.answers.every((answer, index) => next.answers[index] === answer);
    if (previous.cursor === previous.total || !extendsPrevious) merged[key] = previous;
  }
  return merged;
}

/** Validate an invitation before starting or replacing a saved run. */
export function readChallenge(params, levels, archives = {}) {
  const seed = params.get("seed"), version = params.get("v"), score = params.get("score");
  if (!/^(0|[1-9]\d{0,9})$/.test(seed ?? "") || Number(seed) > 0xffffffff ||
    !/^s1-[a-f0-9]{8}$/.test(version ?? "") ||
    (score !== null && !/^(0|[1-9]\d{0,5})$/.test(score))) return { error: "invalidChallenge" };
  const selected = version === survivalVersion(levels) ? levels : archives[version];
  if (!selected) return { error: "oldChallenge" };
  const run = createSurvival(selected, Number(seed), score === null ? null : Number(score));
  if (run.target > run.cards.length) return { error: "invalidChallenge" };
  return { run, levels: selected };
}
