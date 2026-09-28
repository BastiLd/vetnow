import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateV1, applyMigration, parseLegacyTime, hasV1Data } from '../migrate.js';
import { buildDemoSeed } from '../seed.js';
import { visibleChats } from '../chats.js';
import { tsAt, todayISO, addDays } from '../clock.js';

const NOW = new Date(2026, 8, 24, 12, 0).getTime(); // Do

/* Fixtures: Demo-Chats 1:1 aus dem alten web/src/data.js (CHATS_SEED) + Chats, wie sie v2 zur
   Laufzeit angelegt hat (Anfrageformular, Fotos Web/Handy, Datei, gelöschte Nachricht). */
const V1_SEED = [
  { id: 'ch-o1', role: 'owner', title: 'Tierarztpraxis Drautal', sub: 'Villach · Balu (Hund)', animal: 'dog', color: '#0f9b8e', icon: 'paw2', labels: ['tiere', 'erledigt'], pinned: true, unread: 1, isTestData: true,
    messages: [{ from: 'owner', text: 'Guten Morgen, unser Hund Balu humpelt seit heute früh und frisst nicht. Können wir heute vorbeikommen?', time: '09:30' }, { type: 'note', text: 'Behandlung verlief gut.', time: 'heute, 11:20' }] },
  { id: 'ch-o2', role: 'owner', title: 'Vetpraxis Feldkirchen', sub: 'Feldkirchen · Luna (Hund)', animal: 'dog', labels: ['tiere'], pinned: false, unread: 0, isTestData: true, messages: [{ from: 'owner', text: 'Bietet ihr Hausbesuche im Raum Feldkirchen an?', time: 'Gestern 11:00' }] },
  { id: 'ch-o3', role: 'owner', title: 'Tiernotdienst Wörthersee 24h', sub: '', animal: 'cat', labels: [], isTestData: true, messages: [] },
  { id: 'ch-c1', role: 'clinic', title: 'Familie Berger', sub: 'Balu (Hund) · Lahmheit', animal: 'dog', labels: ['posteingang'], pinned: true, unread: 2, isTestData: true, messages: [] },
  { id: 'ch-c2', role: 'clinic', title: 'Frau Wieser', isTestData: true, messages: [] },
  { id: 'ch-c3', role: 'clinic', title: 'Herr Tomaschitz', isTestData: true, messages: [] },
  { id: 'ch-c4', role: 'clinic', title: 'Familie Novak', isTestData: true, messages: [] },
  { id: 'ch-n1', role: 'network', title: 'Tiernotdienst Wörthersee 24h', isTestData: true, messages: [{ from: 'clinic', text: 'Servus Kolleg:innen!', time: 'Fr 14:10' }] },
  { id: 'ch-n2', role: 'network', title: 'Pferdeklinik Viktring', isTestData: true, messages: [] },
];
const USER_CHATS = [
  { id: 'ch-a1b2c3', role: 'owner', title: 'Vetpraxis Feldkirchen', sub: 'Feldkirchen · Hund · Notfall', animal: 'dog', color: '#0f9b8e', icon: 'dog', labels: ['tiere'], pinned: false, unread: 1, isTestData: false,
    messages: [
      { from: 'owner', text: 'Hilfe, unser Hund frisst nicht.', time: 'jetzt' },
      { id: 'm-xyz', from: 'clinic', text: 'Bitte kommen Sie vorbei.', time: 'jetzt', source: 'ai', aiModel: 'qwen2.5:3b' },
      { id: 'm-img', from: 'owner', type: 'image', src: 'data:image/png;base64,iVBORw0KGgo=', text: '', time: 'jetzt' },
      { from: 'owner', type: 'image', src: 'file:///data/user/0/host.exp.exponent/cache/ImageManipulator/abc.jpg', srcB64: '/9j/BBBBBBBB', text: 'vom Handy', time: 'jetzt' },
      { from: 'owner', type: 'file', src: 'data:application/pdf;base64,JVBERi0xLjQ=', fileName: 'Befund.pdf', fileMime: 'application/pdf', text: '', time: 'jetzt' },
      { from: 'owner', text: '', deleted: true, deletedAt: 12345, time: 'jetzt' },
      { from: 'clinic', text: 'Danke!', time: 'jetzt', reactions: { owner: '👍' }, editedAt: 99 },
    ] },
  { id: 'ch-d4e5f6', role: 'clinic', title: 'Herr Maier', sub: 'Rex (Hund) · Impfung', animal: 'dog', labels: ['posteingang'], pinned: true, unread: 2, isTestData: false,
    messages: [{ from: 'owner', text: 'Wann ist Rex dran?', time: 'Gestern 16:20' }, { from: 'clinic', text: 'Morgen um 9.', time: 'Gestern 16:45' }] },
  { id: 'ch-g7h8i9', role: 'network', title: 'Pferdeklinik Viktring', sub: 'Kolik-Protokoll', animal: 'horse', labels: ['netzwerk'], isTestData: false,
    messages: [{ from: 'clinic', text: 'Habt ihr Zeit?', time: 'Mo 10:00' }] },
  { id: 'ch-zzz', role: 'network', title: 'Tierarzt Irgendwo', sub: '', animal: 'dog', isTestData: false, messages: [] },
];
const LEGACY = {
  chats: JSON.stringify(USER_CHATS.concat(V1_SEED)),
  labels: JSON.stringify([
    { id: 'tiere', name: 'Meine Tiere', color: '#0f9b8e', icon: 'paw2', seed: true },
    { id: 'notfall', name: 'NOTFALL!', color: '#ff0000', icon: 'siren', seed: true },
    { id: 'lb-x1', name: 'Wichtig', color: '#123456', icon: 'star', seed: false },
  ]),
  settings: JSON.stringify({ autoSeed: true, showLabels: false, enableOwner: true, enablePosteingang: true, enableNetwork: false, showPinned: true, botEnabled: true, botTyping: false, botGreeting: true, botMode: 'ai', aiModel: 'qwen2.5:3b', aiBaseUrl: 'http://192.168.68.10:3000/api/ai', agentEnabled: true }),
  auth: '{"role":"owner","name":"Max Muster"}',
  hideTestData: '1',
};

