export interface Lesson {
  groupCode: string;
  subgroup: string | null; // e.g. "1исп", "a", "гр. А": the row is for that sub-group only
  date: string; // ISO yyyy-mm-dd
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
  lessonCount: number;
  lastLessonDate: string | null;
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
  lessonCount: number;
  emptyGroups: number;
  parseFailures: number;
  /** Ids of the "re-sit" periods whose posts are not a group's timetable. */
  retakePeriodIds: number[];
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
