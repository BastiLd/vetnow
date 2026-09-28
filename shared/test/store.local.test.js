import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, createMemoryStorage } from '../store.js';
import { effectiveStatus } from '../status.js';
import { getClockOffset, setClockOffset } from '../clock.js';
import { visibleChats } from '../chats.js';
import { spyStorage, waitFor, sleep } from './_helpers.js';

const OWNER = { role: 'owner', name: 'Familie Berger', ownerId: 'owner-demo' };
const DRAUTAL = { role: 'clinic', practiceId: 'drautal' };

async function makeStore(opts = {}) {
  const store = createStore({ storage: opts.storage || spyStorage(), platform: 'test', flavor: 'demo', typingScale: 0.02, replyDelayMs: 20, ...opts });
  await store.ready;
  return store;
}
const chatOf = (store, id) => store.getState().chats.find((c) => c.id === id);

test('Start: Demo-Seed geladen, pro Chat ein Speicherschlüssel + Index', async (t) => {
  const storage = spyStorage();
  const store = await makeStore({ storage });
  t.after(() => store.destroy());
  const s = store.getState();
  assert.equal(s.ready, true);
  assert.equal(s.mode, 'local');
  assert.equal(s.practices.length, 18);
  assert.equal(s.chats.length, 8);
  assert.equal(s.lastError, null);
  assert.ok(storage.map.has('vn3:demo:meta'));
  assert.ok(storage.map.has('vn3:demo:chat:ch-berger-drautal'));
  assert.deepEqual(JSON.parse(storage.map.get('vn3:demo:chatIndex')).length, 8);
  assert.equal(JSON.parse(storage.map.get('vn3:demo:meta')).schema, 3);
});

test('E2E: Tierhalter:in schickt Anfrage → Praxis antwortet automatisch (mit Tippen) → Praxis sieht den Chat', async (t) => {
  const store = await makeStore();
  t.after(() => store.destroy());
  const { actions } = store;
  actions.login(OWNER);
  assert.equal(store.getVisibleChats().length, 3);
  const typingSeen = new Set();
  store.subscribe((s) => { Object.entries(s.typing).forEach(([id, side]) => { if (side) typingSeen.add(id + ':' + side); }); });

  const chatId = actions.sendRequest({
    practiceId: 'feldkirchen', ownerName: 'Familie Berger', phone: '+43 660 1234567', animal: 'dog', petName: 'Luna',
    situation: 'emergency', district: 'Feldkirchen', message: 'Luna humpelt seit heute Morgen stark.',
  });
  assert.match(chatId, /^ch-/);
  let chat = chatOf(store, chatId);
  assert.equal(chat.kind, 'request');
  assert.equal(chat.practiceId, 'feldkirchen');
  assert.equal(chat.unread.clinic, 1, 'Posteingang der Praxis hat eine neue Anfrage');
  assert.deepEqual(chat.labels, ['tiere', 'posteingang', 'notfall']);
  assert.equal(chat.messages[0].meta.request.phone, '+43 660 1234567');
  assert.ok(store.getVisibleChats().some((v) => v.id === chatId), 'Tierhalter:in sieht die Anfrage');

  await waitFor(() => chatOf(store, chatId).messages.some((m) => m.from === 'clinic'), { label: 'Auto-Antwort' });
  await waitFor(() => !store.getState().typing[chatId], { label: 'Tippen beendet' });
  chat = chatOf(store, chatId);
  const reply = chat.messages.find((m) => m.from === 'clinic');
  assert.equal(reply.source, 'bot');
  assert.equal(reply.meta.replyTo, chat.messages[0].id, 'Antwort ist an die Nachricht gebunden');
  assert.ok(typingSeen.has(chatId + ':clinic'), 'Tipp-Anzeige der Praxis war sichtbar');
  assert.ok(chat.unread.owner >= 1, 'Antwort zählt bei der Tierhalter:in als ungelesen');

  actions.logout();
  assert.equal(store.getVisibleChats().length, 0, 'abgemeldet sieht niemand etwas');
  actions.login({ role: 'clinic', practiceId: 'feldkirchen' });
  assert.equal(store.getState().auth.name, 'Vetpraxis Feldkirchen');
  const v = store.getVisibleChats().find((x) => x.id === chatId);
  assert.ok(v, 'Praxis sieht die Anfrage im Posteingang');
  assert.equal(v.rubric, 'clinic');
  assert.equal(v.title, 'Familie Berger');
  assert.equal(v.subtitle, 'Luna (Hund) · Notfall');
  assert.equal(v.unread, 1);
  actions.markRead(chatId);
  assert.equal(chatOf(store, chatId).unread.clinic, 0);

  // Jetzt schreibt die Praxis → die (simulierte) Tierhalter:in antwortet
  const sent = actions.sendMessage(chatId, { text: 'Kommen Sie bitte um 14:00 vorbei.' });
  assert.equal(sent.from, 'clinic');
  await waitFor(() => chatOf(store, chatId).messages.some((m) => m.from === 'owner' && m.source === 'bot'), { label: 'Antwort der Tierhalter:in' });
});

