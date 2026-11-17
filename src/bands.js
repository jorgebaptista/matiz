export const dailyBandIds = ["0", "1", "2", "3"];

export function dailyBandsFor(levels) {
  const bands = dailyBandIds.map(id => levels.find(level => level.id === id));
  return bands.every(band => band?.words.length) ? bands : [];
}
