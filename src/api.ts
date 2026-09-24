import { groupCodeToFileSlug } from '../shared/groupSlug.mjs';
import type { Direction, GroupsIndex, Meta, ScheduleFile, Taxonomies } from './types';

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`;

// `cache: 'no-cache'` forces a conditional revalidation instead of trusting a stale
// HTTP disk-cache entry — the whole point of this app is that the data can change
// under us at any time, so every load should ask the server "is this still current?".
async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(dataUrl(path), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchDirections = () => fetchJson<Direction[]>('directions.json');
export const fetchGroups = () => fetchJson<GroupsIndex>('groups.json');
export const fetchTaxonomies = () => fetchJson<Taxonomies>('taxonomies.json');
export const fetchMeta = () => fetchJson<Meta>('meta.json');

export async function fetchSchedule(groupCode: string): Promise<ScheduleFile> {
  const slug = groupCodeToFileSlug(groupCode);
  return fetchJson<ScheduleFile>(`schedule/${slug}.json`);
}
