import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveStatus, statusInfo, confirmedLabel, expiresIn, withLiveStatus, sortPractices, isAbsentNow,
} from '../status.js';
import { STATUS, STATUS_KEYS } from '../constants.js';
import { HOUR, DAY } from '../clock.js';

// Fester, LOKALER Zeitpunkt: Donnerstag 24.09.2026, 10:00.
const NOW = new Date(2026, 8, 24, 10, 0, 0, 0).getTime();
const P = (status, extra = {}) => ({ id: 'p', name: 'Praxis', status, absence: null, ...extra });

test('Labels und Rangfolge laut Vertrag §4', () => {
  assert.deepEqual(STATUS_KEYS, ['green', 'yellow', 'grey', 'red']);
  assert.equal(STATUS.green.short, 'Erreichbar');
  assert.equal(STATUS.green.long, 'Heute erreichbar');
  assert.equal(STATUS.yellow.short, 'Rücksprache');
  assert.equal(STATUS.yellow.long, 'Nur nach Rücksprache');
  assert.equal(STATUS.grey.short, 'Nicht bestätigt');
  assert.equal(STATUS.grey.long, 'Nicht aktuell bestätigt');
  assert.equal(STATUS.red.short, 'Nicht verfügbar');
  assert.equal(STATUS.red.long, 'Heute nicht verfügbar');
  assert.deepEqual(STATUS_KEYS.map((k) => STATUS[k].rank), [0, 1, 2, 3]);
});

test('effectiveStatus: gültig, abgelaufen, genau an der Grenze', () => {
  const setAt = NOW - 2 * HOUR;
  const p = P({ value: 'green', setAt, expiresAt: setAt + 24 * HOUR });
  assert.equal(effectiveStatus(p, NOW), 'green');
  assert.equal(effectiveStatus(p, setAt + 24 * HOUR), 'green', 'genau bei expiresAt noch gültig');
  assert.equal(effectiveStatus(p, setAt + 24 * HOUR + 1), 'grey', '1 ms danach grau');
  assert.equal(effectiveStatus(P({ value: 'yellow', setAt, expiresAt: NOW + 1 }), NOW), 'yellow');
  assert.equal(effectiveStatus(P({ value: 'red', setAt, expiresAt: NOW + 1 }), NOW), 'red');
});

test('effectiveStatus: fehlend/ungültig/nie bestätigt → grau', () => {
  assert.equal(effectiveStatus(null, NOW), 'grey');
  assert.equal(effectiveStatus({ id: 'x' }, NOW), 'grey');
  assert.equal(effectiveStatus(P({ value: null, setAt: null, expiresAt: null }), NOW), 'grey');
  assert.equal(effectiveStatus(P({ value: 'purple', setAt: NOW, expiresAt: NOW + DAY }), NOW), 'grey');
  assert.equal(effectiveStatus(P({ value: 'grey', setAt: NOW, expiresAt: NOW + DAY }), NOW), 'grey');
  assert.equal(effectiveStatus(P({ value: 'green' }), NOW), 'grey', 'ohne setAt/expiresAt nie bestätigt');
  // v2-Altformat (String) bleibt lesbar
  assert.equal(effectiveStatus({ id: 'old', status: 'yellow' }, NOW), 'yellow');
});

test('Abwesenheit macht rot — nur solange sie „jetzt" abdeckt', () => {
  const ok = { value: 'green', setAt: NOW - HOUR, expiresAt: NOW + 23 * HOUR };
  assert.equal(effectiveStatus(P(ok, { absence: { from: NOW - DAY, to: NOW + DAY } }), NOW), 'red');
  assert.equal(effectiveStatus(P(ok, { absence: { from: NOW - 2 * DAY, to: NOW - DAY } }), NOW), 'green', 'vorbei');
  assert.equal(effectiveStatus(P(ok, { absence: { from: NOW + HOUR, to: NOW + DAY } }), NOW), 'green', 'noch nicht begonnen');
  assert.equal(effectiveStatus(P(ok, { absence: { from: NOW - HOUR } }), NOW), 'red', 'offenes Ende');
  assert.equal(effectiveStatus(P(ok, { absence: {} }), NOW), 'green', 'leeres Objekt = keine Abwesenheit');
  // Abwesenheit schlägt sogar einen abgelaufenen Status
  assert.equal(effectiveStatus(P({ value: 'green', setAt: NOW - 30 * HOUR, expiresAt: NOW - 6 * HOUR }, { absence: { from: NOW - HOUR, to: NOW + HOUR } }), NOW), 'red');
  assert.equal(isAbsentNow(P(ok, { absence: { from: NOW, to: NOW } }), NOW), true, 'Grenzen inklusive');
});

