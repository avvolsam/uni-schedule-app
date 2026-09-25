// Dates and times as the university's tables write them. Real examples:
//   date:  "03" (with a separate month column), "21.09.2026", "22.09.", "5/18/2026",
//          "30.11.2026 12", "05.10.26"
//   time:  "08:30-11:20", "8.00-9.00", "12.00", "19_30", "11-00", "15.00-17:50", "", "—"
// Most tables give no year, so it is worked out from the weekday written in the same row
// (a date and weekday only coincide in one of the neighbouring years) and, failing that,
// from the year closest to when the post was last edited.

const MONTHS_GENITIVE = {
  января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
  июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
};

function fullYear(y) {
  return y < 100 ? 2000 + y : y;
}

function isRealDate(y, m, d) {
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function isoOf(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Monday = 0 ... Sunday = 6 */
function weekdayOf(y, m, d) {
  return (new Date(y, m - 1, d, 12).getDay() + 6) % 7;
}

/** "Ср.", "суббота", "Понедельник", "Вс" -> 0..6, or null */
export function parseWeekday(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return null;
  if (/^пон|^пн/.test(t)) return 0;
  if (/^вт/.test(t)) return 1;
  if (/^ср/.test(t)) return 2;
  if (/^чет|^чт/.test(t)) return 3;
  if (/^пят|^пт/.test(t)) return 4;
  if (/^суб|^сб/.test(t)) return 5;
  if (/^вос|^вс/.test(t)) return 6;
  return null;
}

/**
 * Reads a "Дата" cell. Returns {day, month, year} where month and year may be null
 * (a bare "03" is just the day of the month), or null if the text is not a date.
 */
export function parseDateCell(text) {
  const t = String(text || '').trim();
  let m;
  if ((m = /^(\d{1,2})$/.exec(t))) return { day: +m[1], month: null, year: null };
  if ((m = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\.?(?:\s.*)?$/.exec(t))) {
    return { day: +m[1], month: +m[2], year: m[3] ? fullYear(+m[3]) : null };
  }
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) {
    const a = +m[1];
    const b = +m[2];
    // Exported from a spreadsheet as M/D/YYYY; only flip if that reading is impossible.
    return a > 12 ? { day: a, month: b, year: +m[3] } : { day: b, month: a, year: +m[3] };
  }
  if ((m = /^(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?/i.exec(t)) && MONTHS_GENITIVE[m[2].toLowerCase()]) {
    return { day: +m[1], month: MONTHS_GENITIVE[m[2].toLowerCase()], year: m[3] ? +m[3] : null };
  }
  return null;
}

export function parseMonthCell(text) {
  const t = String(text || '').trim().toLowerCase();
  if (/^\d{1,2}$/.test(t)) return +t >= 1 && +t <= 12 ? +t : null;
  return MONTHS_GENITIVE[t] ?? null;
}

/**
 * @param {{day:number, month:number, year:number|null}} parts
 * @param {number|null} weekday Monday=0 from the same row, if known
 * @param {Date} anchor when the post was last edited (or now)
 * @returns {string|null} yyyy-mm-dd
 */
export function resolveDate({ day, month, year }, weekday, anchor) {
  if (!day || !month || month < 1 || month > 12) return null;
  if (year) return isRealDate(year, month, day) ? isoOf(year, month, day) : null;

  const base = anchor.getFullYear();
  let candidates = [base - 1, base, base + 1].filter((y) => isRealDate(y, month, day));
  if (candidates.length === 0) return null;

  if (weekday !== null && weekday !== undefined) {
    const matching = candidates.filter((y) => weekdayOf(y, month, day) === weekday);
    if (matching.length > 0) candidates = matching;
  }
  const distance = (y) => Math.abs(new Date(y, month - 1, day, 12).getTime() - anchor.getTime());
  candidates.sort((a, b) => distance(a) - distance(b));
  return isoOf(candidates[0], month, day);
}

/** "8.00-9.00" -> "08:00-09:00"; "19_30" -> "19:30"; "" / "—" -> null */
export function normalizeTime(text) {
  const t = String(text || '');
  const parts = [...t.matchAll(/(\d{1,2})\s*[:._-]\s*(\d{2})(?!\d)/g)].map(
    (m) => `${m[1].padStart(2, '0')}:${m[2]}`
  );
  if (parts.length === 0) return null;
  return parts.slice(0, 2).join('-');
}
