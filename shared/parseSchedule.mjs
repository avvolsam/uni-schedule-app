// Turns one schedule post of spb.ranepa.ru (a WordPress post holding an HTML table) into
// lessons per student group.
//
// The site has ~50 different table layouts, so nothing is read by column position:
//   * columns are recognised by their header text ("Предмет", "Дисциплина", "Ауд.", ...);
//   * a bare "День" column is a weekday in some tables and a day-of-month number in others,
//     so it is told apart by looking at its values;
//   * dates come in many formats and mostly without a year (see dateTime.mjs);
//   * the "Группы" cell is free text (see groupCodes.mjs); a row that names no group
//     applies to every group of the post.

import * as cheerio from 'cheerio/slim';
import { parseGroupText } from './groupCodes.mjs';
import { normalizeTime, parseDateCell, parseMonthCell, parseWeekday, resolveDate } from './dateTime.mjs';

const MIN_RECOGNISED_HEADERS = 3;
const HEADER_SEARCH_ROWS = 8;

function normalizeHeader(text) {
  return text.toLowerCase().replace(/[^а-яёa-z0-9/]/g, '');
}

/** Returns a role name, 'other' for a known-but-unused column, or null for an empty cell. */
export function classifyHeader(text) {
  const h = normalizeHeader(text);
  if (!h) return null;
  if (/^деньнедели|^д\/н$|^днинедели/.test(h)) return 'weekday';
  if (h === 'день') return 'dayAmbiguous';
  if (/^дата/.test(h) || h === 'число') return 'date';
  if (h === 'месяц') return 'month';
  if (/^время/.test(h)) return 'time';
  if (/^групп|^учебныегруппы/.test(h)) return 'group';
  if (/^тип|^видзанятия/.test(h)) return 'type';
  if (/^предмет|^дисциплина|^наименованиедисциплины|^мероприятие/.test(h)) return 'subject';
  if (/^должн/.test(h)) return 'position';
  if (/^препод|^членыкомиссии/.test(h)) return 'teacher';
  if (/^ауд/.test(h)) return 'room';
  if (/^адрес/.test(h)) return 'address';
  return 'other';
}

function cellText($, el) {
  const $el = $(el);
  $el.find('br').replaceWith(' ');
  $el.find('p, div, li').append(' ');
  return $el.text().replace(/\s+/g, ' ').trim();
}

function extractTables(html) {
  const $ = cheerio.load(html || '');
  return $('table')
    .map((_, table) =>
      [
        $(table)
          .find('tr')
          .map((__, tr) => [$(tr).children('th, td').map((___, c) => cellText($, c)).get()])
          .get(),
      ]
    )
    .get();
}

function recognisedCount(cells) {
  return cells.filter((c) => {
    const role = classifyHeader(c);
    return role && role !== 'other';
  }).length;
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, HEADER_SEARCH_ROWS); i++) {
    if (recognisedCount(rows[i]) >= MIN_RECOGNISED_HEADERS) return i;
  }
  return -1;
}

/** Retake ("пересдача") tables list individual students' debts, not a group's timetable. */
function looksLikeRetakeTable(headerCells) {
  const h = headerCells.map(normalizeHeader).join('|');
  return /датасдачи|долга/.test(h);
}

function columnRoles(headerCells, dataRows) {
  const roles = {};
  headerCells.forEach((text, index) => {
    const role = classifyHeader(text);
    if (role && role !== 'other' && !(role in roles)) roles[role] = index;
  });

  if ('dayAmbiguous' in roles) {
    const col = roles.dayAmbiguous;
    delete roles.dayAmbiguous;
    const values = dataRows.slice(0, 40).map((r) => r[col] ?? '').filter(Boolean);
    const numeric = values.filter((v) => /^\d{1,2}$/.test(v)).length;
    const isNumber = values.length > 0 && numeric / values.length >= 0.7;
    if (isNumber && !('date' in roles)) roles.date = col;
    else if (!isNumber && !('weekday' in roles)) roles.weekday = col;
  }

  // Some tables forgot the header of the date column altogether: use the unlabelled column
  // whose values look like full dates.
  if (!('date' in roles)) {
    headerCells.forEach((text, col) => {
      if ('date' in roles || text) return;
      const values = dataRows.slice(0, 40).map((r) => r[col] ?? '').filter(Boolean);
      const dates = values.filter((v) => parseDateCell(v)?.month != null).length;
      if (values.length > 0 && dates / values.length >= 0.7) roles.date = col;
    });
  }
  return roles;
}

function weekdayOfIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(y, m - 1, d, 12).getDay() + 6) % 7;
}

function shiftIso(iso, months, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const shifted = new Date(y, m - 1 + months, d + days, 12);
  // A month shift that spills over (31 March -> "31 April") is not a real candidate.
  if (days === 0 && shifted.getDate() !== d) return null;
  const mm = String(shifted.getMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getDate()).padStart(2, '0');
  return `${shifted.getFullYear()}-${mm}-${dd}`;
}

const isoTime = (iso) => new Date(`${iso}T12:00:00`).getTime();
const DAY_MS = 86400000;
// A row is "in order" if its date lies between its neighbours' dates (one day of slack);
// with only one neighbour, within two weeks after/before it.
const ONE_SIDED_WINDOW_DAYS = 14;
const ORDER_SLACK_DAYS = 1;
const REPAIR_MAX_GAP_DAYS = 3;

/**
 * Editors sometimes mistype a day or month ("Вт. 03 10" for Tuesday 3 November).
 *
 * Only rows whose date breaks the table's chronological order are touched: if the date
 * sits between its neighbours, the *weekday* cell is the one that is wrong and the date is
 * kept. An out-of-order row is moved to the nearby date (another month, or up to three days
 * off) that has the weekday written in the row and lies closest to where the neighbours put
 * it. Anything that cannot be explained stays exactly as the site has it.
 */
function repairWeekdayMismatches(parsedRows, onRepair) {
  const consistent = parsedRows.map((r) => r.weekday == null || weekdayOfIso(r.lesson.date) === r.weekday);
  let repaired = 0;
  let unrepaired = 0;

  parsedRows.forEach((row, i) => {
    if (consistent[i]) return;

    let before = null;
    for (let j = i - 1; j >= 0; j--) if (consistent[j]) { before = parsedRows[j].lesson.date; break; }
    let after = null;
    for (let j = i + 1; j < parsedRows.length; j++) if (consistent[j]) { after = parsedRows[j].lesson.date; break; }

    let lo;
    let hi;
    if (before && after) {
      lo = Math.min(isoTime(before), isoTime(after));
      hi = Math.max(isoTime(before), isoTime(after));
    } else if (before) {
      lo = isoTime(before);
      hi = lo + ONE_SIDED_WINDOW_DAYS * DAY_MS;
    } else if (after) {
      hi = isoTime(after);
      lo = hi - ONE_SIDED_WINDOW_DAYS * DAY_MS;
    } else {
      unrepaired++;
      return;
    }

    const own = isoTime(row.lesson.date);
    if (own >= lo - ORDER_SLACK_DAYS * DAY_MS && own <= hi + ORDER_SLACK_DAYS * DAY_MS) {
      unrepaired++; // in order: the weekday text is what is off, keep the date
      return;
    }

    const gapTo = (t) => (t < lo ? lo - t : t > hi ? t - hi : 0) / DAY_MS;
    const mid = (lo + hi) / 2;
    const candidates = [];
    for (const months of [-2, -1, 1, 2]) candidates.push(shiftIso(row.lesson.date, months, 0));
    for (const days of [-3, -2, -1, 1, 2, 3]) candidates.push(shiftIso(row.lesson.date, 0, days));

    const scored = candidates
      .filter((c) => c && weekdayOfIso(c) === row.weekday)
      .map((c) => ({ c, gap: gapTo(isoTime(c)), mid: Math.abs(isoTime(c) - mid) }))
      .filter((s) => s.gap <= REPAIR_MAX_GAP_DAYS)
      .sort((a, b) => a.gap - b.gap || a.mid - b.mid);

    const unique = scored.length === 1 || (scored.length > 1 && (scored[0].gap < scored[1].gap || scored[0].mid < scored[1].mid));
    if (unique) {
      onRepair?.({ from: row.lesson.date, to: scored[0].c, weekday: row.weekday, before, after, subject: row.lesson.subject });
      row.lesson.date = scored[0].c;
      repaired++;
    } else {
      unrepaired++;
    }
  });

  return { repaired, unrepaired };
}

