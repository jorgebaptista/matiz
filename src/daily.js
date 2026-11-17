import { shuffle } from "../vendor/openquiz/shuffle.ts";

const DAY = 86_400_000;
const calendar = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
});

/** Integer calendar day in Lisbon, including summer time. */
export function dailyDay(now = Date.now()) {
  const parts = Object.fromEntries(calendar.formatToParts(now).map(({ type, value }) => [type, value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / DAY;
}

// A reproducible Fisher-Yates shuffle on every JS runtime.
function random(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** Rotate through each band's entire shuffled deck before reusing a word. */
export function dailyCards(bands, day) {
  return bands.map((band, index) => {
    const deck = shuffle(band.words, random(31703 * (index + 1)));
    const word = deck[((day % deck.length) + deck.length) % deck.length];
    return { id: word.id, key: word.key, options: shuffle(word.choices, random(Math.imul(day, 2654435761) + index)) };
  });
}