test('Demo-Chats werden verworfen, eigene Chats übernommen', () => {
  const r = migrateV1(LEGACY, NOW);
  assert.equal(r.report.chatsIn, 13);
  assert.equal(r.report.seedChatsDropped, 9);
  assert.equal(r.report.chatsMigrated, 4);
  assert.deepEqual(r.chats.map((c) => c.id), ['ch-a1b2c3', 'ch-d4e5f6', 'ch-g7h8i9', 'ch-zzz']);
  assert.equal(r.report.errors.length, 0);
});

test('Anfrage-Chat (owner) → direct mit Praxis aus dem Titel', () => {
  const c = migrateV1(LEGACY, NOW).chats[0];
  assert.equal(c.kind, 'direct');
  assert.equal(c.practiceId, 'feldkirchen');
  assert.equal(c.ownerId, 'owner-demo');
  assert.equal(c.ownerName, 'Max Muster');
  assert.equal(c.titles, undefined, 'Titel passte zur Praxis → berechneter Titel');
  assert.equal(c.subs.owner, 'Feldkirchen · Hund · Notfall');
  assert.deepEqual(c.unread, { owner: 1, clinic: 0 });
  assert.equal(c.autoReply, true);
  assert.equal(c.isTestData, false);
  // Nachrichten: IDs + Zeitstempel (aufsteigend, nicht in der Zukunft)
  const ids = c.messages.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('m-xyz') && ids.includes('m-img'), 'vorhandene IDs bleiben');
  const ts = c.messages.map((m) => m.ts);
  assert.deepEqual(ts, ts.slice().sort((a, b) => a - b));
  assert.ok(ts.every((t) => t <= NOW));
  assert.equal(c.messages[1].source, 'ai');
  assert.equal(c.messages[1].aiModel, 'qwen2.5:3b');
  assert.deepEqual(c.messages[6].reactions, { owner: '👍' });
});

test('Bilder/Dateien → attachment; srcB64 fliegt raus; gelöscht bleibt leer', () => {
  const c = migrateV1(LEGACY, NOW).chats[0];
  const web = c.messages[2];
  assert.equal(web.type, 'image');
  assert.equal(web.attachment.kind, 'image');
  assert.equal(web.attachment.mime, 'image/png');
  assert.equal(web.attachment.ref, 'data:image/png;base64,iVBORw0KGgo=');
  assert.ok(web.attachment.size > 0);
  const mob = c.messages[3];
  assert.equal(mob.attachment.ref, 'file:///data/user/0/host.exp.exponent/cache/ImageManipulator/abc.jpg');
  assert.equal(mob.text, 'vom Handy');
  assert.ok(!JSON.stringify(c).includes('BBBBBBBB'), 'Base64 vom Handy nicht mehr gespeichert');
  assert.ok(!('src' in mob) && !('srcB64' in mob));
  const file = c.messages[4];
  assert.equal(file.attachment.kind, 'file');
  assert.equal(file.attachment.name, 'Befund.pdf');
  assert.equal(file.attachment.mime, 'application/pdf');
  const del = c.messages[5];
  assert.equal(del.deleted, true);
  assert.equal(del.text, '');
  assert.equal(del.attachment, undefined);
  const r = migrateV1(LEGACY, NOW).report;
  assert.equal(r.images, 2);
  assert.equal(r.files, 1);
});

test('Praxis-Chat, Netzwerk-Chats, Zeitangaben', () => {
  const [, clinic, net, unknown] = migrateV1(LEGACY, NOW).chats;
  assert.equal(clinic.practiceId, 'drautal');
  assert.equal(clinic.ownerName, 'Herr Maier');
  assert.equal(clinic.petName, 'Rex');
  assert.equal(clinic.topic, 'Impfung');
  assert.deepEqual(clinic.unread, { owner: 0, clinic: 2 });
  assert.deepEqual(clinic.pinned, { owner: false, clinic: true });
  assert.equal(clinic.messages[0].ts, tsAt(addDays(todayISO(NOW), -1), '16:20'), '„Gestern 16:20" exakt übernommen');
  assert.equal(net.kind, 'network');
  assert.equal(net.peerPracticeId, 'viktring');
  assert.equal(net.topic, 'Kolik-Protokoll');
  assert.equal(net.messages[0].ts, tsAt(addDays(todayISO(NOW), -3), '10:00'), '„Mo 10:00" = letzter Montag');
  assert.equal(unknown.peerPracticeId, null);
  assert.equal(unknown.peerName, 'Tierarzt Irgendwo');
});

