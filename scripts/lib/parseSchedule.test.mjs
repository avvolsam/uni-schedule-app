import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyHeader, parsePost } from '../../shared/parseSchedule.mjs';
import { FIXTURES } from './fixtures.mjs';

// The fixtures are excerpts of real tables from spb.ranepa.ru (see fixtures.mjs).
const parse = (name) => {
  const f = FIXTURES[name];
  return parsePost({ html: f.html, title: f.title, modified: f.modified });
};
const forGroup = (result, code) => result.lessons.filter((l) => l.groupCode === code);
const table = (rows) =>
  `<table><thead><tr>${rows[0].map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>` +
  rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') +
  '</tbody></table>';

test('header names are recognised in all their spellings', () => {
  assert.equal(classifyHeader('Предмет'), 'subject');
  assert.equal(classifyHeader('Дисциплина'), 'subject');
  assert.equal(classifyHeader('Наименование дисциплины'), 'subject');
  assert.equal(classifyHeader('Ауд.'), 'room');
  assert.equal(classifyHeader('Аудитория/ Адрес'), 'room');
  assert.equal(classifyHeader('ДолжностьПреподавателя'), 'position');
  assert.equal(classifyHeader('Преподаватель'), 'teacher');
  assert.equal(classifyHeader('Группа расписания'), 'group');
  assert.equal(classifyHeader('Время_xl'), 'time');
  assert.equal(classifyHeader('Д/Н'), 'weekday');
  assert.equal(classifyHeader('День недели'), 'weekday');
  assert.equal(classifyHeader('ДеньНедели'), 'weekday');
  assert.equal(classifyHeader('День'), 'dayAmbiguous');
  assert.equal(classifyHeader('А/Ч'), 'other');
  assert.equal(classifyHeader(''), null);
});

test('semester table of ЭК-3-24-03/04: shared lectures reach both groups, sub-group rows only their own', () => {
  const r = parse('ekSemester');
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.groupCodes.sort(), ['ЭК-3-24-03', 'ЭК-3-24-04']);

  const lecture = r.lessons.filter((l) => l.subject.startsWith('Цифровое общество') && l.date === '2026-09-02');
  assert.deepEqual(lecture.map((l) => l.groupCode).sort(), ['ЭК-3-24-03', 'ЭК-3-24-04']);

  const english = r.lessons.filter((l) => l.subject.startsWith('Английский') && l.date === '2026-09-03');
  assert.equal(english.length, 2);
  assert.equal(english.find((l) => l.groupCode === 'ЭК-3-24-03').teacher, 'Щербакова В.С.');
  assert.equal(english.find((l) => l.groupCode === 'ЭК-3-24-04').teacher, 'Каримова К.С.');
});

test('a mistyped month ("Вт. 03 10" is really Tuesday 3 November) does not land on Saturday 3 October', () => {
  const r = parse('ekSemester');
  assert.equal(r.datesRepaired, 1);
  const g = forGroup(r, 'ЭК-3-24-03');

  const oct3 = g.filter((l) => l.date === '2026-10-03');
  assert.deepEqual(oct3.map((l) => l.subject), ['Управленческий учет']);

  const nov3 = g.filter((l) => l.date === '2026-11-03');
  assert.ok(nov3.some((l) => l.subject === 'Бухгалтерский учет и анализ'));
});

test('layout with both "День недели" and "День" (a day number) plus "Дисциплина" and "Ауд"', () => {
  const r = parse('weekdayAndDayColumns');
  assert.equal(r.status, 'ok');
  assert.equal(r.rowsWithoutDate, 0);
  assert.ok(r.lessons.length >= 5);
  for (const l of r.lessons) {
    assert.match(l.date, /^2026-0[3-9]-\d\d$/);
    assert.ok(l.subject, 'subject read from the "Дисциплина" column');
    assert.ok(l.room, 'room read from the "Ауд" column');
  }
});

test('full dates, "К/Ч" hours column, group ranges in cells and titles', () => {
  const r = parse('fullDatesGmu');
  assert.equal(r.status, 'ok');
  // Title and rows say ГМУ-3-26-21-23: groups 21, 22 and 23.
  assert.deepEqual(r.groupCodes.sort(), ['ГМУ-3-26-21', 'ГМУ-3-26-22', 'ГМУ-3-26-23']);

  // The site really lists two different lessons for group 23 at this time; both are kept.
  const clash = forGroup(r, 'ГМУ-3-26-23').filter((l) => l.date === '2026-10-15' && l.time === '18:30-21:20');
  assert.equal(clash.length, 2);
  assert.deepEqual(clash.map((l) => l.subject).sort(), ['История России', 'Русский язык и культура речи']);
});

test('a row without a time still gets a date', () => {
  const r = parse('fullDatesGmu');
  const week = forGroup(r, 'ГМУ-3-26-21').find((l) => l.date === '2026-09-01');
  assert.ok(week);
  assert.equal(week.time, null);
});

