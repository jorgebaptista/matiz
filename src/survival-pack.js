/** Keep a stable word order before applying a challenge seed. */
export function survivalPool(levels) {
  return levels.map(level => ({ ...level, words: level.words
    .filter(word => word.debutDay == null)
    .sort((a, b) => a.id < b.id ? -1 : Number(a.id > b.id)),
  })).filter(level => level.words.length);
}

/** Identify the question content and Survival draw rules used by a link. */
export function survivalVersion(levels) {
  const content = survivalPool(levels).map(level => [level.id, level.words.map(word =>
    [word.id, word.word, word.key, word.choices, word.example, ...(word.phrase ? [word.phrase] : [])])]);
  let hash = 2166136261;
  for (const character of JSON.stringify(content)) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619) >>> 0;
  }
  return "s1-" + hash.toString(16).padStart(8, "0");
}
