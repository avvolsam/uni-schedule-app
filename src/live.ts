import { normalizeLessons } from '../shared/normalizeLessons.mjs';
import { parsePostToLessons } from '../shared/parseSchedule.mjs';
import type { Lesson } from './types';

// Live refresh: the student's own browser asks spb.ranepa.ru's public WordPress REST API
// directly, so the "refresh" button shows what the site says *right now*, without waiting
// for the next hourly rebuild. (WordPress reflects the request Origin in its CORS headers
// by default; if the site ever blocks that, callers fall back to the app's own data.)
const ENDPOINT = 'https://spb.ranepa.ru/wp-json/wp/v2/raspisanie';
const TIMEOUT_MS = 8000;
const FIELDS = '_fields=id,content';

interface WpPost {
  id: number;
  content?: { rendered?: string };
}

async function getPosts(url: string): Promise<WpPost[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    } catch (err) {
      // Turn low-level fetch failures into something a student can read.
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('сайт не ответил вовремя');
      }
      throw new Error('нет соединения с сайтом');
    }
    if (!res.ok) throw new Error(`сайт вернул ошибку ${res.status}`);
    const data: unknown = await res.json().catch(() => null);
    if (!Array.isArray(data)) throw new Error('сайт вернул неожиданный ответ');
    return data as WpPost[];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches the group's schedule posts straight from the university site and parses them.
 * `knownPostIds` are the posts the group appeared in at the last build (they must load);
 * a text search additionally picks up posts published since then.
 */
export async function fetchLiveLessons(groupCode: string, knownPostIds: number[]): Promise<Lesson[]> {
  // Only plain integers may end up in the URL, whatever the data file contains.
  const safeIds = knownPostIds.filter((id) => Number.isInteger(id) && id > 0);
  const searchPromise = getPosts(
    `${ENDPOINT}?search=${encodeURIComponent(groupCode)}&per_page=100&${FIELDS}`
  );
  const hasKnown = safeIds.length > 0;
  const [known, searched] = await Promise.all([
    hasKnown
      ? getPosts(`${ENDPOINT}?include=${safeIds.join(',')}&per_page=100&${FIELDS}`)
      : Promise.resolve<WpPost[]>([]),
    hasKnown ? searchPromise.catch(() => [] as WpPost[]) : searchPromise,
  ]);

  const posts = new Map<number, WpPost>();
  for (const p of [...known, ...searched]) posts.set(p.id, p);

  const now = new Date();
  const lessons: Lesson[] = [];
  for (const post of posts.values()) {
    const parsed = parsePostToLessons(post.content?.rendered ?? '', now);
    lessons.push(...parsed.lessons.filter((l) => l.groupCode === groupCode));
  }
  return normalizeLessons(lessons);
}
