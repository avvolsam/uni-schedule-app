import type { PendingChange, SavedSelection, StoredSchedule } from './types';

const SELECTION_KEY = 'uni-schedule:selection';
// Bumped when the schedule data format changes (v2: real group codes, sub-groups, fixed
// dates). Copies saved by an older version are simply never read, so students don't get a
// bogus "your schedule changed" banner comparing old-format data with the new.
const DATA_VERSION = 'v2';
const storedKey = (group: string) => `uni-schedule:${DATA_VERSION}:stored:${group}`;
const changesKey = (group: string) => `uni-schedule:${DATA_VERSION}:changes:${group}`;
const liveCheckKey = (group: string) => `uni-schedule:${DATA_VERSION}:live-check:${group}`;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// Storage can be unavailable (private browsing) or full; the app still works, it just
// forgets things between visits, so failures are deliberately swallowed.
function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function loadSelection(): SavedSelection | null {
  const parsed = readJson<SavedSelection>(SELECTION_KEY);
  return typeof parsed?.groupCode === 'string' ? parsed : null;
}

export const saveSelection = (s: SavedSelection) => writeJson(SELECTION_KEY, s);
export const clearSelection = () => remove(SELECTION_KEY);

export const loadStored = (group: string) => readJson<StoredSchedule>(storedKey(group));
export const saveStored = (group: string, s: StoredSchedule) => writeJson(storedKey(group), s);

export const loadChanges = (group: string) => readJson<PendingChange[]>(changesKey(group)) ?? [];
export const saveChanges = (group: string, c: PendingChange[]) => writeJson(changesKey(group), c);
export const clearChanges = (group: string) => remove(changesKey(group));

const subgroupKey = (group: string) => `uni-schedule:${DATA_VERSION}:subgroup:${group}`;
export const loadSubgroup = (group: string): string | null => readJson<string>(subgroupKey(group));
export const saveSubgroup = (group: string, value: string | null) =>
  value ? writeJson(subgroupKey(group), value) : remove(subgroupKey(group));

export const loadLiveCheckTime = (group: string): number => {
  const raw = readJson<number>(liveCheckKey(group));
  return typeof raw === 'number' ? raw : 0;
};
export const saveLiveCheckTime = (group: string, t: number) => writeJson(liveCheckKey(group), t);