test('Warteschlange: schnelle Nachrichten → EINE Antwortrunde auf die letzte (StrictMode-sicher)', async (t) => {
  const store = await makeStore();
  t.after(() => store.destroy());
  store.actions.login(OWNER);
  const a = store.actions.sendMessage('ch-berger-feldkirchen', { text: 'Hallo' });
  const b = store.actions.sendMessage('ch-berger-feldkirchen', { text: 'Haben Sie morgen Zeit für Luna?' });
  assert.equal(store.pendingReplies().length, 1);
  assert.deepEqual(store.pendingReplies(), [b.id]);
  await waitFor(() => store.pendingReplies().length === 0, { label: 'fertig' });
  const bots = chatOf(store, 'ch-berger-feldkirchen').messages.filter((m) => m.source);
  assert.ok(bots.length >= 1);
  assert.ok(bots.every((m) => m.meta.replyTo === b.id), 'nur auf die letzte Nachricht geantwortet');
  assert.ok(!bots.some((m) => m.meta.replyTo === a.id));
  // leere Nachricht wird ignoriert
  assert.equal(store.actions.sendMessage('ch-berger-feldkirchen', { text: '   ' }), null);
});

test('Persistenz: Neustart mit demselben Speicher stellt alles wieder her', async () => {
  const storage = spyStorage();
  const s1 = await makeStore({ storage });
  s1.actions.login(DRAUTAL);
  s1.actions.setSetting('botMode', 'off');
  s1.actions.sendMessage('ch-berger-drautal', { text: 'Kommen Sie gleich vorbei.' });
  s1.actions.confirmStatus('stveit', 'yellow', 12, 'nur vormittags');
  const labelId = s1.actions.createLabel({ name: 'Rückruf', color: '#123456' });
  await s1.destroy();
  const s2 = await makeStore({ storage });
  const st = s2.getState();
  assert.deepEqual(st.auth, { role: 'clinic', name: 'Tierarztpraxis Drautal', practiceId: 'drautal' });
  assert.equal(st.settings.botMode, 'off');
  const balu = st.chats.find((c) => c.id === 'ch-berger-drautal');
  assert.equal(balu.messages.at(-1).text, 'Kommen Sie gleich vorbei.');
  assert.equal(balu.messages.length, 6);
  assert.equal(st.practices.find((p) => p.id === 'stveit').status.note, 'nur vormittags');
  assert.ok(st.labels.some((l) => l.id === labelId && l.roles.includes('clinic')));
  assert.equal(st.chats.length, 8);
  assert.equal(st.lastError, null);
  await s2.destroy();
});

test('Lesefehler bei meta → läuft im Speicher, schreibt NIE etwas', async () => {
  const storage = spyStorage({}, { failGet: (k) => k === 'vn3:demo:meta' });
  const store = await makeStore({ storage });
  assert.ok(store.getState().lastError, 'Fehler wird angezeigt');
  assert.match(store.getState().lastError.message, /nichts überschrieben/);
  assert.equal(store.getState().chats.length, 8, 'App bleibt benutzbar');
  store.actions.login(OWNER);
  store.actions.sendMessage('ch-berger-drautal', { text: 'Test' });
  await store.flush();
  await store.destroy();
  assert.equal(storage.calls.set, 0, 'kein einziger Schreibzugriff');
});

