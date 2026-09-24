export interface ParsedLesson {
  groupCode: string;
  date: string | null;
  dayOfWeek: string | null;
  time: string | null;
  type: string | null;
  subject: string | null;
  position: string | null;
  teacher: string | null;
  room: string | null;
}

export function parsePostToLessons(
  postContentHtml: string,
  referenceDate?: Date
): { groupCodes: string[]; lessons: ParsedLesson[] };
