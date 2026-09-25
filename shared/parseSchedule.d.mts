export interface ParsedLesson {
  groupCode: string;
  subgroup: string | null;
  date: string;
  time: string | null;
  type: string | null;
  subject: string | null;
  position: string | null;
  teacher: string | null;
  room: string | null;
}

export type PostStatus = 'ok' | 'no-table' | 'no-schedule-table' | 'retake';

export interface ParsedPost {
  status: PostStatus;
  groupCodes: string[];
  /** Groups named in the post title (the post's own groups, as opposed to guests in joint rows). */
  titleGroupCodes: string[];
  lessons: ParsedLesson[];
  rowsWithoutDate: number;
  datesRepaired: number;
  datesUnexplained: number;
  unrecognised: string[][];
}

export function classifyHeader(text: string): string | null;

export function parsePost(
  post: { html: string; title?: string; modified?: string },
  options?: { now?: Date; onRepair?: (info: unknown) => void }
): ParsedPost;
