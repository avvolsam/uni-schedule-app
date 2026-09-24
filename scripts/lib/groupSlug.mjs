// Deterministic, filesystem-and-URL-safe encoding for a (Cyrillic) group code.
// Keep in sync with src/groupSlug.ts (duplicated there for the frontend to avoid
// cross-tsconfig module resolution issues) — both must produce identical output since
// this script writes schedule/<slug>.json filenames that the frontend then fetches by
// recomputing the same slug from the group code.
export function groupCodeToFileSlug(code) {
  return encodeURIComponent(code).replace(/%/g, '_');
}
