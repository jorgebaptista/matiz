export const streakPrefix = "matiz.daily-day.";

export function streakCounts(days, today) {
  let best = 0, current = 0, last;
  let freezeReady = false;
  let frozenDay = null;
  for (const day of [...days].filter(d => Number.isSafeInteger(d) && d <= today).sort((a, b) => a - b)) {
    if (day === last + 2 && freezeReady) {
      freezeReady = false;
      frozenDay = day - 1;
    } else if (day !== last + 1) {
      current = 0;
      freezeReady = false;
      frozenDay = null;
    }
    current++;
    if (current % 7 === 0) freezeReady = true;
    best = Math.max(best, current);
    last = day;
  }
  // Today is still playable. Only settle gaps through yesterday.
  if (last === today - 2 && freezeReady) {
    freezeReady = false;
    frozenDay = today - 1;
  } else if (last < today - 1) {
    current = 0;
    freezeReady = false;
    frozenDay = null;
  }
  return { current, best, freezeReady, protectedYesterday: frozenDay === today - 1 };
}

export function completedDay(daily) {
  if (Number.isSafeInteger(daily?.day) && daily.cards?.length === 4 && daily.answers?.length === 4)
    return daily.day;
}

// Separate keys let two tabs finish different puzzle dates without overwriting either.
export function loadDays(storage) {
  const days = new Set();
  for (const key of Object.keys(storage)) {
    if (key.startsWith(streakPrefix)) {
      const n = Number(key.slice(streakPrefix.length));
      if (Number.isSafeInteger(n) && key === streakPrefix + n) days.add(n);
    } else if (/^matiz\.[\w-]+\.v1$/.test(key)) {
      let save;
      try { save = JSON.parse(storage.getItem(key)); } catch { continue; }
      const day = completedDay(save?.daily);
      if (day !== undefined) days.add(day);
    }
  }
  for (const day of days) {
    if (storage.getItem(streakPrefix + day) === null) storage.setItem(streakPrefix + day, "1");
  }
  return days;
}
