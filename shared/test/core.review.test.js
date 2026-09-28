/* Review-Tests (unabhängige Prüfung) für die „reinen" Module: Uhr, Format, Status, Filter, IDs,
   Chats, Migration. Ziel: Randfälle und kaputte Eingaben, die der Bau-Agent nicht getestet hat.
   Jeder Test, der einen gefundenen Fehler abdeckt, nennt ihn im Namen („Fehler: …"). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS, STATUS_KEYS, DISTRICTS } from '../constants.js';
import { now, setClockOffset, getClockOffset, todayISO, isoOf, isoFromTs, parseISO, weekdayMon0, addDays, dayDiff, tsAt, HOUR, DAY } from '../clock.js';
import { fmtTime, fmtRelative, fmtDateLong, fmtDayLabel, fmtCountdown, fmtBytes, fmtDateShort, fmtMessageTime, fmtRemaining } from '../format.js';
import { effectiveStatus, statusInfo, confirmedLabel, expiresIn, withLiveStatus, sortPractices } from '../status.js';
import { applyFilters, EMPTY_FILTERS, districtShort, is24hPractice, hiddenByOnlyConfirmed } from '../filters.js';
import { uid } from '../ids.js';
import { chatView, mySide, visibleChats, unreadTotal, lastMessage, newMessage, normalizeChat, upsertMessage, previewText } from '../chats.js';
import { migrateV1, parseLegacyTime, applyMigration } from '../migrate.js';
import { buildDemoSeed, buildEmptySeed } from '../seed.js';

const T = new Date(2026, 8, 26, 10, 0, 0).getTime(); // Sa, 26.09.2026 10:00 (lokal)
const live = (value, setAt = T - HOUR, hours = 24) => ({ value, setAt, expiresAt: setAt + hours * HOUR });

/* ------------------------------------------------------------------ Uhr */
test('Uhr: Versatz verschiebt now(), ungültige Werte setzen auf 0 zurück', () => {
  const before = getClockOffset();
  try {
    assert.equal(setClockOffset(DAY), DAY);
    assert.ok(Math.abs(now() - (Date.now() + DAY)) < 50);
    assert.equal(setClockOffset('abc'), 0);
    assert.equal(setClockOffset(Infinity), 0);
    assert.equal(setClockOffset('3600000'), 3600000, 'Zahl als Text wird akzeptiert');
    assert.equal(setClockOffset(1.6), 2, 'wird gerundet');
  } finally { setClockOffset(before); }
});

test('Fehler: parseISO akzeptierte unmögliche Daten (31.02., Monat 13) → jetzt null', () => {
  assert.deepEqual(parseISO('2026-02-28'), { y: 2026, m: 2, d: 28 });
  assert.equal(parseISO('2026-02-29'), null, '2026 ist kein Schaltjahr');
  assert.deepEqual(parseISO('2028-02-29'), { y: 2028, m: 2, d: 29 });
  for (const bad of ['2026-02-31', '2026-13-01', '2026-00-10', '2026-04-31', '2026-06-00', '26-06-04', '2026-6-4', '', null, undefined, 20260604, '2026-06-04T00:00']) {
    assert.equal(parseISO(bad), null, String(bad));
  }
  assert.equal(fmtDateLong('2026-13-45'), '', 'kein „45. undefined 2026" mehr');
  assert.equal(fmtDateShort('2026-02-31'), '');
  assert.equal(addDays('2026-02-31', 1), '2026-02-31', 'ungültig bleibt unverändert');
  assert.ok(Number.isNaN(tsAt('2026-02-31', '10:00')));
});