function parseTable(rows, tableTitleGroups, anchor, onRepair) {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) return { kind: 'unrecognised', headers: rows[0] ?? [] };

  const headerCells = rows[headerIndex];
  if (looksLikeRetakeTable(headerCells)) return { kind: 'retake' };

  const dataRows = rows.slice(headerIndex + 1);
  const roles = columnRoles(headerCells, dataRows);
  if (!('date' in roles) || !('subject' in roles)) return { kind: 'unrecognised', headers: headerCells };

  const get = (cells, role) => (role in roles ? cells[roles[role]] ?? '' : '');
  const parsedRows = [];
  let withoutDate = 0;

  for (const cells of dataRows) {
    if (cells.every((c) => !c)) continue;
    if (recognisedCount(cells) >= MIN_RECOGNISED_HEADERS) continue; // a repeated header row

    const subject = get(cells, 'subject');
    let dateParts = parseDateCell(get(cells, 'date'));
    if (dateParts && dateParts.month == null) dateParts = { ...dateParts, month: parseMonthCell(get(cells, 'month')) };
    const weekday = parseWeekday(get(cells, 'weekday'));
    const date = dateParts?.month ? resolveDate(dateParts, weekday, anchor) : null;

    if (!date) {
      if (subject) withoutDate++;
      continue;
    }

    const room = [get(cells, 'room'), get(cells, 'address')].filter(Boolean).join(', ');
    parsedRows.push({
      weekday,
      refs: parseGroupText(get(cells, 'group')),
      lesson: {
        date,
        time: normalizeTime(get(cells, 'time')),
        type: get(cells, 'type') || null,
        subject: subject || null,
        position: get(cells, 'position') || null,
        teacher: get(cells, 'teacher') || null,
        room: room || null,
      },
    });
  }

  const { repaired, unrepaired } = repairWeekdayMismatches(parsedRows, onRepair);
  return { kind: 'ok', rows: parsedRows, withoutDate, repaired, unrepaired, tableTitleGroups };
}

/**
 * @param {{html: string, title?: string, modified?: string}} post
 * @param {{now?: Date}} [options]
 * @returns {{
 *   status: 'ok'|'no-table'|'no-schedule-table'|'retake',
 *   groupCodes: string[],
 *   lessons: object[],
 *   rowsWithoutDate: number,
 *   unrecognised: string[][]
 * }}
 */
export function parsePost(post, options = {}) {
  const now = options.now ?? new Date();
  const modified = post.modified ? new Date(post.modified) : now;
  const anchor = Number.isNaN(modified.getTime()) ? now : modified;

  const tables = extractTables(post.html);
  const result = {
    status: 'ok',
    groupCodes: [],
    titleGroupCodes: [],
    lessons: [],
    rowsWithoutDate: 0,
    datesRepaired: 0,
    datesUnexplained: 0,
    unrecognised: [],
  };
  const titleGroups = parseGroupText(post.title || '').map((r) => r.code);

  if (tables.length === 0) {
    const own = [...new Set(titleGroups)];
    return { ...result, status: 'no-table', groupCodes: own, titleGroupCodes: own };
  }

  const parsed = tables.map((rows) => parseTable(rows, titleGroups, anchor, options.onRepair));
  const accepted = parsed.filter((p) => p.kind === 'ok');
  result.unrecognised = parsed.filter((p) => p.kind === 'unrecognised').map((p) => p.headers);

  if (accepted.length === 0) {
    const retake = parsed.some((p) => p.kind === 'retake');
    const own = [...new Set(titleGroups)];
    return { ...result, status: retake ? 'retake' : 'no-schedule-table', groupCodes: own, titleGroupCodes: own };
  }

  const groups = new Set(titleGroups);
  for (const table of accepted) {
    result.rowsWithoutDate += table.withoutDate;
    result.datesRepaired += table.repaired;
    result.datesUnexplained += table.unrepaired;
    for (const row of table.rows) row.refs.forEach((r) => groups.add(r.code));
  }

  for (const table of accepted) {
    for (const { refs, lesson } of table.rows) {
      if (refs.length > 0) {
        for (const ref of refs) result.lessons.push({ groupCode: ref.code, subgroup: ref.subgroup, ...lesson });
      } else {
        // Names no group ("все группы", "Лекция", empty): it is for everyone in the post.
        for (const code of groups) result.lessons.push({ groupCode: code, subgroup: null, ...lesson });
      }
    }
  }

  result.groupCodes = [...groups];
  result.titleGroupCodes = [...new Set(titleGroups)];
  return result;
}
