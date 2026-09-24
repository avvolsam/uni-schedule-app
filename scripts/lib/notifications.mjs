// Decides who should be notified after an hourly data refresh: compares the previous
// run's per-group schedule files with the fresh ones and writes a short message per
// changed group. Pure functions (no network, no filesystem) so they can be unit tested.

import { diffLessons, isEmptyDiff } from '../../shared/diffLessons.mjs';

const MONTHS = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
const MAX_BODY_LINES = 3;
const MAX_LINE_LENGTH = 90;

// If suspiciously much changes at once, it is far more likely that something went wrong
// (the site returned a partial answer, the parser broke, the academic-year date rule
// rolled over on 1 July) than that most of the university's schedule really changed in
// one hour. In that case we stay quiet rather than spam every student.
const MAX_SHARE_OF_GROUPS_CHANGED = 0.5;
const MIN_GROUPS_FOR_SHARE_CHECK = 20;
const MIN_SHARE_OF_DATA_REMAINING = 0.8;

function shortDate(iso) {
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]}`;
}

function startTime(time) {
  const m = /^(\d{1,2}:\d{2})/.exec(time || '');
  return m ? m[1] : '';
}

function truncate(text) {
  return text.length > MAX_LINE_LENGTH ? `${text.slice(0, MAX_LINE_LENGTH - 1)}…` : text;
}

function lessonLabel(l) {
  const time = startTime(l.time);
  return `${shortDate(l.date)}${time ? ` ${time}` : ''} ${l.subject || 'занятие'}`;
}

/** One short line per change, at most a few, then "…и ещё N". */
export function describeDiff(diff) {
  const lines = [
    ...diff.added.map((l) => `+ ${lessonLabel(l)}`),
    ...diff.removed.map((l) => `− ${lessonLabel(l)}`),
    ...diff.changed.map(({ before, after }) => {
      const parts = [];
      if ((before.room || '') !== (after.room || '')) parts.push(`ауд. ${before.room || '—'}→${after.room || '—'}`);
      if ((before.teacher || '') !== (after.teacher || '')) parts.push(`${before.teacher || '—'}→${after.teacher || '—'}`);
      if ((before.type || '') !== (after.type || '')) parts.push(`${before.type || '—'}→${after.type || '—'}`);
      return `~ ${lessonLabel(after)}${parts.length ? `: ${parts.join(', ')}` : ''}`;
    }),
  ];
  const shown = lines.slice(0, MAX_BODY_LINES).map(truncate);
  if (lines.length > MAX_BODY_LINES) shown.push(`…и ещё ${lines.length - MAX_BODY_LINES}`);
  return shown.join('\n');
}

/**
 * @param {Map<string, {groupCode:string, lessons:object[]}>} oldFiles previous run, by file slug
 * @param {Map<string, {groupCode:string, lessons:object[]}>} newFiles fresh data, by file slug
 * @param {string} todayIso yyyy-mm-dd; only lessons from this date on count
 * @returns {{groupCode:string, slug:string, title:string, body:string}[]}
 */
export function computeNotifications(oldFiles, newFiles, todayIso) {
  const result = [];
  for (const [slug, next] of newFiles) {
    const prev = oldFiles.get(slug);
    // No previous version = a group we have never seen: nothing to compare against.
    if (!prev) continue;
    // An empty answer is treated as a data problem, not as "everything was cancelled".
    if (next.lessons.length === 0) continue;

    const diff = diffLessons(prev.lessons, next.lessons, todayIso);
    if (isEmptyDiff(diff)) continue;

    result.push({
      groupCode: next.groupCode,
      slug,
      title: `Изменилось расписание ${next.groupCode}`,
      body: describeDiff(diff),
    });
  }
  return result;
}

/** Returns a reason string if this refresh looks broken and notifications should be held back. */
export function suspiciousReason(oldFiles, newFiles, notificationCount) {
  if (oldFiles.size === 0) return null;

  if (newFiles.size < oldFiles.size * MIN_SHARE_OF_DATA_REMAINING) {
    return `число групп упало с ${oldFiles.size} до ${newFiles.size}`;
  }
  const count = (files) => [...files.values()].reduce((n, f) => n + f.lessons.length, 0);
  const oldTotal = count(oldFiles);
  const newTotal = count(newFiles);
  if (oldTotal > 0 && newTotal < oldTotal * MIN_SHARE_OF_DATA_REMAINING) {
    return `число занятий упало с ${oldTotal} до ${newTotal}`;
  }
  if (
    newFiles.size >= MIN_GROUPS_FOR_SHARE_CHECK &&
    notificationCount > newFiles.size * MAX_SHARE_OF_GROUPS_CHANGED
  ) {
    return `изменились ${notificationCount} из ${newFiles.size} групп сразу`;
  }
  return null;
}
