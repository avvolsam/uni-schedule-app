import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDataset } from './buildDataset.mjs';
import { groupCodeToFileSlug } from '../../shared/groupSlug.mjs';
import {
  SEMESTER_TABLE_SUBSET,
  GIA_SINGLE_GROUP_TABLE,
  SESSION_SINGLE_GROUP_TABLE,
} from './fixtures.mjs';

// Fake posts shaped like the real GET /wp-json/wp/v2/raspisanie response, reusing the
// exact taxonomy id/class_list values captured from the live API sample.
const FAKE_POSTS = [
  {
    id: 106473,
    slug: 'ek-3-24-01-semestr',
    content: { rendered: SEMESTER_TABLE_SUBSET },
    level: [1, 2, 3],
    'course-raspisanie': [10],
    'form-obuchenia': [20],
    'month-raspisanie': [30],
  },
  {
    id: 244572,
    slug: 'ek-6-23-01-gia',
    content: { rendered: GIA_SINGLE_GROUP_TABLE },
    level: [275, 629, 680],
    'course-raspisanie': [321],
    'form-obuchenia': [324],
    'month-raspisanie': [377],
  },
  {
    id: 244538,
    slug: 'ek-6-24-03-sessiya',
    content: { rendered: SESSION_SINGLE_GROUP_TABLE },
    level: [275, 630, 680],
    'course-raspisanie': [320],
    'form-obuchenia': [324],
    'month-raspisanie': [378],
  },
];

// Mirrors the real site's hierarchy shape: a shared top-level term, a shared
// mid-level "faculty" grouping, and one differing leaf term per direction.
const FAKE_TAXONOMIES = {
  level: [
    { id: 1, name: 'Бакалавриат', slug: 'bakalavriat', parent: 0 },
    { id: 2, name: 'Экономика (бакалавриат)', slug: 'ekonomika-bakalavriat', parent: 1 },
    { id: 3, name: 'Экономика предприятий и организаций', slug: 'ekonomika-predpriyatij', parent: 2 },
    { id: 680, name: 'Аспирантура', slug: 'aspirantura', parent: 0 },
    { id: 275, name: 'Экономика (аспирантура)', slug: 'ekonomika-aspirantura', parent: 680 },
    { id: 629, name: 'Региональная и отраслевая экономика', slug: 'regionalnaya-ekonomika', parent: 275 },
    { id: 630, name: 'Финансы', slug: 'finansy-aspirantura', parent: 275 },
  ],
  course: [{ id: 321, name: '3 курс', slug: '3-kurs', parent: 0 }],
  form: [{ id: 324, name: 'Очная', slug: 'ochnaya', parent: 0 }],
  month: [{ id: 377, name: 'ГИА', slug: 'gia', parent: 0 }],
};

test('buildDataset produces one groups.json entry per distinct group code', () => {
  const { groupsJson } = buildDataset(FAKE_POSTS, FAKE_TAXONOMIES, new Date('2026-09-01'));
  assert.deepEqual(
    Object.keys(groupsJson).sort(),
    ['ЭК-3-24-03', 'ЭК-3-24-04', 'ЭК-6-23-01', 'ЭК-6-24-03'].sort()
  );
  assert.equal(groupsJson['ЭК-6-23-01'].fileSlug, groupCodeToFileSlug('ЭК-6-23-01'));
});

test('buildDataset merges taxonomy ids across periods for the same group', () => {
  const { groupsJson } = buildDataset(FAKE_POSTS, FAKE_TAXONOMIES, new Date('2026-09-01'));
  assert.deepEqual(groupsJson['ЭК-6-24-03'].levelIds.sort(), [275, 630, 680]);
  assert.deepEqual(groupsJson['ЭК-6-24-03'].courseIds, [320]);
});

