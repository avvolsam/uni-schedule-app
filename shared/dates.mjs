// Calendar date arithmetic on plain "yyyy-mm-dd" strings (no time zones involved).
// Dates are anchored at local noon while computing so daylight-saving shifts can never
// push a result onto the neighbouring day.

function toDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function toIso(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function addDays(iso, days) {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/** Monday = 0 ... Sunday = 6 (the Russian week). */
export function weekdayIndex(iso) {
  return (toDate(iso).getDay() + 6) % 7;
}

export function startOfWeek(iso) {
  return addDays(iso, -weekdayIndex(iso));
}

/** The seven dates (Monday first) of the week containing `iso`. */
export function weekDays(iso) {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isValidIso(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && toIso(toDate(value)) === value;
}
