import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chatView, mySide, visibleChats, unreadTotal, lastMessage, newMessage, upsertMessage, labelsForRole, previewText, normalizeChat,
} from '../chats.js';
import { buildDemoSeed } from '../seed.js';
import { defaultSettings, seedLabels } from '../constants.js';

const NOW = new Date(2026, 8, 24, 12, 0).getTime();
const seed = buildDemoSeed(NOW);
const OWNER = { role: 'owner', name: 'Familie Berger', ownerId: 'owner-demo' };
const DRAUTAL = { role: 'clinic', name: 'Tierarztpraxis Drautal', practiceId: 'drautal' };
const WOERTHERSEE = { role: 'clinic', name: 'Tiernotdienst Wörthersee 24h', practiceId: 'woerthersee' };
const st = (auth, settings = {}) => ({ chats: seed.chats, practices: seed.practices, auth, settings: { ...defaultSettings(), ...settings } });
const chat = (id) => seed.chats.find((c) => c.id === id);

test('Tierhalter:in sieht nur eigene request/direct-Chats, Titel = Praxis', () => {
  const v = visibleChats(st(OWNER));
  assert.deepEqual(v.map((x) => x.id).sort(), ['ch-berger-drautal', 'ch-berger-feldkirchen', 'ch-berger-woerthersee']);
  const balu = v.find((x) => x.id === 'ch-berger-drautal');
  assert.equal(balu.rubric, 'owner');
  assert.equal(balu.side, 'owner');
  assert.equal(balu.title, 'Tierarztpraxis Drautal');
  assert.equal(balu.subtitle, 'Villach · Balu (Hund)');
  assert.equal(v[0].id, 'ch-berger-drautal', 'für die Tierhalter:in angepinnt → oben');
  assert.equal(unreadTotal(st(OWNER)), 1);
});

test('Praxis Drautal: Posteingang + Netzwerk, Titel = Tierhalter:in bzw. andere Praxis', () => {
  const v = visibleChats(st(DRAUTAL));
  assert.equal(v.length, 6);
  const balu = v.find((x) => x.id === 'ch-berger-drautal');
  assert.equal(balu.rubric, 'clinic');
  assert.equal(balu.title, 'Familie Berger');
  assert.equal(balu.subtitle, 'Balu (Hund) · Lahmheit');
  assert.equal(balu.unread, 2);
  const net = v.find((x) => x.id === 'ch-net-drautal-woerthersee');
  assert.equal(net.rubric, 'network');
  assert.equal(net.side, 'clinic');
  assert.equal(net.title, 'Tiernotdienst Wörthersee 24h');
  assert.equal(net.subtitle, 'Vertretung & Überweisung');
  assert.deepEqual(v.slice(0, 2).map((x) => x.pinned), [true, true], 'angepinnte zuerst');
  const rest = v.slice(2).map((x) => x.lastTs);
  assert.deepEqual(rest, rest.slice().sort((a, b) => b - a), 'danach neueste zuerst');
  assert.equal(unreadTotal(st(DRAUTAL)), 3);
});

test('Netzwerk aus Sicht der angeschriebenen Praxis: Seite "owner"', () => {
  const c = chat('ch-net-drautal-woerthersee');
  assert.equal(mySide(c, WOERTHERSEE), 'owner');
  assert.equal(mySide(c, DRAUTAL), 'clinic');
  assert.equal(mySide(c, OWNER), 'owner');
  assert.equal(mySide(c, { role: null }), null);
  const v = chatView(c, WOERTHERSEE, seed.practices);
  assert.equal(v.rubric, 'network');
  assert.equal(v.title, 'Tierarztpraxis Drautal');
  const own = visibleChats(st(WOERTHERSEE)).map((x) => x.id).sort();
  assert.deepEqual(own, ['ch-berger-woerthersee', 'ch-net-drautal-woerthersee']);
});

