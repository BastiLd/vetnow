import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoSeed, buildEmptySeed, SEED_CHAT_IDS } from '../seed.js';
import { DISTRICTS, APPT_STATUS, LABELS_SEED } from '../constants.js';
import { effectiveStatus } from '../status.js';
import { todayISO, addDays, dayDiff, DAY } from '../clock.js';

const NOW = new Date(2026, 8, 24, 12, 0).getTime(); // Do 24.09.2026, 12:00

test('Integrität: 18 Praxen, Bezirke normalisiert, Status gültig', () => {
  const s = buildDemoSeed(NOW);
  assert.equal(s.practices.length, 18);
  assert.equal(new Set(s.practices.map((p) => p.id)).size, 18);
  for (const p of s.practices) {
    assert.ok(DISTRICTS.includes(p.district), p.id + ': Kurzname ' + p.district);
    assert.ok(p.districtLong, p.id + ': districtLong');
    assert.ok(['green', 'yellow', 'red'].includes(p.status.value), p.id + ': value');
    assert.equal(typeof p.status.setAt, 'number');
    assert.equal(p.status.expiresAt - p.status.setAt, 24 * 3600e3);
    assert.equal(p.hoursWeek.length, 7);
    assert.equal(p.isTestData, true);
  }
  assert.equal(s.practices.find((p) => p.id === 'lieser').districtLong, 'Spittal an der Drau');
  const eff = Object.fromEntries(s.practices.map((p) => [p.id, effectiveStatus(p, NOW)]));
  assert.deepEqual(Object.keys(eff).filter((k) => eff[k] === 'grey').sort(), ['faak', 'gailtal', 'stveit']);
  assert.equal(eff.lavanttal, 'red');
  assert.ok(s.practices.find((p) => p.id === 'lavanttal').absence.vertretung);
  assert.ok(s.practices.find((p) => p.id === 'drautal').profile.team.length === 3);
});

test('Integrität: Chats, Nachrichten, Termine verweisen auf Existierendes', () => {
  const s = buildDemoSeed(NOW);
  const pids = new Set(s.practices.map((p) => p.id));
  const cids = new Set(s.chats.map((c) => c.id));
  assert.equal(s.chats.length, 8);
  assert.deepEqual([...cids].sort(), Object.values(SEED_CHAT_IDS).sort());
  const msgIds = new Set();
  for (const c of s.chats) {
    assert.ok(pids.has(c.practiceId), c.id + ' practiceId');
    if (c.kind === 'network') assert.ok(pids.has(c.peerPracticeId), c.id + ' peer');
    else assert.ok(c.ownerId && c.ownerName, c.id + ' owner');
    assert.equal(c.autoReply, true);
    let prev = 0;
    for (const m of c.messages) {
      assert.ok(!msgIds.has(m.id), 'Nachrichten-ID eindeutig: ' + m.id);
      msgIds.add(m.id);
      assert.equal(typeof m.ts, 'number');
      assert.ok(m.ts < NOW, 'keine Nachricht in der Zukunft');
      assert.ok(m.ts >= prev, 'Reihenfolge');
      prev = m.ts;
    }
  }
  for (const a of s.appointments) {
    if (a.chatId) assert.ok(cids.has(a.chatId), 'Termin ' + a.id + ' → Chat ' + a.chatId);
    assert.ok(Object.keys(APPT_STATUS).includes(a.status));
    assert.ok(pids.has(a.practiceId));
    assert.match(a.date, /^\d{4}-\d{2}-\d{2}$/);
  }
  const today = todayISO(NOW);
  const todays = s.appointments.filter((a) => a.date === today);
  assert.equal(todays.length, 7);
  assert.equal(todays.filter((a) => a.chatId).length, 4);
  assert.equal(todays.find((a) => a.time === '08:30').chatId, 'ch-berger-drautal');
  for (const a of s.appointments) {
    const d = dayDiff(today, a.date);
    assert.ok(d >= -7 && d <= 7, 'Termin im Fenster ±7 Tage');
  }
  assert.equal(s.blocks.length, 10);
  assert.deepEqual(s.labels.map((l) => l.id), LABELS_SEED.map((l) => l.id));
});

test('keine festen Daten: zwei verschiedene now → alles wandert mit', () => {
  const a = buildDemoSeed(NOW);
  const b = buildDemoSeed(NOW + 3 * DAY);
  assert.equal(b.practices[0].status.setAt - a.practices[0].status.setAt, 3 * DAY);
  const datesA = [...new Set(a.appointments.map((x) => x.date))];
  const datesB = [...new Set(b.appointments.map((x) => x.date))];
  assert.notDeepEqual(datesA, datesB);
  assert.ok(datesB.includes(todayISO(NOW + 3 * DAY)));
  assert.ok(!datesA.includes(addDays(todayISO(NOW), 8)));
  const lastA = Math.max(...a.chats.flatMap((c) => c.messages.map((m) => m.ts)));
  const lastB = Math.max(...b.chats.flatMap((c) => c.messages.map((m) => m.ts)));
  assert.ok(lastB - lastA >= 2 * DAY, 'Chatverläufe verschieben sich');
});

test('früher Morgen: Heute-Unterhaltungen rutschen komplett auf gestern', () => {
  const early = new Date(2026, 8, 24, 6, 0).getTime();
  const s = buildDemoSeed(early);
  for (const c of s.chats) for (const m of c.messages) assert.ok(m.ts < early, c.id + ' ' + m.id);
  const balu = s.chats.find((c) => c.id === 'ch-berger-drautal');
  const ts = balu.messages.map((m) => m.ts);
  assert.deepEqual(ts, ts.slice().sort((x, y) => x - y));
});

test('buildEmptySeed: keine Testdaten, aber Labels', () => {
  const e = buildEmptySeed(NOW);
  assert.equal(e.practices.length, 0);
  assert.equal(e.chats.length, 0);
  assert.equal(e.appointments.length, 0);
  assert.equal(e.labels.length, 6);
  assert.equal(e.settings.botMode, 'ai-fallback');
});
