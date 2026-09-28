/* Brücke Hub-Chats → alte Chat-Form (Web + Handy). Prüft Rollen-Sicht, Absender-Spiegelung
   im Netzwerk, Anhänge und die Rückrichtung. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyChatsFromHub, hubSideFor, legacyTime } from '../legacyview.js';
import { buildDemoSeed } from '../seed.js';

const now = Date.UTC(2026, 8, 28, 10, 0);
const seed = buildDemoSeed(now);
const owner = { role: 'owner', ownerId: 'owner-demo', name: 'Familie Berger' };
const clinic = { role: 'clinic', practiceId: 'drautal', name: 'Tierarztpraxis Drautal' };

test('Tierhalter:in sieht nur eigene Chats als Rubrik owner, Praxis Posteingang + Netzwerk', () => {
  const o = legacyChatsFromHub(seed.chats, owner, seed.practices, { now });
  const c = legacyChatsFromHub(seed.chats, clinic, seed.practices, { now });
  assert.ok(o.length > 0 && o.every((x) => x.role === 'owner' && x.hub));
  assert.ok(c.some((x) => x.role === 'clinic') && c.some((x) => x.role === 'network'));
  assert.ok(c.every((x) => x.role !== 'owner'));
});

test('Nachrichten: from bleibt owner/clinic, Zeit als Text, Bild-Verweis aufgelöst', () => {
  const chat = { id: 'ch-x', kind: 'request', practiceId: 'drautal', ownerId: 'owner-demo', ownerName: 'Test', animal: 'dog', unread: { clinic: 2 }, messages: [
    { id: 'm1', ts: now - 60000, from: 'owner', type: 'text', text: 'Hallo' },
    { id: 'm2', ts: now - 30000, from: 'owner', type: 'image', text: '', attachment: { kind: 'image', ref: 'hub:f123' } },
  ] };
  const [v] = legacyChatsFromHub([chat], clinic, seed.practices, { now, fileUrl: (r) => '/files/' + r.slice(4) });
  assert.equal(v.role, 'clinic');
  assert.equal(v.unread, 2);
  assert.equal(v.messages[0].from, 'owner');
  assert.equal(v.messages[1].src, '/files/f123');
  assert.match(v.messages[0].time, /^\d\d:\d\d$/);
});

test('Netzwerk: ist meine Praxis die Gegenpraxis, werden Absender gespiegelt (und zurück)', () => {
  const chat = { id: 'ch-n', kind: 'network', practiceId: 'woerthersee', peerPracticeId: 'drautal', animal: 'dog', messages: [{ id: 'a', ts: now, from: 'owner', type: 'text', text: 'von Drautal' }] };
  const [v] = legacyChatsFromHub([chat], clinic, seed.practices, { now });
  assert.equal(v.side, 'owner');
  assert.equal(v.messages[0].from, 'clinic'); // „ich" in der alten Oberfläche
  assert.equal(hubSideFor(v, 'clinic'), 'owner');
});

test('legacyTime: heute / gestern / Datum', () => {
  assert.match(legacyTime(now - 3600000, now), /^\d\d:\d\d$/);
  assert.match(legacyTime(now - 86400000, now), /^Gestern /);
  assert.match(legacyTime(now - 5 * 86400000, now), /^\d\d\.\d\d\. /);
});
