export interface Lesson {
  groupCode: string;
  date: string | null; // ISO yyyy-mm-dd, or null if unparsable
  dayOfWeek: string | null;
  time: string | null;
  type: string | null;
  subject: string | null;
  position: string | null;
  teacher: string | null;
  room: string | null;
}

export interface ScheduleFile {
  groupCode: string;
  lessons: Lesson[];
  generatedAt: string;
}

export interface GroupInfo {
  levelIds: number[];
  courseIds: number[];
  formIds: number[];
  monthIds: number[];
  postIds: number[];
  fileSlug: string;
}

export type GroupsIndex = Record<string, GroupInfo>;

export interface TaxonomyTerm {
  id: number;
  name: string;
  slug: string;
  parent: number;
}

export interface Taxonomies {
  level: TaxonomyTerm[];
  course: TaxonomyTerm[];
  form: TaxonomyTerm[];
  month: TaxonomyTerm[];
}

export interface Direction {
  id: number;
  name: string;
  breadcrumb: string;
  groupCodes: string[];
}

export interface Meta {
  generatedAt: string;
  postCount: number;
  groupCount: number;
  parseFailures: number;
}

export interface SavedSelection {
  groupCode: string;
  directionBreadcrumb: string;
}

export interface StoredSchedule {
  groupCode: string;
  lessons: Lesson[];
  timestamp: string; // ISO time this version of the data was produced
  source: 'live' | 'server'; // straight from spb.ranepa.ru, or from the app's own daily/hourly build
}

export interface LessonsDiff {
  added: Lesson[];
  removed: Lesson[];
  changed: { before: Lesson; after: Lesson }[];
}

export interface PendingChange {
  detectedAt: string;
  diff: LessonsDiff;
}
