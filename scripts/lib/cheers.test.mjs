import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_CHEERS, pickCheer } from '../../shared/cheers.mjs';

// JavaScript's \b does not understand Cyrillic, so word edges are spelled out.
const GENDERED_PAST_TENSE =
  /(?<![а-яё])(открыл|открыла|заслужил|заслужила|справился|справилась|пришёл|пришла|молодцом)(?![а-яё])/i;

test('the same date always gets the same line', () => {
  assert.equal(pickCheer('2026-09-24', true), pickCheer('2026-09-24', true));
  assert.equal(pickCheer('2026-09-24', false), pickCheer('2026-09-24', false));
});

test('lines for busy days and free days come from different sets', () => {
  const busy = new Set();
  const free = new Set();
  for (let d = 1; d <= 28; d++) {
    const iso = `2026-10-${String(d).padStart(2, '0')}`;
    busy.add(pickCheer(iso, true));
    free.add(pickCheer(iso, false));
  }
  for (const line of busy) assert.equal(free.has(line), false);
  assert.ok(busy.size > 1 && free.size > 1, 'lines should vary from day to day');
});

test('the gender check really catches gendered wording', () => {
  assert.match('Ты уже молодец, что открыл это расписание.', GENDERED_PAST_TENSE);
  assert.match('Отдохни, ты это заслужила.', GENDERED_PAST_TENSE);
});

test('no line gives away the reader\'s gender or wrongly says "today"', () => {
  for (const line of ALL_CHEERS) {
    assert.ok(line.length > 10);
    assert.doesNotMatch(line, GENDERED_PAST_TENSE, line);
    // The line can appear under any date the student browses to, so it must not say "today".
    assert.doesNotMatch(line, /сегодня/i, line);
  }
});
