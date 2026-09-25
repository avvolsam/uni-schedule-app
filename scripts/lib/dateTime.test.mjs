import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTime, parseDateCell, parseMonthCell, parseWeekday, resolveDate } from '../../shared/dateTime.mjs';

test('date cells in every format seen on the site', () => {
  assert.deepEqual(parseDateCell('03'), { day: 3, month: null, year: null });
  assert.deepEqual(parseDateCell('21.09.2026'), { day: 21, month: 9, year: 2026 });
  assert.deepEqual(parseDateCell('22.09.'), { day: 22, month: 9, year: null });
  assert.deepEqual(parseDateCell('05.10.26'), { day: 5, month: 10, year: 2026 });
  assert.deepEqual(parseDateCell('30.11.2026 12'), { day: 30, month: 11, year: 2026 });
  assert.deepEqual(parseDateCell('5/18/2026'), { day: 18, month: 5, year: 2026 });
  assert.deepEqual(parseDateCell('7 октября'), { day: 7, month: 10, year: null });
  assert.equal(parseDateCell(''), null);
  assert.equal(parseDateCell('Лекция'), null);
});

test('month cells', () => {
  assert.equal(parseMonthCell('9'), 9);
  assert.equal(parseMonthCell('09'), 9);
  assert.equal(parseMonthCell('сентября'), 9);
  assert.equal(parseMonthCell('13'), null);
});

test('weekday names in short and long form', () => {
  assert.equal(parseWeekday('Пн.'), 0);
  assert.equal(parseWeekday('Понедельник'), 0);
  assert.equal(parseWeekday('Чт.'), 3);
  assert.equal(parseWeekday('суббота'), 5);
  assert.equal(parseWeekday('Вс'), 6);
  assert.equal(parseWeekday('Время'), null);
});

test('an explicit year is used as written', () => {
  assert.equal(resolveDate({ day: 21, month: 9, year: 2026 }, null, new Date('2026-01-01')), '2026-09-21');
  assert.equal(resolveDate({ day: 31, month: 2, year: 2026 }, null, new Date('2026-01-01')), null);
});

test('without a year the weekday picks the right one', () => {
  // 19 September 2026 is a Saturday; 19 September 2025 is a Friday; 2027 a Sunday.
  const anchor = new Date('2026-09-15');
  assert.equal(resolveDate({ day: 19, month: 9, year: null }, 5, anchor), '2026-09-19');
  // A spring table edited in September: the weekday still says 2026, not 2027.
  // 21 March 2026 is a Saturday.
  assert.equal(resolveDate({ day: 21, month: 3, year: null }, 5, anchor), '2026-03-21');
});

test('without a year or weekday the year nearest the edit date is used', () => {
  assert.equal(resolveDate({ day: 15, month: 1, year: null }, null, new Date('2026-08-26')), '2027-01-15');
  assert.equal(resolveDate({ day: 2, month: 9, year: null }, null, new Date('2026-08-26')), '2026-09-02');
  assert.equal(resolveDate({ day: 20, month: 5, year: null }, null, new Date('2026-02-10')), '2026-05-20');
});

test('29 February only exists in leap years', () => {
  assert.equal(resolveDate({ day: 29, month: 2, year: null }, null, new Date('2027-10-01')), '2028-02-29');
});

test('times in every format seen on the site', () => {
  assert.equal(normalizeTime('08:30-11:20'), '08:30-11:20');
  assert.equal(normalizeTime('8.00-9.00'), '08:00-09:00');
  assert.equal(normalizeTime('16.30-19.40'), '16:30-19:40');
  assert.equal(normalizeTime('12.00'), '12:00');
  assert.equal(normalizeTime('18:00'), '18:00');
  assert.equal(normalizeTime('19_30'), '19:30');
  assert.equal(normalizeTime('11-00'), '11:00');
  assert.equal(normalizeTime('15.00-17:50'), '15:00-17:50');
  assert.equal(normalizeTime('10:00-13.00'), '10:00-13:00');
  assert.equal(normalizeTime(''), null);
  assert.equal(normalizeTime('—'), null);
});
