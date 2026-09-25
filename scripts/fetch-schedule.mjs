#!/usr/bin/env node
// Fetches every schedule post from spb.ranepa.ru's WordPress REST API, parses each
// post's HTML table into per-group lessons, and writes the result as static JSON
// files under public/data/ for the frontend (and its service worker) to consume.
//
// Run manually with `npm run fetch-data`, or scheduled daily via
// .github/workflows/update-and-deploy.yml.

import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fetchAllPages } from './lib/wpApi.mjs';
import { buildDataset } from './lib/buildDataset.mjs';

const DATA_DIR = path.resolve(process.cwd(), 'public/data');
const SCHEDULE_DIR = path.join(DATA_DIR, 'schedule');

async function main() {
  console.log('Fetching schedule posts from spb.ranepa.ru ...');
  const posts = await fetchAllPages('raspisanie');
  console.log(`  ${posts.length} posts fetched`);

  console.log('Fetching taxonomies ...');
  const [level, course, form, month] = await Promise.all([
    fetchAllPages('level'),
    fetchAllPages('course-raspisanie'),
    fetchAllPages('form-obuchenia'),
    fetchAllPages('month-raspisanie'),
  ]);

  const { groupsJson, taxonomiesJson, directionsJson, scheduleFiles, metaJson } = buildDataset(
    posts,
    { level, course, form, month },
    new Date()
  );

  console.log(
    `  ${metaJson.groupCount} distinct groups found (${metaJson.parseFailures} posts failed to parse)`
  );

  // Reset output directory so removed/renamed groups don't leave stale files behind.
  await rm(DATA_DIR, { recursive: true, force: true });
  await mkdir(SCHEDULE_DIR, { recursive: true });

  await writeFile(path.join(DATA_DIR, 'groups.json'), JSON.stringify(groupsJson));
  await writeFile(path.join(DATA_DIR, 'taxonomies.json'), JSON.stringify(taxonomiesJson));
  await writeFile(path.join(DATA_DIR, 'directions.json'), JSON.stringify(directionsJson));
  await writeFile(path.join(DATA_DIR, 'meta.json'), JSON.stringify(metaJson));

  for (const [fileSlug, data] of scheduleFiles) {
    await writeFile(path.join(SCHEDULE_DIR, `${fileSlug}.json`), JSON.stringify(data));
  }

  // TEMPORARY diagnostics: a compressed copy of the raw posts, so the table parser can be
  // checked against every real table offline. Public site content only; remove once done.
  await mkdir(path.join(DATA_DIR, 'debug'), { recursive: true });
  const rawDump = posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title?.rendered,
    modified: p.modified,
    level: p.level,
    course: p['course-raspisanie'],
    form: p['form-obuchenia'],
    month: p['month-raspisanie'],
    html: p.content?.rendered,
  }));
  await writeFile(path.join(DATA_DIR, 'debug', 'raw-posts.json.gz'), gzipSync(JSON.stringify(rawDump)));

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