test('"Д/Н" layout with clock times', () => {
  const r = parse('dotTimesCompact');
  assert.equal(r.status, 'ok');
  const first = r.lessons[0];
  assert.equal(first.date, '2026-10-05');
  assert.equal(first.time, '18:30-21:20');
});

test('a table whose date column has no header is still read', () => {
  const r = parse('blankDateHeader');
  assert.equal(r.status, 'ok');
  assert.equal(r.rowsWithoutDate, 0);
  const philosophy = r.lessons.find((l) => l.subject === 'Философия');
  assert.equal(philosophy.date, '2026-09-03');
  assert.equal(philosophy.time, '12:00-12:20');
});

test('language sub-groups spanning several groups', () => {
  const r = parse('subgroups');
  assert.equal(r.status, 'ok');
  // ЛИН-3-23-01-04 means groups 01..04.
  for (const code of ['ЛИН-3-23-01', 'ЛИН-3-23-02', 'ЛИН-3-23-03', 'ЛИН-3-23-04']) {
    assert.ok(r.groupCodes.includes(code), code);
  }
  const first = forGroup(r, 'ЛИН-3-23-01');
  assert.deepEqual([...new Set(first.map((l) => l.subgroup))].sort(), ['1исп', '2исп']);
});

test('compact group codes (ЮР32617-19) become the same codes as the dashed ones', () => {
  const r = parse('compactCodes');
  assert.equal(r.status, 'ok');
  for (const code of ['ЮР-3-26-17', 'ЮР-3-26-18', 'ЮР-3-26-19']) assert.ok(forGroup(r, code).length > 0, code);
  assert.equal(r.groupCodes.filter((c) => !c.includes('-')).length, 0, 'no compact spellings left');
  const meeting = forGroup(r, 'ЮР-3-26-17')[0];
  assert.equal(meeting.date, '2026-10-05');
  assert.equal(meeting.time, '12:00');
});

test('retake ("пересдача") tables are not a group timetable', () => {
  const r = parse('retake');
  assert.equal(r.status, 'retake');
  assert.deepEqual(r.lessons, []);
});

test('a table with an empty header is a placeholder: no lessons, but the title names the group', () => {
  const r = parse('emptyHeader');
  assert.equal(r.status, 'no-schedule-table');
  assert.deepEqual(r.lessons, []);
  assert.deepEqual(r.groupCodes.sort(), ['ТД-5-22-05', 'ТД-5-22-06']);
});

test('a post with no table at all still tells us which group it is for', () => {
  const r = parse('placeholderNoTable');
  assert.equal(r.status, 'no-table');
  assert.deepEqual(r.groupCodes, ['ПЛ-6-24-02']);
  assert.deepEqual(r.lessons, []);
});

test('a row that names no group applies to every group of the post', () => {
  const html = table([
    ['Дата', 'Время', 'Группы', 'Предмет'],
    ['05.10.2026', '10.00', 'ЭК-3-24-03', 'Своё занятие'],
    ['06.10.2026', '10.00', 'ЭК-3-24-04', 'Другое занятие'],
    ['07.10.2026', '10.00', 'все группы', 'Общее занятие'],
    ['08.10.2026', '10.00', '', 'Тоже общее'],
  ]);
  const r = parsePost({ html, title: 'ЭК-3-24-03/04', modified: '2026-09-01' });
  assert.deepEqual(forGroup(r, 'ЭК-3-24-03').map((l) => l.subject), ['Своё занятие', 'Общее занятие', 'Тоже общее']);
  assert.deepEqual(forGroup(r, 'ЭК-3-24-04').map((l) => l.subject), ['Другое занятие', 'Общее занятие', 'Тоже общее']);
});

test('repeated header rows and blank rows are ignored; rows without a date are counted, not shown', () => {
  const html = table([
    ['Дата', 'Время', 'Группы', 'Предмет'],
    ['05.10.2026', '10.00', 'ЭК-3-24-03', 'Занятие'],
    ['Дата', 'Время', 'Группы', 'Предмет'],
    ['', '', '', ''],
    ['', '11.00', 'ЭК-3-24-03', 'Без даты'],
  ]);
  const r = parsePost({ html, title: 'ЭК-3-24-03', modified: '2026-09-01' });
  assert.equal(r.lessons.length, 1);
  assert.equal(r.rowsWithoutDate, 1);
});

test('a date that fits between its neighbours keeps its date when only the weekday text is off', () => {
  const html = table([
    ['Дата', 'День недели', 'Время', 'Группы', 'Предмет'],
    ['05.10.2026', 'Пн.', '10.00', 'ЭК-3-24-03', 'А'],
    ['06.10.2026', 'Пт.', '10.00', 'ЭК-3-24-03', 'Б'], // 6 Oct 2026 is a Tuesday
    ['07.10.2026', 'Ср.', '10.00', 'ЭК-3-24-03', 'В'],
  ]);
  const r = parsePost({ html, title: 'ЭК-3-24-03', modified: '2026-09-01' });
  assert.deepEqual(r.lessons.map((l) => l.date), ['2026-10-05', '2026-10-06', '2026-10-07']);
  assert.equal(r.datesRepaired, 0);
});