test('confirmedLabel: heute / gestern / vor N Tagen / noch nie', () => {
  const at = (d, h, m) => new Date(2026, 8, d, h, m).getTime();
  assert.equal(confirmedLabel(P({ value: 'green', setAt: at(24, 8, 30), expiresAt: NOW + HOUR }), NOW), 'heute, 08:30');
  assert.equal(confirmedLabel(P({ value: 'green', setAt: at(23, 17, 10), expiresAt: NOW + HOUR }), NOW), 'gestern, 17:10');
  assert.equal(confirmedLabel(P({ value: 'green', setAt: at(22, 9, 0), expiresAt: NOW }), NOW), 'vor 2 Tagen');
  assert.equal(confirmedLabel(P({ value: null, setAt: null, expiresAt: null }), NOW), 'noch nie');
});

test('expiresIn: Restzeit, 0 wenn abgelaufen, null ohne Ablauf', () => {
  assert.equal(expiresIn(P({ value: 'green', setAt: NOW, expiresAt: NOW + 5000 }), NOW), 5000);
  assert.equal(expiresIn(P({ value: 'green', setAt: NOW - DAY, expiresAt: NOW - 1 }), NOW), 0);
  assert.equal(expiresIn(P({ value: 'green', setAt: NOW }), NOW), null);
});

test('withLiveStatus: alte UI-Felder + Grau-Hinweis + idempotent', () => {
  const list = [
    P({ value: 'green', setAt: new Date(2026, 8, 24, 8, 30).getTime(), expiresAt: NOW + 20 * HOUR }, { id: 'a', name: 'A', emergency: 'Nimmt Notfälle an', emergencyLong: 'Lang' }),
    P({ value: 'green', setAt: NOW - 30 * HOUR, expiresAt: NOW - 6 * HOUR }, { id: 'b', name: 'B', emergency: 'Nimmt Notfälle an' }),
    P({ value: 'green', setAt: NOW - HOUR, expiresAt: NOW + HOUR }, { id: 'c', name: 'C', absence: { from: NOW - DAY, to: NOW + DAY, vertretung: 'Tiernotdienst' } }),
  ];
  const live = withLiveStatus(list, NOW);
  assert.equal(live[0].status, 'green');
  assert.equal(live[0].statusInfo.long, 'Heute erreichbar');
  assert.equal(live[0].confirmedAt, 'heute, 08:30');
  assert.equal(live[0].emergency, 'Nimmt Notfälle an');
  assert.ok(live[0].expiresInMs > 0);
  assert.equal(live[1].status, 'grey');
  assert.equal(live[1].isExpired, true);
  assert.equal(live[1].emergency, STATUS.grey.notice, 'grauer Status → Hinweis statt veraltetem Text');
  assert.equal(live[1].emergencyBase, 'Nimmt Notfälle an', 'Original bleibt erhalten');
  assert.equal(live[2].status, 'red');
  assert.equal(live[2].absent, true);
  assert.equal(live[2].vertretung, 'Tiernotdienst');
  assert.match(live[2].emergency, /abwesend/);
  assert.equal(list[0].status.value, 'green', 'Original nicht verändert');
  const twice = withLiveStatus(live, NOW);
  assert.deepEqual(twice.map((p) => [p.status, p.emergency, p.confirmedAt]), live.map((p) => [p.status, p.emergency, p.confirmedAt]));
  assert.equal(statusInfo('nonsense').key, 'grey');
});

test('sortPractices: grün < gelb < grau < rot, dann alphabetisch (Umlaute)', () => {
  const mk = (id, name, value, expired) => P({ value, setAt: NOW - HOUR, expiresAt: expired ? NOW - 1 : NOW + HOUR }, { id, name });
  const sorted = sortPractices([
    mk('r', 'Rot', 'red'), mk('g2', 'Zeta', 'green'), mk('y', 'Gelb', 'yellow'),
    mk('gr', 'Grau', 'green', true), mk('g1', 'Ötztal', 'green'), mk('g0', 'Alpha', 'green'),
  ], NOW);
  assert.deepEqual(sorted.map((p) => p.id), ['g0', 'g1', 'g2', 'y', 'gr', 'r']);
});