test('Lesefehler/Beschädigung einzelner Chats → nur diese bleiben unangetastet', async () => {
  const base = spyStorage();
  const s1 = await makeStore({ storage: base });
  await s1.destroy();
  const initial = Object.fromEntries(base.map);
  initial['vn3:demo:chat:ch-wieser-drautal'] = '{kaputt';
  const storage = spyStorage(initial, { failGet: (k) => k === 'vn3:demo:chat:ch-berger-drautal' });
  const store = await makeStore({ storage });
  const st = store.getState();
  assert.equal(st.chats.length, 6, 'die 6 lesbaren Chats sind da');
  assert.match(st.lastError.message, /chat:ch-berger-drautal/);
  assert.match(st.lastError.message, /beschädigt/);
  store.actions.login(DRAUTAL);
  store.actions.sendMessage('ch-tomaschitz-drautal', { text: 'Wie geht es Hoppel?' });
  await store.flush();
  await store.destroy();
  assert.ok(!storage.calls.setKeys.includes('vn3:demo:chat:ch-berger-drautal'), 'unlesbarer Chat nie überschrieben');
  assert.ok(!storage.calls.setKeys.includes('vn3:demo:chat:ch-wieser-drautal'), 'beschädigter Chat nie überschrieben');
  assert.equal(storage.map.get('vn3:demo:chat:ch-wieser-drautal'), '{kaputt');
  const idx = JSON.parse(storage.map.get('vn3:demo:chatIndex'));
  assert.ok(idx.includes('ch-berger-drautal') && idx.includes('ch-wieser-drautal'), 'Index behält die unlesbaren Chats');
});

test('Fehlende meta, aber vorhandene Daten → KEIN Seed-Überschreiben', async () => {
  const base = spyStorage();
  const s1 = await makeStore({ storage: base });
  s1.actions.login(OWNER);
  s1.actions.sendMessage('ch-berger-drautal', { text: 'bleib da' });
  await s1.destroy();
  base.map.delete('vn3:demo:meta');
  const s2 = await makeStore({ storage: base });
  assert.equal(s2.getState().chats.find((c) => c.id === 'ch-berger-drautal').messages.filter((m) => m.text === 'bleib da').length, 1);
  await s2.destroy();
  assert.ok(base.map.has('vn3:demo:meta'), 'meta wird wiederhergestellt');
});

test('Termin abschließen → Notiz landet im verknüpften Chat', async (t) => {
  const store = await makeStore();
  t.after(() => store.destroy());
  store.actions.login(DRAUTAL);
  const ap = store.getState().appointments.find((a) => a.chatId === 'ch-berger-drautal');
  const before = chatOf(store, 'ch-berger-drautal');
  store.actions.completeAppointment(ap.id, 'Leichte Zerrung, 3 Tage schonen.');
  const after = chatOf(store, 'ch-berger-drautal');
  assert.equal(store.getState().appointments.find((a) => a.id === ap.id).status, 'done');
  const note = after.messages.at(-1);
  assert.equal(note.type, 'note');
  assert.equal(note.from, 'clinic');
  assert.equal(note.text, 'Leichte Zerrung, 3 Tage schonen.');
  assert.equal(after.unread.owner, before.unread.owner + 1);
  assert.ok(after.labels.includes('erledigt'));
  assert.equal(store.pendingReplies().length, 0, 'auf eine Notiz antwortet kein Bot');
  // Tierhalter:in bewertet die Notiz
  store.actions.login(OWNER);
  assert.equal(store.actions.rateChat('ch-berger-drautal', note.id, 7), 5);
  assert.equal(chatOf(store, 'ch-berger-drautal').messages.at(-1).rating, 5);
  const newAp = store.actions.addAppointment({ date: '2026-10-01', time: '10:00', name: 'Test', animal: 'cat' });
  store.actions.cancelAppointment(newAp);
  assert.equal(store.getState().appointments.find((a) => a.id === newAp).status, 'cancelled');
  assert.equal(store.actions.deleteAppointment(newAp), true);
  const bl = store.actions.addBlock({ weekday: 2, time: '16:00', end: '17:00', label: 'Fortbildung' });
  assert.ok(store.getState().blocks.some((b) => b.id === bl));
});

test('Status bestätigen/ablaufen, Abwesenheit, Praxis bearbeiten', async (t) => {
  const store = await makeStore();
  t.after(() => store.destroy());
  const { actions } = store;
  const eff = (id) => effectiveStatus(store.getState().practices.find((p) => p.id === id), Date.now());
  assert.equal(eff('stveit'), 'grey');
  actions.confirmStatus('stveit', 'green');
  assert.equal(eff('stveit'), 'green');
  actions.expireStatus('stveit');
  assert.equal(eff('stveit'), 'grey');
  assert.equal(actions.confirmStatus('stveit', 'purple'), null);
  assert.match(store.getState().lastError.message, /Unbekannter Status/);
  actions.setAbsence('drautal', { from: Date.now() - 1000, to: Date.now() + 3600e3, vertretung: 'Ossiach' });
  assert.equal(eff('drautal'), 'red');
  actions.setAbsence('drautal', null);
  assert.equal(eff('drautal'), 'green');
  actions.updatePractice('drautal', { profile: { about: 'Neu' }, id: 'hack' });
  const d = store.getState().practices.find((p) => p.id === 'drautal');
  assert.equal(d.profile.about, 'Neu');
  assert.equal(d.profile.team.length, 3, 'Profil wird zusammengeführt, nicht ersetzt');
});

