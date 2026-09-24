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
