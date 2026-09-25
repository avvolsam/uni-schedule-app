export function parseWeekday(text: string): number | null;
export function parseDateCell(text: string): { day: number; month: number | null; year: number | null } | null;
export function parseMonthCell(text: string): number | null;
export function resolveDate(
  parts: { day: number; month: number; year: number | null },
  weekday: number | null | undefined,
  anchor: Date
): string | null;
export function normalizeTime(text: string): string | null;
