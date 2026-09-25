import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDataset } from './buildDataset.mjs';
import { groupCodeToFileSlug } from '../../shared/groupSlug.mjs';
import { FIXTURES } from './fixtures.mjs';

// Posts shaped like GET /wp-json/wp/v2/raspisanie items, built from real table excerpts.
const post = (fixtureKey, extra) => {
  const f = FIXTURES[fixtureKey];
  return {
    id: f.postId,
    modified: f.modified,
    title: { rendered: f.title },
    content: { rendered: f.html },
    level: [],
    'course-raspisanie': [],
    'form-obuchenia': [],
    'month-raspisanie': [],
    ...extra,
  };
};

const TAXONOMIES = {
  level: [
    { id: 1, name: 'Бакалавриат', slug: 'b', parent: 0 },
    { id: 2, name: 'Экономика', slug: 'e', parent: 1 },
    { id: 3, name: 'Экономика предприятий', slug: 'ep', parent: 2 },
    { id: 4, name: 'Юриспруденция', slug: 'yu', parent: 1 },
  ],
  course: [{ id: 30, name: '3 курс', slug: '3', parent: 0 }],
  form: [{ id: 40, name: 'Очная', slug: 'o', parent: 0 }],
  month: [
    { id: 50, name: 'На семестр', slug: 's', parent: 0 },
    { id: 51, name: 'Дополнительная сессия', slug: 'ds', parent: 0 },
  ],
};

const REF = new Date('2026-09-25');

test('groups come from the posts with their real codes, and each gets a schedule file', () => {
  const { groupsJson, scheduleFiles } = buildDataset(
    [post('ekSemester', { level: [1, 2, 3], 'course-raspisanie': [30], 'form-obuchenia': [40], 'month-raspisanie': [50] })],
    TAXONOMIES,
    REF
  );
  assert.deepEqual(Object.keys(groupsJson).sort(), ['ЭК-3-24-03', 'ЭК-3-24-04']);
  assert.equal(groupsJson['ЭК-3-24-03'].fileSlug, groupCodeToFileSlug('ЭК-3-24-03'));
  assert.ok(groupsJson['ЭК-3-24-03'].lessonCount > 5);
  assert.deepEqual(groupsJson['ЭК-3-24-03'].courseIds, [30]);
  assert.ok(scheduleFiles.get(groupCodeToFileSlug('ЭК-3-24-03')).lessons.length > 5);
});

test('schedule files are sorted by date and time', () => {
  const { scheduleFiles } = buildDataset([post('ekSemester')], TAXONOMIES, REF);
  const lessons = scheduleFiles.get(groupCodeToFileSlug('ЭК-3-24-03')).lessons;
  for (let i = 1; i < lessons.length; i++) assert.ok(lessons[i].date >= lessons[i - 1].date);
});

test('re-sit ("Дополнительная сессия") posts are left out of every group\'s schedule', () => {
  const { groupsJson, metaJson } = buildDataset(
    [post('retake', { 'month-raspisanie': [51] }), post('ekSemester')],
    TAXONOMIES,
    REF
  );
  assert.equal(metaJson.skippedRetakePosts, 1);
  assert.equal(groupsJson['ГМУ-4-25-11'], undefined);
});

test('a group whose post has no table yet is listed, with zero lessons', () => {
  const { groupsJson, scheduleFiles, metaJson } = buildDataset([post('placeholderNoTable')], TAXONOMIES, REF);
  const g = groupsJson['ПЛ-6-24-02'];
  assert.equal(g.lessonCount, 0);
  assert.equal(g.lastLessonDate, null);
  assert.deepEqual(scheduleFiles.get(g.fileSlug).lessons, []);
  assert.equal(metaJson.emptyGroups, 1);
  assert.equal(metaJson.postsWithoutTable, 1);
});

test('lastLessonDate is the date of the group\'s last lesson', () => {
  const { groupsJson, scheduleFiles } = buildDataset([post('ekSemester')], TAXONOMIES, REF);
  const g = groupsJson['ЭК-3-24-03'];
  const lessons = scheduleFiles.get(g.fileSlug).lessons;
  assert.equal(g.lastLessonDate, lessons[lessons.length - 1].date);
});

test('the direction of a post is only given to the groups named in its title, not to guests in joint rows', () => {
  const html = `<table><thead><tr><th>Дата</th><th>Время</th><th>Группы</th><th>Предмет</th></tr></thead><tbody>
    <tr><td>05.10.2026</td><td>10.00</td><td>ЭК-3-24-03</td><td>Своя пара</td></tr>
    <tr><td>06.10.2026</td><td>10.00</td><td>ЮР-3-24-01</td><td>Совместная лекция</td></tr>
  </tbody></table>`;
  const { groupsJson, directionsJson } = buildDataset(
    [{ id: 1, modified: '2026-09-01', title: { rendered: 'ЭК-3-24-03' }, content: { rendered: html }, level: [1, 2, 3] }],
    TAXONOMIES,
    REF
  );
  assert.deepEqual(groupsJson['ЭК-3-24-03'].levelIds, [1, 2, 3]);
  // The guest group still gets the joint lecture, but not the economics direction.
  assert.equal(groupsJson['ЮР-3-24-01'].lessonCount, 1);
  assert.deepEqual(groupsJson['ЮР-3-24-01'].levelIds, []);
  assert.deepEqual(directionsJson.map((d) => d.id), [3]);
});

test('directions use the deepest level term and list their groups', () => {
  const { directionsJson } = buildDataset([post('ekSemester', { level: [1, 2, 3] })], TAXONOMIES, REF);
  assert.equal(directionsJson.length, 1);
  assert.equal(directionsJson[0].name, 'Экономика предприятий');
  assert.equal(directionsJson[0].breadcrumb, 'Бакалавриат → Экономика → Экономика предприятий');
  assert.deepEqual(directionsJson[0].groupCodes, ['ЭК-3-24-03', 'ЭК-3-24-04']);
});

test('the quality report counts repaired dates and unreadable tables', () => {
  const { metaJson } = buildDataset([post('ekSemester'), post('emptyHeader')], TAXONOMIES, REF);
  assert.equal(metaJson.datesRepaired, 1);
  assert.equal(metaJson.parseFailures, 0);
  assert.equal(metaJson.postCount, 2);
  // The empty-header table is a placeholder, so it is not reported as a broken layout.
  assert.deepEqual(metaJson.unrecognisedTables, []);
});

test('a layout that cannot be read is reported (with its headers) so it is noticed', () => {
  const html = '<table><thead><tr><th>Кто</th><th>Что</th><th>Где</th></tr></thead><tbody><tr><td>а</td><td>б</td><td>в</td></tr></tbody></table>';
  const { metaJson } = buildDataset(
    [{ id: 7, modified: '2026-09-01', title: { rendered: 'ЭК-3-24-03' }, content: { rendered: html } }],
    TAXONOMIES,
    REF
  );
  assert.equal(metaJson.unrecognisedTables.length, 1);
  assert.equal(metaJson.unrecognisedTables[0].postId, 7);
});
