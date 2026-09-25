// Removes exact-duplicate lessons (the same class can be listed in more than one post,
// e.g. a whole-semester table and a next-month table) and sorts chronologically.
// Shared by the build-time data script and the in-browser live refresh so both produce
// identical schedules.

function startTimeSortKey(time) {
  const m = /^(\d{1,2}):(\d{2})/.exec(time || '');
  if (!m) return 24 * 60;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function normalizeLessons(lessons) {
  const seen = new Set();
  const unique = [];
  for (const l of lessons) {
    const key = JSON.stringify([
      l.groupCode, l.subgroup, l.date, l.time, l.type, l.subject, l.position, l.teacher, l.room,
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(l);
  }
  return unique.sort((a, b) => {
    if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
    return startTimeSortKey(a.time) - startTimeSortKey(b.time);
  });
}
