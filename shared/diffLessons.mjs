// Compares two versions of a group's schedule and reports what changed, so the app can
// tell the student "your schedule changed" instead of silently swapping the data.
//
// A lesson is identified by (date, start time, subject). Same identity but different
// teacher/room/type/position => "changed". Identity only in the new list => "added";
// only in the old list => "removed". A lesson moved to another time therefore shows up
// as one removal plus one addition, which is exactly how a student would read it.

const CHANGEABLE_FIELDS = ['teacher', 'room', 'type', 'position'];

function startTime(time) {
  const m = /^(\d{1,2}:\d{2})/.exec(time || '');
  return m ? m[1] : '';
}

function lessonKey(l) {
  return `${l.date}|${startTime(l.time)}|${(l.subject || '').trim()}`;
}

function groupByKey(lessons) {
  const map = new Map();
  for (const l of lessons) {
    const k = lessonKey(l);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(l);
  }
  return map;
}

/**
 * @param {object[]} oldLessons
 * @param {object[]} newLessons
 * @param {string} fromDate ISO yyyy-mm-dd; lessons before it are ignored (past lessons
 *   dropping off the schedule is not a "change" the student cares about)
 */
export function diffLessons(oldLessons, newLessons, fromDate) {
  const relevant = (l) => l.date && l.date >= fromDate;
  const oldMap = groupByKey(oldLessons.filter(relevant));
  const newMap = groupByKey(newLessons.filter(relevant));

  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, newList] of newMap) {
    const oldList = oldMap.get(key) || [];
    newList.forEach((after, i) => {
      const before = oldList[i];
      if (!before) {
        added.push(after);
      } else if (CHANGEABLE_FIELDS.some((f) => (before[f] || '') !== (after[f] || ''))) {
        changed.push({ before, after });
      }
    });
  }
  for (const [key, oldList] of oldMap) {
    const newList = newMap.get(key) || [];
    oldList.slice(newList.length).forEach((before) => removed.push(before));
  }

  const byDateTime = (a, b) =>
    `${a.date} ${startTime(a.time)}`.localeCompare(`${b.date} ${startTime(b.time)}`);
  added.sort(byDateTime);
  removed.sort(byDateTime);
  changed.sort((a, b) => byDateTime(a.after, b.after));

  return { added, removed, changed };
}

export function isEmptyDiff(diff) {
  return diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0;
}
