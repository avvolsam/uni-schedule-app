import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGroupText } from '../../shared/groupCodes.mjs';

const codes = (text) => parseGroupText(text).map((r) => r.code);
const subs = (text) => parseGroupText(text).map((r) => r.subgroup);

// Every case below is a value that really appears in the university's tables.

test('a plain group', () => {
  assert.deepEqual(parseGroupText('ЭК-3-24-03'), [{ code: 'ЭК-3-24-03', subgroup: null }]);
});

test('a hyphen between numbers is a range, a slash or comma is an exact list', () => {
  assert.deepEqual(codes('ЭК-3-24-03-04'), ['ЭК-3-24-03', 'ЭК-3-24-04']);
  assert.deepEqual(codes('ГМУ-3-23-01-08'), Array.from({ length: 8 }, (_, i) => `ГМУ-3-23-0${i + 1}`));
  assert.deepEqual(codes('ГМУ-3-26-21-23'), ['ГМУ-3-26-21', 'ГМУ-3-26-22', 'ГМУ-3-26-23']);
  assert.deepEqual(codes('МН-3-25-03/04'), ['МН-3-25-03', 'МН-3-25-04']);
  assert.deepEqual(codes('ЭБ-5-22-01/02/03'), ['ЭБ-5-22-01', 'ЭБ-5-22-02', 'ЭБ-5-22-03']);
  assert.deepEqual(codes('СОЦ-3-26-01,02'), ['СОЦ-3-26-01', 'СОЦ-3-26-02']);
  // "21, 23" names exactly groups 21 and 23, not 22.
  assert.deepEqual(codes('ГМУ-3-23-21, 23'), ['ГМУ-3-23-21', 'ГМУ-3-23-23']);
  assert.deepEqual(codes('ЖУР-3-24-01,02,03,04'), ['ЖУР-3-24-01', 'ЖУР-3-24-02', 'ЖУР-3-24-03', 'ЖУР-3-24-04']);
  assert.equal(codes('МН-3-22-01-02-03-04-05-06-07-08').length, 8);
});

test('a one-digit or lettered tail is a sub-group, not another group', () => {
  assert.deepEqual(parseGroupText('ЛИН-3-23-04/1Англ'), [{ code: 'ЛИН-3-23-04', subgroup: '1Англ' }]);
  assert.deepEqual(parseGroupText('ТУР-3-24-01/исп'), [{ code: 'ТУР-3-24-01', subgroup: 'исп' }]);
  assert.deepEqual(parseGroupText('РСО-3-24-01a'), [{ code: 'РСО-3-24-01', subgroup: 'a' }]);
  assert.deepEqual(parseGroupText('МО-4-26-01/1 гр'), [{ code: 'МО-4-26-01', subgroup: '1 гр' }]);
  assert.deepEqual(parseGroupText('МН-3-22-23 СМ'), [{ code: 'МН-3-22-23', subgroup: 'СМ' }]);
});

test('groups and sub-group together', () => {
  assert.deepEqual(parseGroupText('ЛИН-3-23-01-04/1исп'), [
    { code: 'ЛИН-3-23-01', subgroup: '1исп' },
    { code: 'ЛИН-3-23-02', subgroup: '1исп' },
    { code: 'ЛИН-3-23-03', subgroup: '1исп' },
    { code: 'ЛИН-3-23-04', subgroup: '1исп' },
  ]);
  assert.deepEqual(codes('ПЛ-3-23-01-03/1'), ['ПЛ-3-23-01', 'ПЛ-3-23-02', 'ПЛ-3-23-03']);
  assert.deepEqual(subs('ПЛ-3-23-01-03/1'), ['1', '1', '1']);
  assert.deepEqual(codes('ЖУР-3-24-01-04a'), ['ЖУР-3-24-01', 'ЖУР-3-24-02', 'ЖУР-3-24-03', 'ЖУР-3-24-04']);
});

test('lists with colons, several full codes, and typos', () => {
  assert.deepEqual(codes('П-2-24-12:'), ['П-2-24-12']);
  assert.deepEqual(codes('П-2-24-12: П-2-24-13:'), ['П-2-24-12', 'П-2-24-13']);
  assert.deepEqual(codes('БИ-4-24-01 БИ-4-24-02'), ['БИ-4-24-01', 'БИ-4-24-02']);
  assert.deepEqual(codes('ЛИН--3-25-01-03/4исп'), ['ЛИН-3-25-01', 'ЛИН-3-25-02', 'ЛИН-3-25-03']);
  // Latin M and H typed instead of Cyrillic М and Н.
  assert.deepEqual(codes('MH-3-25-07-08'), ['МН-3-25-07', 'МН-3-25-08']);
});

test('different departments in one cell', () => {
  assert.deepEqual(codes('MH-3-25-07-08, MO-3-26-01-03, ПС-3-26-01-02'), [
    'МН-3-25-07', 'МН-3-25-08', 'МО-3-26-01', 'МО-3-26-02', 'МО-3-26-03', 'ПС-3-26-01', 'ПС-3-26-02',
  ]);
  assert.deepEqual(codes('ЭК-3-24-01,05, ТД-5-24-01-03'), ['ЭК-3-24-01', 'ЭК-3-24-05', 'ТД-5-24-01', 'ТД-5-24-02', 'ТД-5-24-03']);
});

test('compact codes come out in the same dashed spelling as everything else', () => {
  assert.deepEqual(codes('НБ52211'), ['НБ-5-22-11']);
  assert.deepEqual(codes('ЮР32617'), ['ЮР-3-26-17']);
  assert.deepEqual(codes('ЮР32617-19'), ['ЮР-3-26-17', 'ЮР-3-26-18', 'ЮР-3-26-19']);
  assert.deepEqual(codes('НБ52611-12'), ['НБ-5-26-11', 'НБ-5-26-12']);
  assert.deepEqual(codes('ЮР42601,02,03'), ['ЮР-4-26-01', 'ЮР-4-26-02', 'ЮР-4-26-03']);
  assert.deepEqual(codes('ЮР42611,13,15,20'), ['ЮР-4-26-11', 'ЮР-4-26-13', 'ЮР-4-26-15', 'ЮР-4-26-20']);
  assert.deepEqual(parseGroupText('ЮР32509 (гр. А)'), [{ code: 'ЮР-3-25-09', subgroup: 'гр. А' }]);
  assert.deepEqual(parseGroupText('НБ52401 (гр.Б)'), [{ code: 'НБ-5-24-01', subgroup: 'гр.Б' }]);
  assert.deepEqual(subs('ЮР32217-19 (ПГР.2)'), ['ПГР.2', 'ПГР.2', 'ПГР.2']);
  // The same group written both ways is one group.
  assert.deepEqual(codes('ЮР-3-26-17-19'), codes('ЮР32617-19'));
});

test('text that is not a group gives nothing (the row then applies to every group of the post)', () => {
  for (const t of ['все группы', 'Практическое занятие', 'Лекция', 'Зачет', '32230', '', 'для всех аспирантов 2 года обучения']) {
    assert.deepEqual(parseGroupText(t), [], t);
  }
});

test('a post title yields its groups', () => {
  assert.deepEqual(codes('ЭК-3-24-03/04 СЕМЕСТР'), ['ЭК-3-24-03', 'ЭК-3-24-04']);
  assert.deepEqual(codes('Таможенное дело: гр. ТД-5-22-05/06 (ГИА)'), ['ТД-5-22-05', 'ТД-5-22-06']);
  assert.deepEqual(codes('ПЛ-6-24-02'), ['ПЛ-6-24-02']);
});
