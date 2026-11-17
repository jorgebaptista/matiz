export const dailyBandIds = ["0", "1", "2", "3"];

/** Convert editorial words to the shared game representation. */
export function gameLevels(pack) {
  return pack.levels.map(({ id, name, words }) => ({
    id, name,
    words: words.map(({ id: wordId, word, answer, alternatives, example, phrase, dailyOn }) => ({
      id: wordId, word, key: answer, choices: [answer, ...alternatives], example, levelId: id,
      ...(phrase ? { phrase } : {}),
      ...(dailyOn ? { debutDay: Date.parse(dailyOn) / 86_400_000 } : {}),
    })),
  }));
}

export function dailyBandsFor(levels) {
  const bands = dailyBandIds.map(id => levels.find(level => level.id === id));
  return bands.every(band => band?.words.length) ? bands : [];
}