test('Einstellungen, Anmeldung, Testdaten-Schalter, Labels', () => {
  const r = migrateV1(LEGACY, NOW);
  assert.equal(r.settings.botMode, 'ai-fallback');
  assert.equal(r.settings.typing, false);
  assert.equal(r.settings.greeting, true);
  assert.equal(r.settings.showLabels, false);
  assert.equal(r.settings.enableNetwork, false);
  assert.deepEqual(r.settings.ai, { model: 'qwen2.5:3b' });
  assert.equal(r.settings.aiLegacyUrl, 'http://192.168.68.10:3000/api/ai');
  assert.deepEqual(r.auth, { role: 'owner', name: 'Max Muster', ownerId: 'owner-demo' });
  assert.equal(r.hideTestData, true);
  assert.equal(r.labels.length, 7);
  const notfall = r.labels.find((l) => l.id === 'notfall');
  assert.equal(notfall.name, 'NOTFALL!');
  assert.deepEqual(notfall.roles, ['owner', 'clinic']);
  assert.deepEqual(r.labels.find((l) => l.id === 'posteingang').roles, ['clinic']);
  assert.deepEqual(r.labels.find((l) => l.id === 'lb-x1').roles, ['owner', 'clinic']);
  assert.equal(migrateV1({ settings: { botEnabled: false } }, NOW).settings.botMode, 'off');
  assert.equal(migrateV1({ settings: { botMode: 'smart' } }, NOW).settings.botMode, 'bot');
  assert.equal(migrateV1({ settingsV1: { botMode: 'smart', botTyping: true } }, NOW).settings.botMode, 'ai-fallback', 'v1: botMode wurde damals verworfen');
  assert.deepEqual(migrateV1({ auth: { role: 'clinic', name: '' } }, NOW).auth, { role: 'clinic', name: 'Tierarztpraxis Drautal', practiceId: 'drautal' });
});

test('Kaputte Werte: kein Absturz, Fehler im Bericht', () => {
  const r = migrateV1({ chats: '{kaputt', labels: 'auch kaputt', auth: 'null' }, NOW);
  assert.equal(r.chats.length, 0);
  assert.equal(r.labels, null);
  assert.equal(r.auth, null);
  assert.equal(r.report.errors.length, 2);
  assert.equal(hasV1Data({}), false);
  assert.equal(hasV1Data({ hideTestData: '0' }), true);
});

test('Auf den Seed gelegt: beide Seiten sehen die übernommenen Chats', () => {
  const seed = buildDemoSeed(NOW);
  const merged = applyMigration(seed, migrateV1(LEGACY, NOW, { practices: seed.practices }));
  assert.equal(merged.chats.length, 8 + 4);
  assert.equal(merged.settings.hideTestData, true);
  const base = { chats: merged.chats, practices: merged.practices, settings: { ...merged.settings, hideTestData: false } };
  const owner = visibleChats({ ...base, auth: merged.auth }).map((v) => v.id);
  assert.ok(owner.includes('ch-a1b2c3'));
  const feld = visibleChats({ ...base, auth: { role: 'clinic', practiceId: 'feldkirchen' } }).map((v) => v.id);
  assert.ok(feld.includes('ch-a1b2c3'), 'die Anfrage landet jetzt auch im Posteingang der Praxis');
  const drautal = visibleChats({ ...base, auth: { role: 'clinic', practiceId: 'drautal' } });
  assert.equal(drautal.find((v) => v.id === 'ch-d4e5f6').title, 'Herr Maier');
});

test('parseLegacyTime', () => {
  const today = todayISO(NOW);
  assert.equal(parseLegacyTime('jetzt', NOW), null);
  assert.equal(parseLegacyTime('09:30', NOW), tsAt(today, '09:30'));
  assert.equal(parseLegacyTime('heute, 11:20', NOW), tsAt(today, '11:20'));
  assert.equal(parseLegacyTime('gestern, 08:05', NOW), tsAt(addDays(today, -1), '08:05'));
  assert.equal(parseLegacyTime('Do 19:02', NOW), tsAt(addDays(today, -7), '19:02'), 'heutiger Wochentag = Vorwoche');
  assert.equal(parseLegacyTime('Mo, 02.06.', NOW), tsAt('2026-06-02', '12:00'));
  assert.equal(parseLegacyTime('24.12.', NOW), tsAt('2025-12-24', '12:00'), 'ohne Jahr in der Zukunft → Vorjahr');
  assert.equal(parseLegacyTime('Quatsch', NOW), null);
});