test('Nachrichten bearbeiten, löschen, reagieren; Labels; Pin; Greeting; Test-Hilfen', async (t) => {
  const store = await makeStore();
  t.after(() => store.destroy());
  const { actions } = store;
  actions.login(OWNER);
  actions.setSetting('botMode', 'off');
  const m = actions.sendMessage('ch-berger-woerthersee', { text: 'Tippfehlr' });
  assert.equal(store.pendingReplies().length, 0, 'Bot aus → keine Antwort');
  actions.editMessage('ch-berger-woerthersee', m.id, 'Tippfehler');
  let msg = chatOf(store, 'ch-berger-woerthersee').messages.at(-1);
  assert.equal(msg.text, 'Tippfehler');
  assert.ok(msg.editedAt);
  assert.equal(actions.toggleReaction('ch-berger-woerthersee', m.id, '❤️'), '❤️');
  assert.equal(chatOf(store, 'ch-berger-woerthersee').messages.at(-1).reactions.owner, '❤️');
  assert.equal(actions.toggleReaction('ch-berger-woerthersee', m.id, '❤️'), null, 'zweimal = weg');
  actions.deleteMessage('ch-berger-woerthersee', m.id);
  msg = chatOf(store, 'ch-berger-woerthersee').messages.at(-1);
  assert.equal(msg.deleted, true);
  assert.equal(msg.text, '');
  assert.equal(actions.togglePin('ch-berger-woerthersee'), true);
  assert.equal(chatOf(store, 'ch-berger-woerthersee').pinned.owner, true);
  assert.equal(chatOf(store, 'ch-berger-woerthersee').pinned.clinic, false, 'Pin gilt nur für meine Seite');
  actions.deleteLabel('notfall');
  assert.ok(!store.getState().labels.some((l) => l.id === 'notfall'));
  assert.ok(store.getState().chats.every((c) => !c.labels.includes('notfall')), 'Label aus allen Chats entfernt');
  // injectIncoming: Gegenseite schreibt, KEINE Auto-Antwort, ungelesen zählt
  actions.setSetting('botMode', 'bot');
  const before = chatOf(store, 'ch-berger-feldkirchen').unread.owner;
  const inc = actions.injectIncoming('ch-berger-feldkirchen', 'Wir haben um 15 Uhr Zeit.');
  assert.equal(inc.from, 'clinic');
  assert.equal(chatOf(store, 'ch-berger-feldkirchen').unread.owner, before + 1);
  assert.equal(store.pendingReplies().length, 0);
  // Neuer leerer Chat → Begrüßung der Praxis
  const id = actions.createChat({ practiceId: 'ossiach', petName: 'Mimi', animal: 'cat' });
  assert.equal(chatOf(store, id).ownerId, 'owner-demo');
  await waitFor(() => chatOf(store, id).messages.length === 1, { label: 'Begrüßung' });
  assert.equal(chatOf(store, id).messages[0].from, 'clinic');
  assert.match(chatOf(store, id).messages[0].text, /Tierpraxis Ossiacher See/);
  // forceAutoReply funktioniert sogar bei botMode off
  actions.setSetting('botMode', 'off');
  assert.equal(actions.forceAutoReply('ch-berger-woerthersee'), true);
  await waitFor(() => chatOf(store, 'ch-berger-woerthersee').messages.at(-1).source === 'bot', { label: 'erzwungene Antwort' });
  assert.equal(actions.deleteChat(id), true);
  assert.equal(chatOf(store, id), undefined);
});

