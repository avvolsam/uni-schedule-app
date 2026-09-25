// Reads student-group references out of free text: the "Группы" cell of a schedule table
// or a post title. The university's editors write these in dozens of ways, all seen in the
// real data, for example:
//
//   ЭК-3-24-03            one group (prefix-course-intake year-number)
//   ЭК-3-24-03-04         groups 03 and 04 (a hyphen between numbers is a range: 01-08 = 01..08)
//   МН-3-25-03/04         groups 03 and 04
//   СОЦ-3-26-01,02        groups 01 and 02;  ГМУ-3-23-21, 23  likewise
//   ЛИН-3-23-01-04/1исп   groups 01 and 04, sub-group "1исп"
//   РСО-3-24-01a          group 01, sub-group "a"
//   ТУР-3-24-01/Англ      group 01, sub-group "Англ"
//   ПЛ-3-23-01-03/1       groups 01 and 03, sub-group "1"
//   П-2-24-12: П-2-24-13: two groups, colons and spaces between them
//   НБ52211               compact form: letters + course + year + number
//   ЮР32617-19            compact, groups 17..19;  ЮР42601,02,03  compact, list
//                         (compact codes are returned in the dashed spelling ЮР-3-26-17)
//   НБ52401 (гр.Б)        compact with a sub-group in brackets
//   MH-3-25-07-08         Latin look-alike letters typed by mistake (M, H)
//
// Text that is not a group ("все группы", "Лекция", "Зачет", "32230") yields no references;
// callers treat such a row as applying to every group of the post.

const LOOKALIKES = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У' };

/** Uppercases and replaces Latin letters that look like Cyrillic ones (typos in the source). */
export function normalizeLetters(text) {
  return text.replace(/[A-Za-zА-Яа-яЁё]/g, (ch) => {
    const up = ch.toUpperCase();
    return LOOKALIKES[up] ?? up;
  });
}

const DASHED_HEAD = /([А-ЯЁA-Z]{1,6})-(\d)-(\d{2})-(\d{2})(?!\d)/gi;
const COMPACT_HEAD = /([А-ЯЁA-Z]{2,4})(\d)(\d{2})(\d{2})(?!\d)/gi;

const TRIM_EDGES = /^[\s/(,:;.-]+|[\s/):;,.-]+$/g;

function cleanSubgroup(text) {
  return text.replace(TRIM_EDGES, '').replace(/\s+/g, ' ').trim();
}

function range(from, to) {
  const a = parseInt(from, 10);
  const b = parseInt(to, 10);
  // Not an ascending, plausible span: take the number as written.
  if (b <= a || b - a > 12) return [to];
  return Array.from({ length: b - a + 1 }, (_, i) => String(a + i).padStart(2, '0'));
}

/**
 * @param {string} rawText
 * @returns {{code: string, subgroup: string|null}[]} de-duplicated group references
 */
export function parseGroupText(rawText) {
  const text = String(rawText || '').replace(/-{2,}/g, '-').replace(/\s+/g, ' ');
  const refs = [];

  const dashed = [...text.matchAll(DASHED_HEAD)];
  const compact = dashed.length ? [] : [...text.matchAll(COMPACT_HEAD)];
  const isDashed = dashed.length > 0;
  const heads = isDashed ? dashed : compact;

  heads.forEach((m, i) => {
    const prefix = normalizeLetters(m[1]);
    const course = m[2];
    const year = m[3];
    const numbers = [m[4]];

    const from = m.index + m[0].length;
    const to = i + 1 < heads.length ? heads[i + 1].index : text.length;
    let rest = text.slice(from, to);

    // Further group numbers glued to the first: -04, /04, ,04 (and 17-19 ranges in the
    // compact form). A single digit after "/" is a sub-group, not a group number.
    for (;;) {
      const list = /^(?:-|\/|,\s*)(\d{2})(?!\d)/.exec(rest);
      if (!list) break;
      // A hyphen between numbers is a range (ГМУ-3-23-01-08 = groups 01..08); a slash or
      // comma lists exactly the numbers written (ГМУ-3-23-21, 23 = groups 21 and 23).
      if (rest.startsWith('-')) numbers.push(...range(numbers[numbers.length - 1], list[1]));
      else numbers.push(list[1]);
      rest = rest.slice(list[0].length);
    }

    const subgroup = cleanSubgroup(rest) || null;
    for (const n of numbers) {
      // Compact ЮР32617 and dashed ЮР-3-26-17 name the same group: keep one spelling.
      const code = `${prefix}-${course}-${year}-${n}`;
      refs.push({ code, subgroup });
    }
  });

  const seen = new Set();
  return refs.filter((r) => {
    const key = `${r.code}|${r.subgroup ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
