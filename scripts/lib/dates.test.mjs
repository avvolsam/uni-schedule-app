import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, isValidIso, startOfWeek, weekDays, weekdayIndex } from '../../shared/dates.mjs';

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('addDays is not thrown off by daylight-saving changes', () => {
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(addDays('2026-03-29', 7), '2026-04-05');
});

test('weekdayIndex counts Monday as 0 and Sunday as 6', () => {
  assert.equal(weekdayIndex('2026-09-21'), 0); // Monday
  assert.equal(weekdayIndex('2026-09-24'), 3); // Thursday
  assert.equal(weekdayIndex('2026-09-27'), 6); // Sunday
});

test('startOfWeek returns the Monday of the week', () => {
  assert.equal(startOfWeek('2026-09-24'), '2026-09-21');
  assert.equal(startOfWeek('2026-09-21'), '2026-09-21');
  assert.equal(startOfWeek('2026-09-27'), '2026-09-21'); // Sunday belongs to the week that began Monday
  assert.equal(startOfWeek('2027-01-01'), '2026-12-28');
});

test('weekDays lists seven consecutive days starting on Monday', () => {
  assert.deepEqual(weekDays('2026-09-24'), [
    '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27',
  ]);
});

test('isValidIso accepts real dates only', () => {
  assert.equal(isValidIso('2026-09-24'), true);
  assert.equal(isValidIso('2026-02-30'), false);
  assert.equal(isValidIso('24.09.2026'), false);
  assert.equal(isValidIso(''), false);
});
