import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, EMPTY_FILTERS, hiddenByOnlyConfirmed, describeFilters, districtShort, is24hPractice } from '../filters.js';
import { buildDemoSeed } from '../seed.js';

const NOW = new Date(2026, 8, 24, 12, 0).getTime();
const { practices } = buildDemoSeed(NOW);
const ids = (list) => list.map((p) => p.id).sort();

test('ohne Filter: alle 18, grün zuerst, rot zuletzt, Live-Kopien', () => {
  const all = applyFilters(practices, EMPTY_FILTERS, NOW);
  assert.equal(all.length, 18);
  assert.equal(all[0].status, 'green');
  assert.equal(all[all.length - 1].status, 'red');
  const ranks = all.map((p) => p.statusInfo.rank);
  assert.deepEqual(ranks, ranks.slice().sort((a, b) => a - b));
  assert.equal(typeof all[0].confirmedAt, 'string');
});

test('Tierart: ODER innerhalb, „Anderes" passt auf alle', () => {
  assert.deepEqual(ids(applyFilters(practices, { animals: ['horse'] }, NOW)), ['koralpe', 'nassfeld', 'viktring']);
  assert.deepEqual(ids(applyFilters(practices, { animals: ['horse', 'bird'] }, NOW)), ['gurktal', 'klopein', 'koralpe', 'nassfeld', 'viktring']);
  assert.equal(applyFilters(practices, { animals: ['other'] }, NOW).length, 18);
});

test('Situation, Spezialgebiet, Hausbesuch, 24 h', () => {
  assert.deepEqual(ids(applyFilters(practices, { situations: ['euthanasia'] }, NOW)), ['feldkirchen', 'gurktal', 'klagenfurt-zentrum', 'viktring', 'woerthersee']);
  assert.deepEqual(ids(applyFilters(practices, { specialties: ['exoten'] }, NOW)), ['feldkirchen', 'jauntal', 'klopein', 'maria-saal']);
  assert.equal(applyFilters(practices, { housecall: true }, NOW).length, 10);
  assert.deepEqual(ids(applyFilters(practices, { is24h: true }, NOW)), ['woerthersee']);
  assert.equal(is24hPractice({ hoursShort: 'Mo–Fr 8–24' }), false, '„8–24" ist kein 24-h-Betrieb');
  assert.equal(is24hPractice({ hoursShort: '24h' }), true);
});

test('Bezirk: exakter Kurzname, Langnamen werden zurückgeführt', () => {
  assert.deepEqual(ids(applyFilters(practices, { districts: ['Spittal'] }, NOW)), ['lieser', 'millstatt']);
  assert.deepEqual(ids(applyFilters(practices, { districts: ['St. Veit'] }, NOW)), ['gurktal', 'stveit']);
  assert.deepEqual(ids(applyFilters(practices, { districts: ['Villach', 'Hermagor'] }, NOW)), ['drautal', 'faak', 'gailtal', 'nassfeld', 'ossiach']);
  const legacy = [{ ...practices[2], district: 'Spittal an der Drau' }];
  assert.equal(applyFilters(legacy, { districts: ['Spittal'] }, NOW).length, 1);
  assert.equal(districtShort('St. Veit an der Glan'), 'St. Veit');
});

test('Status-Filter nutzen den EFFEKTIVEN Status', () => {
  const confirmed = applyFilters(practices, { onlyConfirmed: true }, NOW);
  assert.equal(confirmed.length, 15, '3 abgelaufene (graue) Praxen fallen weg');
  assert.ok(confirmed.every((p) => p.status !== 'grey'));
  assert.equal(hiddenByOnlyConfirmed(practices, { onlyConfirmed: true }, NOW), 3);
  assert.equal(hiddenByOnlyConfirmed(practices, { onlyConfirmed: false }, NOW), 0);
  const green = applyFilters(practices, { onlyGreen: true }, NOW);
  assert.equal(green.length, 9);
  assert.ok(!green.some((p) => p.id === 'lavanttal'), 'abwesend → rot');
  // 24 h später ist alles abgelaufen → keine grünen mehr
  assert.equal(applyFilters(practices, { onlyGreen: true }, NOW + 25 * 3600e3).length, 0);
});

test('Kombinationen (UND zwischen Kategorien)', () => {
  assert.deepEqual(ids(applyFilters(practices, { animals: ['dog'], districts: ['Villach'], onlyConfirmed: true }, NOW)), ['drautal', 'ossiach']);
  assert.deepEqual(ids(applyFilters(practices, { animals: ['cat'], situations: ['emergency'], districts: ['Klagenfurt'], housecall: true }, NOW)), ['maria-saal']);
  assert.equal(applyFilters(practices, { animals: ['horse'], districts: ['Villach'] }, NOW).length, 0);
  assert.deepEqual(describeFilters({ animals: ['cat'], situations: ['emergency'], districts: ['Villach'], onlyConfirmed: true, is24h: true }), ['Katze', 'Notfall', 'Villach', 'Nur bestätigte', '24 h']);
});
