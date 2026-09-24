// Keep in sync with scripts/lib/groupSlug.mjs (duplicated rather than imported across
// the src/scripts boundary to avoid cross-tsconfig module resolution issues — it's a
// one-line pure function).
export function groupCodeToFileSlug(code: string): string {
  return encodeURIComponent(code).replace(/%/g, '_');
}