test('Erster Start übernimmt v1-Daten über getLegacy — alte Schlüssel bleiben unangetastet', async (t) => {
  const legacy = {
    vn_chats_v1: JSON.stringify([
      { id: 'ch-o1', role: 'owner', title: 'Tierarztpraxis Drautal', isTestData: true, messages: [] },
      { id: 'ch-meins', role: 'clinic', title: 'Frau Huber', sub: 'Mausi (Katze) · Impfung', animal: 'cat', unread: 1, isTestData: false, messages: [{ from: 'owner', text: 'Hallo!', time: '08:00' }] },
    ]),
    vn_auth: '{"role":"clinic","name":"Meine Praxis"}',
    vn_hide_testdata: '0',
    vn_chat_settings_v2: '{"botEnabled":false}',
  };
  const storage = spyStorage({}, { legacy });
  const store = await makeStore({ storage });
  t.after(() => store.destroy());
  const st = store.getState();
  assert.equal(st.migration.chatsMigrated, 1);
  assert.equal(st.migration.seedChatsDropped, 1);
  assert.equal(st.chats.length, 9);
  assert.equal(st.auth.role, 'clinic');
  assert.equal(st.auth.name, 'Meine Praxis');
  assert.equal(st.settings.botMode, 'off');
  const v = store.getVisibleChats().find((x) => x.id === 'ch-meins');
  assert.equal(v.title, 'Frau Huber');
  assert.equal(v.unread, 1);
  await store.flush();
  assert.ok(!storage.calls.setKeys.some((k) => k.startsWith('vn_')), 'keine alten Schlüssel geschrieben');
  assert.equal(storage.calls.remove, 0, 'nichts gelöscht');
  assert.equal(JSON.parse(storage.map.get('vn3:demo:meta')).migratedV1, true);
});

test('Export/Import, Reset, Alle Chats löschen, getrennte Flavors', async (t) => {
  const mem = createMemoryStorage();
  const demo = await makeStore({ storage: mem });
  t.after(() => demo.destroy());
  demo.actions.login(OWNER);
  demo.actions.sendMessage('ch-berger-drautal', { text: 'Export mich' });
  const exp = demo.actions.exportJSON();
  assert.equal(exp.schema, 3);
  assert.equal(exp.chats.length, 8);
  const clean = await makeStore({ storage: mem, flavor: 'clean' });
  t.after(() => clean.destroy());
  assert.equal(clean.getState().practices.length, 0, 'saubere Version ohne Testdaten');
  assert.equal(clean.getState().chats.length, 0);
  const res = clean.actions.importJSON(JSON.stringify(exp));
  assert.equal(res.chats, 8);
  assert.equal(clean.getState().practices.length, 18);
  assert.ok(clean.getState().chats.find((c) => c.id === 'ch-berger-drautal').messages.some((m) => m.text === 'Export mich'));
  assert.throws(() => clean.actions.importJSON('{"foo":1}'), /keine VetNow-Daten/);
  assert.throws(() => clean.actions.importJSON('kein json'), /kein gültiges JSON/);
  await clean.flush();
  await demo.flush();
  assert.ok([...mem.map.keys()].some((k) => k.startsWith('vn3:clean:')));
  assert.ok([...mem.map.keys()].some((k) => k.startsWith('vn3:demo:')));
  demo.actions.clearAll();
  assert.equal(demo.getState().chats.length, 0);
  await demo.flush();
  assert.ok(![...mem.map.keys()].some((k) => k.startsWith('vn3:demo:chat:')), 'Chat-Schlüssel entfernt');
  demo.actions.resetDemo();
  assert.equal(demo.getState().chats.length, 8);
  demo.actions.resetEmpty();
  assert.equal(demo.getState().practices.length, 0);
});

test('Listener werden gebündelt benachrichtigt; Uhr-Versatz wird gespeichert', async (t) => {
  const storage = spyStorage();
  const store = await makeStore({ storage });
  t.after(async () => { await store.destroy(); setClockOffset(0); });
  let calls = 0;
  const off = store.subscribe(() => { calls++; });
  store.actions.login(OWNER);
  for (let i = 0; i < 10; i++) store.actions.togglePin('ch-berger-feldkirchen');
  store.actions.markRead('ch-berger-feldkirchen');
  await sleep(0);
  assert.equal(calls, 1, '12 Aktionen → 1 Benachrichtigung');
  off();
  const s1 = store.getState();
  assert.equal(store.getState(), s1, 'stabile Referenz ohne Änderung (useSyncExternalStore)');
  store.actions.setClockOffset(3600e3);
  assert.equal(store.getState().clockOffsetMs, 3600e3);
  assert.equal(getClockOffset(), 3600e3);
  await store.flush();
  assert.deepEqual(JSON.parse(storage.map.get('vn3:demo:clock')), { offsetMs: 3600e3 });
  setClockOffset(0);
  const again = await makeStore({ storage });
  assert.equal(again.getState().clockOffsetMs, 3600e3, 'Versatz überlebt Neustart');
  await again.destroy();
  setClockOffset(0);
});

test('visibleChats auf dem Store-Zustand = getVisibleChats()', async (t) => {
  const store = await makeStore();
  t.after(() => store.destroy());
  store.actions.login(DRAUTAL);
  assert.deepEqual(visibleChats(store.getState()).map((v) => v.id), store.getVisibleChats().map((v) => v.id));
  assert.equal(store.getUnreadTotal(), 3);
});
