import type { ParsedLesson } from './parseSchedule.mjs';

export interface LessonsDiff {
  added: ParsedLesson[];
  removed: ParsedLesson[];
  changed: { before: ParsedLesson; after: ParsedLesson }[];
}

export function diffLessons(
  oldLessons: ParsedLesson[],
  newLessons: ParsedLesson[],
  fromDate: string
): LessonsDiff;

export function isEmptyDiff(diff: LessonsDiff): boolean;