test('Fehler: todayISO(NaN)/isoFromTs(NaN) lieferten „NaN-NaN-NaN"', () => {
  assert.match(todayISO(NaN), /^\d{4}-\d{2}-\d{2}$/, 'NaN → aktuelle Zeit');
  assert.match(todayISO(undefined), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(isoFromTs(NaN), '');
  assert.equal(isoFromTs(new Date(2026, 0, 5)), '2026-01-05', 'Date-Objekte gehen weiterhin');
  assert.equal(todayISO(T), '2026-09-26');
});

test('Uhr: Zeitumstellung (Ende März/Oktober) verschiebt keine Kalendertage', () => {
  // Europe/Vienna: 29.03.2026 und 25.10.2026 haben 23 bzw. 25 Stunden.
  assert.equal(addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(dayDiff('2026-03-28', '2026-03-30'), 2);
  assert.equal(dayDiff('2026-10-24', '2026-10-26'), 2);
  assert.equal(weekdayMon0('2026-09-28'), 0, 'Montag');
  assert.equal(weekdayMon0('2026-09-27'), 6, 'Sonntag');
  assert.equal(isoOf(2026, 11, 31), '2026-12-31');
  // Mitternacht rund um die Umstellung: lokales Datum, nicht UTC
  assert.equal(todayISO(new Date(2026, 2, 29, 0, 30).getTime()), '2026-03-29');
  assert.equal(todayISO(new Date(2026, 9, 25, 1, 30).getTime()), '2026-10-25');
});

/* ------------------------------------------------------------------ Format */
test('Fehler: fmtDayLabel lieferte bei ungültigem Datum „Heute"', () => {
  assert.equal(fmtDayLabel('garbage', T), '');
  assert.equal(fmtDayLabel('', T), '');
  assert.equal(fmtDayLabel(undefined, T), '');
  assert.equal(fmtDayLabel('2026-09-26', T), 'Heute');
  assert.equal(fmtDayLabel('2026-09-27', T), 'Morgen');
  assert.equal(fmtDayLabel('2026-09-25', T), 'Gestern');
  assert.equal(fmtDayLabel('2026-09-30', T), 'Mi, 30.09.');
});

test('Fehler: fmtBytes zeigte „1024 KB" statt „1 MB"', () => {
  assert.equal(fmtBytes(1048575), '1 MB');
  assert.equal(fmtBytes(1024 * 1024 * 1024 - 1), '1 GB');
  assert.equal(fmtBytes(0), '0 B');
  assert.equal(fmtBytes(-5), '0 B');
  assert.equal(fmtBytes(NaN), '0 B');
  assert.equal(fmtBytes('2048'), '2 KB');
  assert.equal(fmtBytes(1536), '1,5 KB');
  assert.equal(fmtBytes(10 * 1024 * 1024), '10 MB');
  assert.equal(fmtBytes(3 * 1024 ** 4), '3072 GB', 'oberste Einheit bleibt GB');
});

test('Format: Zukunft (Uhren zweier Geräte weichen ab), Unsinn, lange Countdowns', () => {
  assert.equal(fmtRelative(T + 5 * 60000, T), '10:05', 'leicht in der Zukunft → Uhrzeit statt „vor -5 Min."');
  assert.equal(fmtRelative(T - 30 * 1000, T), 'jetzt');
  assert.equal(fmtRelative(T - 5 * 60000, T), 'vor 5 Min.');
  assert.equal(fmtRelative('jetzt', T), '');
  assert.equal(fmtRelative(NaN, T), '');
  assert.equal(fmtTime(null), '');
  assert.equal(fmtMessageTime(undefined, T), '');
  assert.equal(fmtCountdown(-1), '00:00:00');
  assert.equal(fmtCountdown(NaN), '00:00:00');
  assert.equal(fmtCountdown(100 * 3600 * 1000), '100:00:00');
  assert.equal(fmtRemaining(0), 'abgelaufen');
  assert.equal(fmtRemaining(1), 'noch 1 Min.');
  assert.equal(fmtRemaining(2 * HOUR), 'noch 2 Std.');
});

/* ------------------------------------------------------------------ Status */
test('Fehler: Prototyp-Schlüssel („toString", „constructor", „__proto__") galten als gültiger Status', () => {
  for (const v of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf']) {
    assert.equal(effectiveStatus({ status: { value: v, setAt: T - 1000, expiresAt: T + HOUR } }, T), 'grey', 'Objekt: ' + v);
    assert.equal(effectiveStatus({ status: v }, T), 'grey', 'Legacy-Text: ' + v);
    assert.equal(statusInfo(v), STATUS.grey, 'statusInfo: ' + v);
    assert.equal(expiresIn({ status: { value: v, expiresAt: T + HOUR } }, T), null);
  }
  // Sortierung: Eine Praxis mit Unsinn-Status darf NICHT vor den grünen landen.
  const list = [
    { name: 'Zeta', status: live('green') },
    { name: 'Alpha', status: 'toString' },
    { name: 'Beta', status: { value: 'constructor', setAt: T, expiresAt: T + HOUR } },
    { name: 'Rot', status: live('red') },
  ];
  assert.deepEqual(sortPractices(list, T).map((p) => p.name), ['Zeta', 'Alpha', 'Beta', 'Rot']);
  const shown = withLiveStatus(list, T);
  assert.deepEqual(shown.map((p) => p.status), ['green', 'grey', 'grey', 'red']);
  assert.ok(shown.every((p) => p.statusInfo && typeof p.statusInfo.rank === 'number'));
  assert.equal(applyFilters(list, { onlyConfirmed: true }, T).length, 2, 'Unsinn-Status zählt als unbestätigt');
});

test('Status: unbekannte Werte, Grenzen, Abwesenheit mit vertauschtem Zeitraum', () => {
  for (const v of ['GREEN', 'blue', '', null, 42, 'grey']) {
    assert.equal(effectiveStatus({ status: { value: v, setAt: T, expiresAt: T + HOUR } }, T), 'grey', String(v));
  }
  assert.equal(effectiveStatus({ status: live('yellow') }, T), 'yellow');
  assert.equal(effectiveStatus({ status: { value: 'green', setAt: T - DAY, expiresAt: T } }, T), 'green', 'genau am Ablauf noch gültig');
  assert.equal(effectiveStatus({ status: { value: 'green', setAt: T - DAY, expiresAt: T } }, T + 1), 'grey');
  assert.equal(effectiveStatus({ status: live('green'), absence: { from: T + HOUR, to: T - HOUR } }, T), 'green', 'vertauschter Zeitraum deckt nichts ab');
  assert.equal(effectiveStatus({ status: live('green'), absence: { from: 'gestern', to: 'morgen' } }, T), 'green', 'Texte statt ts = keine Abwesenheit');
  assert.equal(effectiveStatus({ status: live('green'), absence: { from: T - HOUR } }, T), 'red', 'offenes Ende');
  assert.equal(effectiveStatus(null, T), 'grey');
  assert.equal(confirmedLabel({ status: { value: 'green', setAt: T + DAY, expiresAt: T + 2 * DAY } }, T), '27.09., 10:00', 'setAt in der Zukunft (Zeit zurückgedreht)');
  assert.equal(confirmedLabel({}, T), 'noch nie');
  // Idempotenz auch nach Ablauf zwischen zwei Aufrufen
  const once = withLiveStatus([{ id: 'a', name: 'A', status: live('green', T - HOUR, 2) }], T);
  const twice = withLiveStatus(once, T + 3 * HOUR);
  assert.equal(once[0].status, 'green');
  assert.equal(twice[0].status, 'grey', 'Live-Kopie läuft trotzdem ab');
  assert.equal(twice[0].emergency, STATUS.grey.notice);
  assert.deepEqual(STATUS_KEYS, ['green', 'yellow', 'grey', 'red']);
});

/* ------------------------------------------------------------------ Filter */
test('Filter: Umlaute, Langnamen, unbekannte Bezirke, 24h-Erkennung, leere Eingaben', () => {
  const seed = buildDemoSeed(T);
  assert.ok(DISTRICTS.includes('Völkermarkt'));
  assert.equal(districtShort('Völkermarkt'), 'Völkermarkt');
  assert.equal(districtShort('Spittal an der Drau'), 'Spittal');
  assert.equal(districtShort('St. Veit an der Glan'), 'St. Veit');
  assert.equal(districtShort('Atlantis'), 'Atlantis');
  assert.equal(applyFilters(seed.practices, { districts: ['Atlantis'] }, T).length, 0);
  assert.equal(applyFilters(seed.practices, { districts: ['Spittal an der Drau'] }, T).length, applyFilters(seed.practices, { districts: ['Spittal'] }, T).length);
  assert.equal(applyFilters(null, null, T).length, 0);
  assert.equal(applyFilters([null, undefined, 5, 'x', ['arr']], EMPTY_FILTERS, T).length, 0, 'Fehler: Zahl/Text wurden zu Schein-Praxen');
  assert.equal(sortPractices([5, null, { name: 'A', status: live('green') }], T).length, 1);
  assert.equal(applyFilters(seed.practices, { animals: 'cat' }, T).length, seed.practices.length, 'kein Array = kein Filter');
  assert.equal(is24hPractice({ hoursShort: 'Mo–Fr 8–24' }), false, '„8–24" ist nicht 24 h');
  assert.equal(is24hPractice({ hoursShort: '24 Stunden' }), true);
  assert.equal(is24hPractice({ hoursWeek: Array(7).fill('24 h') }), true);
  assert.equal(is24hPractice({ hoursWeek: Array(6).fill('24 h') }), false);
  assert.equal(hiddenByOnlyConfirmed(seed.practices, { onlyConfirmed: false }, T), 0);
  assert.ok(hiddenByOnlyConfirmed(seed.practices, { onlyConfirmed: true }, T) >= 3, 'die drei abgelaufenen Demo-Praxen');
  // Eingabe wird nicht verändert
  const before = JSON.stringify(seed.practices);
  applyFilters(seed.practices, { onlyGreen: true, animals: ['dog'] }, T);
  assert.equal(JSON.stringify(seed.practices), before, 'applyFilters verändert die Originale nicht');
});

/* ------------------------------------------------------------------ IDs */
test('uid: 20 000 IDs in einer Schleife sind eindeutig und haben das Präfix-Format', () => {
  const set = new Set();
  for (let i = 0; i < 20000; i++) set.add(uid('m'));
  assert.equal(set.size, 20000);
  const id = uid('ch-');
  assert.match(id, /^ch-[0-9a-z]+$/, 'Bindestrich am Präfix wird nicht verdoppelt');
  assert.match(uid(), /^id-/);
  assert.match(uid(null), /^id-/);
});

/* ------------------------------------------------------------------ Chats */
test('Chats: XSS-/Emoji-/Umlaut-Texte bleiben WORTGETREU (escapen ist Sache der Oberfläche)', () => {
  const evil = '<img src=x onerror="alert(1)"><script>alert(2)</script> & "Quote" ‮abc';
  const m = newMessage({ text: evil, from: 'clinic', meta: { note: '<b>x</b>' } });
  assert.equal(m.text, evil);
  assert.deepEqual(m.meta, { note: '<b>x</b>' });
  const emoji = 'Grüße an Bälu 🐶🐾 — Öl? ß';
  assert.equal(newMessage({ text: emoji }).text, emoji);
  assert.equal(previewText({ text: '🐶'.repeat(200), from: 'owner' }).length <= 121 + 200, true);
  assert.equal(newMessage({ from: '__proto__' }).from, 'owner', 'unbekannte Seite → owner');
  assert.equal(newMessage({ type: 'video' }).type, 'text');
  assert.equal(typeof newMessage({}).ts, 'number');
  assert.equal(newMessage({ text: 42 }).text, '42');
});

test('Fehler: upsertMessage stürzte bei kaputtem Ereignis (null) ab', () => {
  const list = [{ id: 'a', ts: 1 }];
  const r = upsertMessage(list, null);
  assert.equal(r.added, false);
  assert.deepEqual(r.messages, list);
  assert.equal(upsertMessage(list, 'text').added, false);
  // Einsortieren nach ts, Abgleich per clientMsgId (optimistisch → Server-ID)
  const r2 = upsertMessage([{ id: 'a', ts: 1 }, { id: 'b', ts: 3 }], { id: 'c', ts: 2 });
  assert.deepEqual(r2.messages.map((x) => x.id), ['a', 'c', 'b']);
  const r3 = upsertMessage([{ id: 'loc', clientMsgId: 'loc', ts: 1, pending: true, failed: true }], { id: 'srv', clientMsgId: 'loc', ts: 2 });
  assert.equal(r3.added, false);
  assert.deepEqual(r3.messages, [{ id: 'srv', clientMsgId: 'loc', ts: 2 }], 'pending/failed fallen weg');
  const r4 = upsertMessage([], { id: 'x' });
  assert.equal(r4.added, true, 'ohne ts hinten anhängen');
});

test('Chats: Netzwerk-Sicht beider Praxen, fremde Chats unsichtbar, kaputte Datensätze', () => {
  const net = normalizeChat({ id: 'n', kind: 'network', practiceId: 'a', peerPracticeId: 'b', unread: { owner: 2, clinic: 5 }, pinned: { owner: true } }, T);
  assert.equal(mySide(net, { role: 'clinic', practiceId: 'a' }), 'clinic');
  assert.equal(mySide(net, { role: 'clinic', practiceId: 'b' }), 'owner');
  assert.equal(chatView(net, { role: 'clinic', practiceId: 'b' }, [{ id: 'a', name: 'Praxis A' }]).title, 'Praxis A');
  assert.equal(chatView(net, { role: 'clinic', practiceId: 'b' }, []).unread, 2);
  assert.equal(chatView(net, { role: 'clinic', practiceId: 'b' }, []).pinned, true);
  assert.equal(chatView(net, { role: 'clinic', practiceId: 'c' }, []), null, 'dritte Praxis sieht nichts');
  assert.equal(chatView(net, { role: 'owner', ownerId: 'owner-demo' }, []), null, 'Tierhalter:innen sehen kein Netzwerk');
  assert.equal(chatView(net, null, []), null);
  const bad = normalizeChat({ kind: 'evil', unread: { owner: -3, clinic: 'x' }, messages: [null, 5, 'x', { id: 'm1', ts: 3 }], labels: ['a', 5, null, { x: 1 }], peerPracticeId: 'zz' }, T);
  assert.equal(bad.kind, 'direct');
  assert.deepEqual(bad.unread, { owner: 0, clinic: 0 });
  assert.equal(bad.messages.length, 1);
  assert.deepEqual(bad.labels, ['a']);
  assert.equal('peerPracticeId' in bad, false, 'peer nur bei network');
  assert.equal(lastMessage(null), null);
  const state = {
    auth: { role: 'owner', ownerId: 'owner-demo' }, settings: { enableOwner: true },
    chats: [
      normalizeChat({ id: 'x1', kind: 'direct', ownerId: 'owner-demo', unread: { owner: 3 } }, T),
      normalizeChat({ id: 'x2', kind: 'direct', ownerId: 'owner-other', unread: { owner: 9 } }, T),
      null,
    ],
  };
  assert.equal(unreadTotal(state), 3, 'fremde Chats zählen nicht');
  assert.equal(visibleChats({ ...state, settings: { enableOwner: false } }).length, 0, 'Rubrik ausgeschaltet');
  assert.equal(visibleChats({ ...state, auth: { role: null } }).length, 0, 'abgemeldet → nichts');
});

/* ------------------------------------------------------------------ Migration */
test('Fehler: parseLegacyTime lieferte für „25:99" / „31.02." falsche Zeitstempel', () => {
  assert.equal(parseLegacyTime('25:99', T), null);
  assert.equal(parseLegacyTime('23:60', T), null);
  assert.equal(parseLegacyTime('31.02.', T), null);
  assert.equal(parseLegacyTime('32.01.2026', T), null);
  assert.equal(parseLegacyTime('Gestern 24:00', T), null);
  assert.equal(parseLegacyTime('09:30', T), new Date(2026, 8, 26, 9, 30).getTime());
  assert.equal(parseLegacyTime('Gestern 16:20', T), new Date(2026, 8, 25, 16, 20).getTime());
  assert.equal(parseLegacyTime('Mo 19:02', T), new Date(2026, 8, 21, 19, 2).getTime());
  assert.equal(parseLegacyTime('02.06.', T), new Date(2026, 5, 2, 12, 0).getTime());
  assert.equal(parseLegacyTime('24.12.', T), new Date(2025, 11, 24, 12, 0).getTime(), 'Zukunft ohne Jahr → letztes Jahr');
  assert.equal(parseLegacyTime('29.02.2028 08:00', T), new Date(2028, 1, 29, 8, 0).getTime());
  assert.equal(parseLegacyTime('jetzt', T), null);
  assert.equal(parseLegacyTime(null, T), null);
});

test('Migration: kaputte/fremde/riesige Altdaten brechen nie ab und erzeugen nie Zukunfts-Zeitstempel', () => {
  const garbage = migrateV1({ chats: '{kaputt', labels: 'null', settings: '[1,2]', auth: '"owner"', hideTestData: 'vielleicht' }, T);
  assert.deepEqual(garbage.chats, []);
  assert.equal(garbage.labels, null);
  assert.equal(garbage.settings, null);
  assert.equal(garbage.auth, null);
  assert.equal(garbage.hideTestData, null);
  assert.equal(garbage.report.errors.length, 1);
  assert.deepEqual(migrateV1({ chats: { not: 'a list' } }, T).report.errors, ['vn_chats_v1: keine Liste — übersprungen.']);
  const r = migrateV1({ chats: [
    { id: 'mine', role: 'owner', title: 'Tierarztpraxis Drautal', sub: 'Villach · Balu (Hund)', messages: [
      { from: 'owner', text: 'Hallo 🐶 <b>fett</b>', time: 'jetzt' },
      { from: 'clinic', text: 'Hi', time: '25:99' },
      { from: 'owner', text: 'x', time: '31.02.' },
    ] },
    { id: 'mine', role: 'clinic', title: 'Doppelte ID', messages: [] },
  ] }, T);
  assert.equal(r.chats.length, 2);
  assert.notEqual(r.chats[0].id, r.chats[1].id, 'doppelte IDs werden aufgelöst');
  const ts = r.chats[0].messages.map((m) => m.ts);
  assert.ok(ts.every((x) => Number.isFinite(x) && x <= T), 'keine Zukunft, keine NaN');
  assert.ok(ts[0] < ts[1] && ts[1] < ts[2], 'Reihenfolge bleibt');
  assert.ok(T - ts[0] < 10 * 60000, 'ungültige Zeiten → kurz vor „jetzt" statt Monate zurück');
  assert.equal(r.chats[0].messages[0].text, 'Hallo 🐶 <b>fett</b>', 'wortgetreu');
  // Groß: 2 000 Chats × 20 Nachrichten
  const big = Array.from({ length: 2000 }, (_, i) => ({ id: 'c' + i, role: 'clinic', title: 'T' + i, messages: Array.from({ length: 20 }, (_, j) => ({ from: j % 2 ? 'owner' : 'clinic', text: 'm' + j, time: 'jetzt' })) }));
  const t0 = Date.now();
  const rb = migrateV1({ chats: JSON.stringify(big) }, T);
  assert.equal(rb.chats.length, 2000);
  assert.equal(rb.report.messages, 40000);
  assert.ok(Date.now() - t0 < 5000, 'unter 5 s');
  // applyMigration lässt den Seed unangetastet
  const seed = buildEmptySeed(T);
  const snap = JSON.stringify(seed);
  applyMigration(seed, r);
  assert.equal(JSON.stringify(seed), snap);
});
