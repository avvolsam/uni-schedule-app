// Parsing logic for RANEPA SPb schedule posts (WordPress "raspisanie" custom post type).
//
// Each post's `content.rendered` contains an HTML <table> (TablePress) whose column
// order and exact header wording vary from post to post. We map columns by matching
// normalized header text against known field keys instead of relying on column index.
//
// Group codes: a single post can cover more than one student group at once (shared
// lectures) and mark per-row which subgroup(s) a lesson applies to, e.g. a post might
// contain rows tagged "ЭК-3-24-03", "ЭК-3-24-04" (subgroup-only lessons) and
// "ЭК-3-24-03-04" (shared lecture for both). We detect the individual group codes by
// finding the common leading "-"-separated tokens across all distinct "Группы" values
// in a post, then treating the remaining trailing tokens as the group-number part.

import * as cheerio from 'cheerio';

const HEADER_MATCHERS = [
  ['dayOfWeek', /день/],
  ['dateNum', /дата/],
  ['monthNum', /месяц/],
  ['time', /врем/],
  ['groups', /групп/],
  ['type', /тип/],
  ['subject', /предмет/],
  ['position', /должн/],
  ['teacher', /преподав/],
  ['room', /аудитор/],
];

function normalizeHeader(text) {
  return text.toLowerCase().replace(/[^а-яa-zё]/gi, '');
}

function cellText($, el) {
  return $(el).text().replace(/\s+/g, ' ').trim();
}

/**
 * Parses a TablePress HTML table into an array of raw row objects keyed by the
 * normalized field names in HEADER_MATCHERS. Unknown/empty columns are ignored.
 */
export function parseTableRows(html) {
  if (!html || !html.includes('<table')) return [];
  const $ = cheerio.load(html);
  const table = $('table').first();
  const headerCells = table.find('thead tr').first().find('th');

  const columnMap = {}; // columnIndex -> fieldKey
  headerCells.each((i, th) => {
    const norm = normalizeHeader($(th).text());
    for (const [field, re] of HEADER_MATCHERS) {
      if (re.test(norm)) {
        columnMap[i] = field;
        break;
      }
    }
  });

  const rows = [];
  table
    .find('tbody tr')
    .each((_, tr) => {
      const tds = $(tr).find('td');
      const row = {};
      tds.each((i, td) => {
        const field = columnMap[i];
        if (field) row[field] = cellText($, td);
      });
      // Skip fully empty rows.
      if (Object.values(row).some((v) => v)) rows.push(row);
    });

  return rows;
}

/**
 * Given the list of raw "Группы" cell values seen in one post, computes:
 *  - prefixTokens: the "-"-separated tokens common to every value (e.g. ["ЭК","3","24"])
 *  - endingsByValue: map from raw value -> array of individual group-number tokens
 *      it applies to (e.g. "ЭК-3-24-03-04" -> ["03","04"])
 */
export function computeGroupPrefixAndEndings(rawValues) {
  const distinct = [...new Set(rawValues.map((v) => v.trim()).filter(Boolean))];
  if (distinct.length === 0) return { prefixTokens: [], endingsByValue: {} };

  const tokenized = distinct.map((v) => v.split('-'));
  const minLen = Math.min(...tokenized.map((t) => t.length));

  let prefixLen = 0;
  outer: for (let i = 0; i < minLen; i++) {
    const tok = tokenized[0][i];
    for (const t of tokenized) {
      if (t[i] !== tok) break outer;
    }
    prefixLen++;
  }

  // If every value is identical (no split possible), the whole thing is a single
  // atomic group and there is nothing to split off as a "number".
  if (distinct.length === 1) {
    prefixLen = tokenized[0].length - 1 >= 0 ? tokenized[0].length - 1 : 0;
    if (prefixLen === tokenized[0].length) prefixLen = tokenized[0].length - 1;
  }

  const prefixTokens = tokenized[0].slice(0, prefixLen);
  const endingsByValue = {};
  distinct.forEach((v, idx) => {
    const remainder = tokenized[idx].slice(prefixLen);
    endingsByValue[v] = remainder.length > 0 ? remainder : [v];
  });

  return { prefixTokens, endingsByValue };
}

/** Builds the list of full group codes (e.g. "ЭК-3-24-03") a post contains. */
export function extractGroupCodesFromPost(rawGroupValues) {
  const { prefixTokens, endingsByValue } = computeGroupPrefixAndEndings(rawGroupValues);
  const prefix = prefixTokens.join('-');
  const endings = new Set();
  Object.values(endingsByValue).forEach((arr) => arr.forEach((e) => endings.add(e)));
  return [...endings]
    .sort()
    .map((ending) => (prefix ? `${prefix}-${ending}` : ending));
}

/** True if a row's raw "Группы" value applies to the given full group code. */
export function rowAppliesToGroup(rawGroupValue, groupCode, prefixTokens, endingsByValue) {
  const prefix = prefixTokens.join('-');
  const ownEnding = prefix && groupCode.startsWith(prefix + '-')
    ? groupCode.slice(prefix.length + 1)
    : groupCode;
  const endings = endingsByValue[rawGroupValue.trim()] || [];
  return endings.includes(ownEnding);
}

/**
 * Resolves a Russian academic-year date (day+month only, no year in the source data)
 * to an absolute ISO date, using the convention that the academic year runs roughly
 * August -> July. `referenceDate` is used only to pick which calendar year August-July
 * window we are in; pass the date the scraper is run on.
 */
export function resolveAcademicDate(day, month, referenceDate = new Date()) {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  if (!d || !m || m < 1 || m > 12) return null;

  const refMonth = referenceDate.getMonth() + 1;
  const refYear = referenceDate.getFullYear();
  const academicStartYear = refMonth >= 7 ? refYear : refYear - 1;
  const year = m >= 7 ? academicStartYear : academicStartYear + 1;

  const iso = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return iso;
}

/**
 * Parses one raspisanie post into a list of lesson objects, one per (row, group)
 * combination — a shared-lecture row expands into one lesson per group it applies to.
 */
export function parsePostToLessons(postContentHtml, referenceDate = new Date()) {
  const rows = parseTableRows(postContentHtml);
  const rawGroupValues = rows.map((r) => r.groups).filter(Boolean);
  const { prefixTokens, endingsByValue } = computeGroupPrefixAndEndings(rawGroupValues);
  const groupCodes = extractGroupCodesFromPost(rawGroupValues);

  const lessons = [];
  for (const row of rows) {
    if (!row.groups) continue;
    const date = resolveAcademicDate(row.dateNum, row.monthNum, referenceDate);
    for (const groupCode of groupCodes) {
      if (rowAppliesToGroup(row.groups, groupCode, prefixTokens, endingsByValue)) {
        lessons.push({
          groupCode,
          date,
          dayOfWeek: row.dayOfWeek || null,
          time: row.time || null,
          type: row.type || null,
          subject: row.subject || null,
          position: row.position || null,
          teacher: row.teacher || null,
          room: row.room || null,
        });
      }
    }
  }
  return { groupCodes, lessons };
}
