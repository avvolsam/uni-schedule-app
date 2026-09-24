// Deterministic, filesystem-and-URL-safe encoding for a (Cyrillic) group code.
// Shared by the data-fetch script (which writes schedule/<slug>.json) and the frontend
// (which recomputes the same slug to fetch that file), so both must use this one function.
export function groupCodeToFileSlug(code) {
  return encodeURIComponent(code).replace(/%/g, '_');
}
