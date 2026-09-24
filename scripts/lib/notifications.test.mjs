import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNotifications, describeDiff, suspiciousReason } from './notifications.mjs';
import { sendGroupNotification } from './onesignal.mjs';

const lesson = (over = {}) => ({
  groupCode: 'ЭК-3-24-03',
  date: '2026-10-05',
  time: '08:30-11:20',
  type: 'ПЗ',
  subject: 'Маркетинг',
  position: 'проф.',
  teacher: 'Минаев Д.В.',
  room: '212',
  ...over,
});

const file = (lessons, groupCode = 'ЭК-3-24-03') => ({ groupCode, lessons });
const TODAY = '2026-10-01';

test('no notification when nothing changed', () => {
  const files = new Map([['a', file([lesson()])]]);
  assert.deepEqual(computeNotifications(files, structuredClone(files), TODAY), []);
});

test('a changed room produces one notification for that group with the details', () => {
  const oldFiles = new Map([['a', file([lesson({ room: '212' })])]]);
  const newFiles = new Map([['a', file([lesson({ room: '305' })])]]);
  const [n] = computeNotifications(oldFiles, newFiles, TODAY);
  assert.equal(n.slug, 'a');
  assert.equal(n.title, 'Изменилось расписание ЭК-3-24-03');
  assert.match(n.body, /Маркетинг/);
  assert.match(n.body, /212→305/);
});

test('a group we have never seen before is not announced as changed', () => {
  const oldFiles = new Map();
  const newFiles = new Map([['a', file([lesson()])]]);
  assert.deepEqual(computeNotifications(oldFiles, newFiles, TODAY), []);
});

test('an empty new schedule is treated as a data problem, not a mass cancellation', () => {
  const oldFiles = new Map([['a', file([lesson()])]]);
  const newFiles = new Map([['a', file([])]]);
  assert.deepEqual(computeNotifications(oldFiles, newFiles, TODAY), []);
});

test('changes only in past lessons do not notify', () => {
  const oldFiles = new Map([['a', file([lesson({ date: '2026-09-02' }), lesson()])]]);
  const newFiles = new Map([['a', file([lesson()])]]);
  assert.deepEqual(computeNotifications(oldFiles, newFiles, TODAY), []);
});

test('describeDiff caps the message length and counts the rest', () => {
  const added = Array.from({ length: 6 }, (_, i) => lesson({ date: `2026-10-${10 + i}`, subject: `Предмет ${i}` }));
  const text = describeDiff({ added, removed: [], changed: [] });
  assert.equal(text.split('\n').length, 4);
  assert.match(text, /…и ещё 3$/);
});

test('suspiciousReason stays quiet for ordinary changes', () => {
  const oldFiles = new Map([['a', file([lesson()])], ['b', file([lesson()])]]);
  assert.equal(suspiciousReason(oldFiles, oldFiles, 1), null);
});

test('suspiciousReason flags a big drop in the number of groups', () => {
  const oldFiles = new Map(Array.from({ length: 10 }, (_, i) => [`g${i}`, file([lesson()])]));
  const newFiles = new Map(Array.from({ length: 5 }, (_, i) => [`g${i}`, file([lesson()])]));
  assert.match(suspiciousReason(oldFiles, newFiles, 0), /групп упало/);
});

test('suspiciousReason flags when most groups change at once', () => {
  const oldFiles = new Map(Array.from({ length: 30 }, (_, i) => [`g${i}`, file([lesson()])]));
  assert.match(suspiciousReason(oldFiles, oldFiles, 20), /из 30 групп сразу/);
});

test('suspiciousReason has nothing to compare on the very first run', () => {
  assert.equal(suspiciousReason(new Map(), new Map([['a', file([lesson()])]]), 0), null);
});

test('sendGroupNotification targets the group tag and keeps the API key only in the header', async () => {
  let captured;
  const fakeFetch = async (url, init) => {
    captured = { url, init };
    return { ok: true, status: 200, text: async () => '{"id":"x"}' };
  };
  await sendGroupNotification({
    appId: 'app-123',
    apiKey: 'SECRET-KEY',
    groupSlug: 'slug-1',
    title: 'Заголовок',
    body: 'Текст',
    url: 'https://example.github.io/repo/',
    fetchImpl: fakeFetch,
  });

  assert.equal(captured.init.headers.Authorization, 'Key SECRET-KEY');
  assert.equal(captured.init.body.includes('SECRET-KEY'), false, 'key must not appear in the body');
  const payload = JSON.parse(captured.init.body);
  assert.equal(payload.app_id, 'app-123');
  assert.deepEqual(payload.filters, [{ field: 'tag', key: 'group', relation: '=', value: 'slug-1' }]);
  assert.equal(payload.contents.ru, 'Текст');
});

test('sendGroupNotification reports an HTTP error without echoing the API key', async () => {
  const fakeFetch = async () => ({ ok: false, status: 400, text: async () => 'bad request' });
  await assert.rejects(
    sendGroupNotification({
      appId: 'a',
      apiKey: 'SECRET-KEY',
      groupSlug: 's',
      title: 't',
      body: 'b',
      fetchImpl: fakeFetch,
    }),
    (err) => err.message.includes('400') && !err.message.includes('SECRET-KEY')
  );
});
