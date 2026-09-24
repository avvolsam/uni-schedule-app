// Minimal helpers for paging through a WordPress REST API collection endpoint.

const BASE_URL = 'https://spb.ranepa.ru/wp-json/wp/v2';
const PER_PAGE = 100;
const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_COUNT) {
        console.warn(`  retrying (${attempt}/${RETRY_COUNT}) after error: ${err.message}`);
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw lastErr;
}

/** Fetches every item of a WP REST collection endpoint, following pagination. */
export async function fetchAllPages(endpoint, extraQuery = '') {
  const items = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = `${BASE_URL}/${endpoint}?per_page=${PER_PAGE}&page=${page}${extraQuery}`;
    const res = await fetchJsonWithRetry(url);
    const pageItems = await res.json();
    items.push(...pageItems);

    const totalPagesHeader = res.headers.get('X-WP-TotalPages');
    totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) : 1;
    page++;
  } while (page <= totalPages);

  return items;
}

export { BASE_URL };
