import type { Lesson } from './types';

const WEEKDAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_NAMES = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** Today's date in the phone's local timezone as yyyy-mm-dd. */
export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function formatDayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);

  const dateStr = `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${WEEKDAY_NAMES[d.getDay()]}`;
  if (diffDays === 0) return `Сегодня, ${dateStr}`;
  if (diffDays === 1) return `Завтра, ${dateStr}`;
  if (diffDays === -1) return `Вчера, ${dateStr}`;
  return dateStr;
}

const MONTHS_NOMINATIVE = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

/** "сентябрь 2026" */
export function formatMonthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS_NOMINATIVE[m - 1]} ${y}`;
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return 'без даты';
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

/** "5 октября, 08:30 — Маркетинг" */
export function formatLessonShort(l: Lesson): string {
  const time = l.time ? l.time.split('-')[0] : '';
  return `${formatShortDate(l.date)}${time ? `, ${time}` : ''} — ${l.subject ?? 'занятие'}`;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
