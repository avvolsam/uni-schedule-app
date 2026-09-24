#!/usr/bin/env node
// Dev-only helper: writes fake but realistically-shaped data into public/data so the
// UI can be exercised with `npm run dev` without needing live network access to
// spb.ranepa.ru. NOT part of the build/deploy pipeline — run `npm run fetch-data`
// (or let CI do it) to get the real thing. Safe to delete public/data afterwards.

import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { buildDataset } from './lib/buildDataset.mjs';
import { groupCodeToFileSlug } from '../shared/groupSlug.mjs';
import {
  SEMESTER_TABLE_SUBSET,
  GIA_SINGLE_GROUP_TABLE,
  SESSION_SINGLE_GROUP_TABLE,
} from './lib/fixtures.mjs';

const DATA_DIR = path.resolve(process.cwd(), 'public/data');
const SCHEDULE_DIR = path.join(DATA_DIR, 'schedule');

const posts = [
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

const taxonomies = {
  level: [
    { id: 1, name: 'Бакалавриат', slug: 'bakalavriat', parent: 0 },
    { id: 2, name: 'Экономика (бакалавриат)', slug: 'ekonomika-bakalavriat', parent: 1 },
    { id: 3, name: 'Экономика предприятий и организаций', slug: 'ekonomika-predpriyatij', parent: 2 },
    { id: 680, name: 'Аспирантура', slug: 'aspirantura', parent: 0 },
    { id: 275, name: 'Экономика (аспирантура)', slug: 'ekonomika-aspirantura', parent: 680 },
    { id: 629, name: 'Региональная и отраслевая экономика', slug: 'regionalnaya-ekonomika', parent: 275 },
    { id: 630, name: 'Финансы', slug: 'finansy-aspirantura', parent: 275 },
  ],
  course: [
    { id: 321, name: '3 курс', slug: '3-kurs', parent: 0 },
    { id: 320, name: '2 курс', slug: '2-kurs', parent: 0 },
    { id: 10, name: '3 курс', slug: '3-kurs-b', parent: 0 },
  ],
  form: [{ id: 324, name: 'Очная', slug: 'ochnaya', parent: 0 }, { id: 20, name: 'Очная', slug: 'ochnaya-b', parent: 0 }],
  month: [
    { id: 377, name: 'ГИА', slug: 'gia', parent: 0 },
    { id: 378, name: 'Сессия', slug: 'sessiya', parent: 0 },
    { id: 30, name: 'Семестр', slug: 'semestr', parent: 0 },
  ],
};

async function main() {
  const { groupsJson, taxonomiesJson, directionsJson, scheduleFiles, metaJson } = buildDataset(
    posts,
    taxonomies,
    new Date()
  );

  // The fixtures' dates are in the past by now; give ЭК-3-24-03 a few upcoming lessons
  // (relative to today) so the UI has something to show.
  const slug03 = groupCodeToFileSlug('ЭК-3-24-03');
  const iso = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const base = { groupCode: 'ЭК-3-24-03', dayOfWeek: null, position: 'доц.' };
  scheduleFiles.set(slug03, {
    groupCode: 'ЭК-3-24-03',
    generatedAt: new Date().toISOString(),
    lessons: [
      { ...base, date: iso(1), time: '08:30-11:20', type: 'Л', subject: 'Маркетинг', teacher: 'Минаев Д.В.', room: '313' },
      { ...base, date: iso(1), time: '12:00-14:50', type: 'ПЗ', subject: 'Бухгалтерский учет и анализ', teacher: 'Баклановская Д.И.', room: '302' },
      { ...base, date: iso(3), time: '08:30-11:20', type: 'ПЗ', subject: 'Английский язык в профессиональной сфере', teacher: 'Щербакова В.С.', room: '212' },
    ],
  });

  await rm(DATA_DIR, { recursive: true, force: true });
  await mkdir(SCHEDULE_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, 'groups.json'), JSON.stringify(groupsJson, null, 2));
  await writeFile(path.join(DATA_DIR, 'taxonomies.json'), JSON.stringify(taxonomiesJson, null, 2));
  await writeFile(path.join(DATA_DIR, 'directions.json'), JSON.stringify(directionsJson, null, 2));
  await writeFile(path.join(DATA_DIR, 'meta.json'), JSON.stringify(metaJson, null, 2));
  for (const [fileSlug, data] of scheduleFiles) {
    await writeFile(path.join(SCHEDULE_DIR, `${fileSlug}.json`), JSON.stringify(data, null, 2));
  }
  console.log(`Seeded ${scheduleFiles.size} sample group schedules into public/data`);
}

main();
