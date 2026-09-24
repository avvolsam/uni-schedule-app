#!/usr/bin/env node
// Runs in CI right after `fetch-data`. Compares the fresh public/data/schedule/*.json with
// the copy saved by the previous run (.baseline/), sends one OneSignal push per group whose
// upcoming lessons changed, then saves the fresh data as the new baseline.
//
// Reads from the environment (set by the workflow, never hard-coded):
//   ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY (secret), SITE_URL

import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { computeNotifications, suspiciousReason } from './lib/notifications.mjs';
import { sendGroupNotification } from './lib/onesignal.mjs';

const NEW_DIR = path.resolve(process.cwd(), 'public/data/schedule');
const BASELINE_ROOT = path.resolve(process.cwd(), '.baseline');
const BASELINE_DIR = path.join(BASELINE_ROOT, 'schedule');

async function readSchedules(dir) {
  const files = new Map();
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return files;
  }
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      files.set(name.slice(0, -5), JSON.parse(await readFile(path.join(dir, name), 'utf8')));
    } catch {
      // A damaged baseline file just means "no previous version" for that group.
    }
  }
  return files;
}

function todayIso() {
  // The university is in Moscow time; use it so "today" matches the students' today.
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
}

async function saveBaseline(failedSlugs, oldFiles) {
  await rm(BASELINE_ROOT, { recursive: true, force: true });
  await mkdir(BASELINE_DIR, { recursive: true });
  await cp(NEW_DIR, BASELINE_DIR, { recursive: true });
  // Groups whose notification could not be delivered keep their old baseline, so the
  // change is detected (and retried) again on the next run instead of being lost.
  for (const slug of failedSlugs) {
    const old = oldFiles.get(slug);
    if (old) await writeFile(path.join(BASELINE_DIR, `${slug}.json`), JSON.stringify(old));
  }
}

async function main() {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  const siteUrl = process.env.SITE_URL || undefined;

  const oldFiles = await readSchedules(BASELINE_DIR);
  const newFiles = await readSchedules(NEW_DIR);
  console.log(`Baseline groups: ${oldFiles.size}, fresh groups: ${newFiles.size}`);

  const failed = new Set();

  if (oldFiles.size === 0) {
    console.log('No previous baseline (first run or cache expired): nothing to compare, saving baseline.');
  } else {
    const notifications = computeNotifications(oldFiles, newFiles, todayIso());
    console.log(`Groups with changed upcoming lessons: ${notifications.length}`);

    const reason = suspiciousReason(oldFiles, newFiles, notifications.length);
    if (reason) {
      console.warn(`Notifications held back, refresh looks abnormal: ${reason}`);
    } else if (!appId || !apiKey) {
      console.log('OneSignal is not configured (no app id / API key): skipping notifications.');
    } else {
      for (const n of notifications) {
        try {
          await sendGroupNotification({
            appId,
            apiKey,
            groupSlug: n.slug,
            title: n.title,
            body: n.body,
            url: siteUrl,
          });
          console.log(`  sent: ${n.groupCode}`);
        } catch (err) {
          failed.add(n.slug);
          console.warn(`  FAILED: ${n.groupCode}: ${err.message}`);
        }
      }
    }
  }

  await saveBaseline(failed, oldFiles);
  console.log('Baseline saved.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
