import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffLessons, isEmptyDiff } from '../../shared/diffLessons.mjs';

const lesson = (over = {}) => ({
  groupCode: 'ЭК-3-24-03',
  date: '2026-10-05',
  dayOfWeek: 'Пн.',
  time: '08:30-11:20',
  type: 'ПЗ',
  subject: 'Маркетинг',
  position: 'проф.',
  teacher: 'Минаев Д.В.',
  room: '212',
  ...over,
});

test('identical schedules produce an empty diff', () => {
  const a = [lesson(), lesson({ date: '2026-10-06', subject: 'Учет' })];
  const diff = diffLessons(a, structuredClone(a), '2026-10-01');
  assert.equal(isEmptyDiff(diff), true);
});

test('a new lesson is reported as added', () => {
  const before = [lesson()];
  const after = [lesson(), lesson({ date: '2026-10-07', subject: 'Экономика' })];
  const diff = diffLessons(before, after, '2026-10-01');
  assert.equal(diff.added.length, 1);
  assert.equal(diff.added[0].subject, 'Экономика');
  assert.equal(diff.removed.length, 0);
});

test('a cancelled lesson is reported as removed', () => {
  const before = [lesson(), lesson({ date: '2026-10-07', subject: 'Экономика' })];
  const after = [lesson()];
  const diff = diffLessons(before, after, '2026-10-01');
  assert.equal(diff.removed.length, 1);
  assert.equal(diff.removed[0].subject, 'Экономика');
});

test('a room or teacher change is reported as changed, not add+remove', () => {
  const before = [lesson({ room: '212' })];
  const after = [lesson({ room: '305', teacher: 'Иванов И.И.' })];
  const diff = diffLessons(before, after, '2026-10-01');
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.changed[0].before.room, '212');
  assert.equal(diff.changed[0].after.room, '305');
  assert.equal(diff.added.length, 0);
  assert.equal(diff.removed.length, 0);
});

test('a lesson moved to another time is one removal plus one addition', () => {
  const before = [lesson({ time: '08:30-11:20' })];
  const after = [lesson({ time: '12:00-14:50' })];
  const diff = diffLessons(before, after, '2026-10-01');
  assert.equal(diff.removed.length, 1);
  assert.equal(diff.added.length, 1);
});

test('lessons before fromDate are ignored (past lessons dropping off is not a change)', () => {
  const before = [lesson({ date: '2026-09-02', subject: 'Старое' }), lesson()];
  const after = [lesson()];
  const diff = diffLessons(before, after, '2026-10-01');
  assert.equal(isEmptyDiff(diff), true);
});

test('same subject twice at the same slot is matched pairwise, extras are added/removed', () => {
  const a = lesson({ teacher: 'А' });
  const b = lesson({ teacher: 'Б' });
  const diff = diffLessons([a], [a, b], '2026-10-01');
  assert.equal(diff.added.length, 1);
  assert.equal(diff.added[0].teacher, 'Б');
});