test('Sichtbarkeit: abgemeldet, Bereiche aus, Testdaten aus, fremde Chats', () => {
  assert.deepEqual(visibleChats(st({ role: null, name: '' })), []);
  assert.deepEqual(visibleChats(st(DRAUTAL, { enablePosteingang: false })).map((x) => x.rubric), ['network', 'network']);
  assert.equal(visibleChats(st(DRAUTAL, { enableNetwork: false })).length, 4);
  assert.equal(visibleChats(st(OWNER, { enableOwner: false })).length, 0);
  assert.equal(visibleChats(st(OWNER, { hideTestData: true })).length, 0);
  assert.equal(chatView(chat('ch-wieser-drautal'), OWNER, seed.practices), null, 'fremde Tierhalterin');
  assert.equal(chatView(chat('ch-berger-feldkirchen'), DRAUTAL, seed.practices), null, 'andere Praxis');
});

test('Eigene Titel pro Seite und Labels pro Rolle', () => {
  const c = { ...chat('ch-berger-drautal'), titles: { owner: 'Balus Tierarzt' } };
  assert.equal(chatView(c, OWNER, seed.practices).title, 'Balus Tierarzt');
  assert.equal(chatView(c, DRAUTAL, seed.practices).title, 'Familie Berger', 'andere Seite unberührt');
  const ownerLabels = labelsForRole(seedLabels(), 'owner').map((l) => l.id);
  assert.ok(!ownerLabels.includes('posteingang') && !ownerLabels.includes('netzwerk'));
  assert.ok(ownerLabels.includes('notfall'));
});

test('newMessage, lastMessage, previewText', () => {
  const m = newMessage({ from: 'clinic', text: 'Hallo', now: NOW });
  assert.match(m.id, /^m-/);
  assert.equal(m.ts, NOW);
  assert.equal(m.type, 'text');
  assert.equal(newMessage({ from: 'hacker' }).from, 'owner', 'unbekannte Seite → owner');
  assert.equal(lastMessage(chat('ch-berger-drautal')).text, 'Sollen wir sofort kommen?');
  assert.equal(previewText(m, 'clinic'), 'Sie: Hallo');
  assert.equal(previewText({ type: 'image', text: '' }, 'owner'), 'Foto');
  assert.equal(previewText({ deleted: true }), 'Nachricht gelöscht');
  assert.equal(previewText(null), 'Noch keine Nachrichten');
});

test('upsertMessage: Abgleich über clientMsgId, idempotent, nach ts einsortiert', () => {
  const opt = { id: 'm-local', clientMsgId: 'm-local', ts: 100, from: 'owner', text: 'x', pending: true };
  let r = upsertMessage([{ id: 'a', ts: 50 }], opt);
  assert.equal(r.added, true);
  r = upsertMessage(r.messages, { id: 'm-srv-1', clientMsgId: 'm-local', ts: 101, from: 'owner', text: 'x' });
  assert.equal(r.added, false);
  assert.equal(r.messages.length, 2);
  assert.equal(r.messages[1].id, 'm-srv-1');
  assert.equal(r.messages[1].pending, undefined);
  const again = upsertMessage(r.messages, { id: 'm-srv-1', ts: 101, from: 'owner', text: 'x' });
  assert.equal(again.added, false);
  assert.equal(again.messages.length, 2);
  const older = upsertMessage(r.messages, { id: 'm-old', ts: 60 });
  assert.deepEqual(older.messages.map((x) => x.id), ['a', 'm-old', 'm-srv-1']);
});

test('normalizeChat füllt Pflichtfelder und behält Unbekanntes', () => {
  const c = normalizeChat({ kind: 'weird', practiceId: 'drautal', custom: 42, unread: { owner: -3 } }, NOW);
  assert.equal(c.kind, 'direct');
  assert.match(c.id, /^ch-/);
  assert.deepEqual(c.unread, { owner: 0, clinic: 0 });
  assert.deepEqual(c.pinned, { owner: false, clinic: false });
  assert.equal(c.custom, 42);
  assert.equal(c.createdAt, NOW);
});
