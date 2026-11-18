export const streakPrefix = "matiz.daily-day.";

export function streakCounts(days, today) {
  let best = 0, run = 0, last;
  for (const day of [...days].filter(d => Number.isSafeInteger(d) && d <= today).sort((a,b) => a-b)) {
    run = day === last + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    last = day;
  }
  return { current: last >= today - 1 ? run : 0, best };
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
