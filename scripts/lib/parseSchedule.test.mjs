import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTableRows,
  extractGroupCodesFromPost,
  parsePostToLessons,
  resolveAcademicDate,
} from '../../shared/parseSchedule.mjs';
import {
  SEMESTER_TABLE_SUBSET,
  GIA_SINGLE_GROUP_TABLE,
  SESSION_SINGLE_GROUP_TABLE,
} from './fixtures.mjs';

test('parseTableRows maps columns by header text regardless of order', () => {
  const rows = parseTableRows(GIA_SINGLE_GROUP_TABLE);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].dateNum, '24');
  assert.equal(rows[0].monthNum, '9');
  assert.equal(rows[0].dayOfWeek, 'Чт.');
  assert.equal(rows[0].groups, 'ЭК-6-23-01');
  assert.equal(rows[0].type, 'ИА');
  assert.equal(rows[0].teacher, 'Комиссия ..');
});

test('extractGroupCodesFromPost splits shared-lecture rows into individual subgroups', () => {
  const rows = parseTableRows(SEMESTER_TABLE_SUBSET);
  const rawGroups = rows.map((r) => r.groups);
  const codes = extractGroupCodesFromPost(rawGroups);
  assert.deepEqual(codes.sort(), ['ЭК-3-24-03', 'ЭК-3-24-04']);
});

test('parsePostToLessons expands a shared lecture into one lesson per subgroup', () => {
  const { lessons, groupCodes } = parsePostToLessons(SEMESTER_TABLE_SUBSET, new Date('2026-09-01'));
  assert.deepEqual(groupCodes.sort(), ['ЭК-3-24-03', 'ЭК-3-24-04']);

  const sharedLectureLessons = lessons.filter((l) => l.subject.includes('Цифровое общество'));
  assert.equal(sharedLectureLessons.length, 2, 'shared lecture should appear for both subgroups');
  assert.deepEqual(
    sharedLectureLessons.map((l) => l.groupCode).sort(),
    ['ЭК-3-24-03', 'ЭК-3-24-04']
  );

  const englishFor04 = lessons.filter(
    (l) => l.subject.includes('Английский') && l.groupCode === 'ЭК-3-24-04'
  );
  assert.equal(englishFor04.length, 1);
  assert.equal(englishFor04[0].teacher, 'Каримова К.С.');

  const englishFor03 = lessons.filter(
    (l) => l.subject.includes('Английский') && l.groupCode === 'ЭК-3-24-03'
  );
  assert.equal(englishFor03.length, 1);
  assert.equal(englishFor03[0].teacher, 'Щербакова В.С.');
});

test('single-group post (no combined codes) still parses cleanly', () => {
  const { lessons, groupCodes } = parsePostToLessons(SESSION_SINGLE_GROUP_TABLE, new Date('2026-09-01'));
  assert.deepEqual(groupCodes, ['ЭК-6-24-03']);
  assert.equal(lessons.length, 2);
  assert.equal(lessons[0].position, 'проф.');
  assert.equal(lessons[1].position, null);
});

test('resolveAcademicDate maps Sep-Dec to the starting year and Jan-Jun to the next', () => {
  const ref = new Date('2026-09-01');
  assert.equal(resolveAcademicDate('02', '09', ref), '2026-09-02');
  assert.equal(resolveAcademicDate('15', '12', ref), '2026-12-15');
  assert.equal(resolveAcademicDate('20', '01', ref), '2027-01-20');
  assert.equal(resolveAcademicDate('15', '06', ref), '2027-06-15');
});

test('parsePostToLessons resolves dates using the header-mapped day/month columns', () => {
  const { lessons } = parsePostToLessons(SEMESTER_TABLE_SUBSET, new Date('2026-09-01'));
  const first = lessons.find((l) => l.subject.includes('Цифровое общество'));
  assert.equal(first.date, '2026-09-02');
});
