export const flamePath = "M21 1c2 9 13 12 12 23 2-2 3-5 3-7 3 5 4 10 3 15-1 9-9 15-19 15S1 40 1 30c0-7 4-13 9-18-1 7 2 10 4 11C12 14 20 10 21 1Z";
export const streakPrefix = "matiz.daily-day.";

export function streakCounts(days, today) {
  let best = 0, current = 0, freezes = 0, last;
  let lastProtectedDay = null;

  function coverMissedDays(through) {
    if (last === undefined || through <= last) return;
    const missed = through - last;
    if (missed > freezes) {
      current = 0;
      freezes = 0;
      lastProtectedDay = null;
    } else {
      freezes -= missed;
      lastProtectedDay = through;
    }
  }

  for (const day of [...days].filter(d => Number.isSafeInteger(d) && d <= today).sort((a, b) => a - b)) {
    coverMissedDays(day - 1);
    current++;
    freezes = Math.min(2, freezes + 1);
    best = Math.max(best, current);
    last = day;
  }
  // Today's puzzle can still be played.
  coverMissedDays(today - 1);
  return { current, best, freezes, protectedYesterday: lastProtectedDay === today - 1 };
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