test('buildDataset sorts each group schedule file chronologically', () => {
  const { scheduleFiles } = buildDataset(FAKE_POSTS, FAKE_TAXONOMIES, new Date('2026-09-01'));
  const slug03 = groupCodeToFileSlug('ЭК-3-24-03');
  const file = scheduleFiles.get(slug03);
  assert.ok(file, 'schedule file for ЭК-3-24-03 should exist');
  const onlyDates = file.lessons.map((l) => l.date);
  for (let i = 1; i < onlyDates.length; i++) {
    assert.ok(onlyDates[i] >= onlyDates[i - 1], `lesson ${i} out of order: ${onlyDates[i - 1]} -> ${onlyDates[i]}`);
  }
});

test('buildDataset keeps distinct groups from different posts (GIA vs session) separate', () => {
  const { scheduleFiles } = buildDataset(FAKE_POSTS, FAKE_TAXONOMIES, new Date('2026-09-01'));
  const gia = scheduleFiles.get(groupCodeToFileSlug('ЭК-6-23-01'));
  const session = scheduleFiles.get(groupCodeToFileSlug('ЭК-6-24-03'));
  assert.equal(gia.lessons.length, 1);
  assert.equal(session.lessons.length, 2);
});

test('buildDataset finds the deepest (most specific) level term as each direction', () => {
  const { directionsJson } = buildDataset(FAKE_POSTS, FAKE_TAXONOMIES, new Date('2026-09-01'));
  const byId = new Map(directionsJson.map((d) => [d.id, d]));

  assert.equal(byId.get(3).name, 'Экономика предприятий и организаций');
  assert.deepEqual(byId.get(3).groupCodes, ['ЭК-3-24-03', 'ЭК-3-24-04']);
  assert.equal(
    byId.get(3).breadcrumb,
    'Бакалавриат → Экономика (бакалавриат) → Экономика предприятий и организаций'
  );

  assert.equal(byId.get(629).name, 'Региональная и отраслевая экономика');
  assert.deepEqual(byId.get(629).groupCodes, ['ЭК-6-23-01']);

  assert.equal(byId.get(630).name, 'Финансы');
  assert.deepEqual(byId.get(630).groupCodes, ['ЭК-6-24-03']);

  // The shared ancestor ids (680, 275, 1, 2) must NOT show up as their own direction.
  assert.equal(byId.has(680), false);
  assert.equal(byId.has(275), false);
  assert.equal(byId.has(1), false);
  assert.equal(byId.has(2), false);
});

test('buildDataset records which posts each group came from (for live refresh)', () => {
  const { groupsJson } = buildDataset(FAKE_POSTS, FAKE_TAXONOMIES, new Date('2026-09-01'));
  assert.deepEqual(groupsJson['ЭК-3-24-03'].postIds, [106473]);
  assert.deepEqual(groupsJson['ЭК-6-23-01'].postIds, [244572]);
});

test('buildDataset removes the same lesson listed in two overlapping posts', () => {
  const overlappingPost = { ...FAKE_POSTS[0], id: 555, slug: 'ek-3-24-mesyac' };
  const { scheduleFiles } = buildDataset(
    [FAKE_POSTS[0], overlappingPost],
    FAKE_TAXONOMIES,
    new Date('2026-09-01')
  );
  const single = buildDataset([FAKE_POSTS[0]], FAKE_TAXONOMIES, new Date('2026-09-01'));
  const slug = groupCodeToFileSlug('ЭК-3-24-03');
  assert.equal(scheduleFiles.get(slug).lessons.length, single.scheduleFiles.get(slug).lessons.length);
});

test('buildDataset reports parse failure count without throwing on malformed content', () => {
  const posts = [...FAKE_POSTS, { id: 999, slug: 'broken', content: { rendered: '<not-a-table>' } }];
  const { metaJson } = buildDataset(posts, FAKE_TAXONOMIES, new Date('2026-09-01'));
  assert.equal(metaJson.postCount, 4);
  // Malformed-but-tagless content just yields zero rows, not a thrown error.
  assert.equal(metaJson.parseFailures, 0);
});
