import { diffLessons, isEmptyDiff } from '../shared/diffLessons.mjs';
import { fetchGroups, fetchMeta, fetchSchedule } from './api';
import { todayIso } from './format';
import { fetchLiveLessons } from './live';
import {
  clearChanges,
  loadChanges,
  loadLiveCheckTime,
  loadStored,
  saveChanges,
  saveLiveCheckTime,
  saveStored,
} from './storage';
import type { PendingChange, StoredSchedule } from './types';

export interface ScheduleState {
  stored: StoredSchedule | null;
  changes: PendingChange[];
}

export type RefreshOutcome =
  | { via: 'live'; state: ScheduleState; changed: boolean }
  | { via: 'server'; state: ScheduleState; liveError: string }
  | { via: 'none'; state: ScheduleState; error: string };

// Don't hammer the university's server: opening the app triggers a live check only if
// the last one is older than this. The refresh button always checks.
const AUTO_LIVE_INTERVAL_MS = 15 * 60 * 1000;

export function loadLocalState(groupCode: string): ScheduleState {
  return { stored: loadStored(groupCode), changes: loadChanges(groupCode) };
}

export function dismissChanges(groupCode: string): ScheduleState {
  clearChanges(groupCode);
  return { stored: loadStored(groupCode), changes: [] };
}

/**
 * Takes a freshly obtained version of the schedule. If it is newer than what we hold,
 * records what differs (so the student can be told) and makes it the current version.
 * Older or equal versions are ignored, so a stale server build can never overwrite
 * fresher live data.
 */
function applyIncoming(incoming: StoredSchedule): { state: ScheduleState; changed: boolean } {
  const { groupCode } = incoming;
  const stored = loadStored(groupCode);
  let changes = loadChanges(groupCode);

  if (stored && Date.parse(incoming.timestamp) <= Date.parse(stored.timestamp)) {
    return { state: { stored, changes }, changed: false };
  }

  let changed = false;
  if (stored) {
    const diff = diffLessons(stored.lessons, incoming.lessons, todayIso());
    if (!isEmptyDiff(diff)) {
      changed = true;
      changes = [...changes, { detectedAt: incoming.timestamp, diff }].slice(-10);
      saveChanges(groupCode, changes);
    }
  }
  saveStored(groupCode, incoming);
  return { state: { stored: incoming, changes }, changed };
}

/** Loads the schedule file published with the app (rebuilt hourly by GitHub Actions). */
export async function loadFromServer(groupCode: string): Promise<ScheduleState> {
  const file = await fetchSchedule(groupCode);
  return applyIncoming({
    groupCode,
    lessons: file.lessons,
    timestamp: file.generatedAt,
    source: 'server',
  }).state;
}

async function loadLive(groupCode: string): Promise<{ state: ScheduleState; changed: boolean }> {
  const [groups, meta] = await Promise.all([
    fetchGroups().catch(() => null),
    fetchMeta().catch(() => null),
  ]);
  const knownPostIds = groups?.[groupCode]?.postIds ?? [];
  const lessons = await fetchLiveLessons(groupCode, knownPostIds, meta?.retakePeriodIds ?? []);

  // An empty answer for a group we already have data for means something went wrong
  // (site hiccup, search miss), not that the whole schedule vanished — don't wipe it.
  const stored = loadStored(groupCode);
  if (lessons.length === 0 && stored && stored.lessons.length > 0) {
    throw new Error('Сайт вернул пустое расписание');
  }

  saveLiveCheckTime(groupCode, Date.now());
  return applyIncoming({
    groupCode,
    lessons,
    timestamp: new Date().toISOString(),
    source: 'live',
  });
}

/** Background check on app open: only asks the university site if we haven't recently. */
export async function autoLiveRefresh(groupCode: string): Promise<ScheduleState | null> {
  if (Date.now() - loadLiveCheckTime(groupCode) < AUTO_LIVE_INTERVAL_MS) return null;
  try {
    return (await loadLive(groupCode)).state;
  } catch {
    return null;
  }
}

/** The refresh button: live from the site if possible, else the app's own latest data. */
export async function refreshNow(groupCode: string): Promise<RefreshOutcome> {
  let liveError: string;
  try {
    const { state, changed } = await loadLive(groupCode);
    return { via: 'live', state, changed };
  } catch (err) {
    liveError = err instanceof Error ? err.message : String(err);
  }

  try {
    return { via: 'server', state: await loadFromServer(groupCode), liveError };
  } catch (err) {
    return {
      via: 'none',
      state: loadLocalState(groupCode),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
