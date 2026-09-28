/* Store-Abgleich gegen die Hub-ATTRAPPE (test/_helpers.js → startFakeHub).

   Warum zusätzlich zum echten Hub? Die Attrappe verhält sich absichtlich „unbequem":
   - sie vergibt EIGENE IDs für Anfragen-Chats und Nachrichten (der echte Hub übernimmt die IDs
     der Geräte) → prüft die Umbenennung lokaler IDs und den Abgleich NUR über clientMsgId,
   - sie kann ein Ereignis doppelt senden → prüft, dass der Store idempotent einspielt.
   So bleibt der Store auch mit älteren/anderen Hub-Versionen robust. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../store.js';
import { buildDemoSeed } from '../seed.js';
import { getClockOffset, setClockOffset, todayISO } from '../clock.js';
import { startFakeHub, spyStorage, waitFor, sleep } from './_helpers.js';

const OWNER = { role: 'owner', name: 'Familie Berger', ownerId: 'owner-demo' };
const BERGER = 'ch-berger-drautal';

async function setup(t) {
  const seed = buildDemoSeed(Date.now());
  const hub = await startFakeHub({ practices: seed.practices, chats: seed.chats, labels: seed.labels, appointments: seed.appointments, blocks: seed.blocks, settings: { botMode: 'off' } });
  const storage = spyStorage();
  const store = createStore({ storage, platform: 'android', flavor: 'demo', EventSource: null, pollTimeoutMs: 300, backoffMinMs: 50, backoffMaxMs: 200 });
  await store.ready;
  t.after(async () => { setClockOffset(0); await store.destroy(); await hub.stop(); });
  assert.equal(await store.actions.connectHub(hub.url), true);
  await waitFor(() => store.getState().hub.status === 'online', { label: 'online' });
  store.actions.login(OWNER);
  return { hub, store, storage };
}
const chatOf = (store, id) => store.getState().chats.find((c) => c.id === id) || null;

test('Hub vergibt eigene IDs: Anfrage-Chat wird umbenannt, alte lokale ID funktioniert weiter', async (t) => {
  const { hub, store, storage } = await setup(t);
  const localId = store.actions.sendRequest({ practiceId: 'drautal', animal: 'cat', petName: 'Minka', situation: 'regular', message: 'Minka braucht eine Impfung.' });
  assert.ok(chatOf(store, localId), 'zuerst unter der lokalen ID');
  const apId = store.actions.addAppointment({ date: todayISO(), time: '11:00', name: 'Minka', chatId: localId });

  await waitFor(() => !chatOf(store, localId) && store.getState().chats.some((c) => /^ch-srv-/.test(c.id)), { label: 'umbenannt' });
  const serverId = store.resolveId(localId);
  assert.match(serverId, /^ch-srv-/);
  const chat = store.getChat(localId);
  assert.equal(chat.id, serverId, 'getChat(alteId) findet den Chat unter der Server-ID');
  assert.equal(chat.messages.length, 1, 'erste Nachricht genau einmal');
  assert.match(chat.messages[0].id, /^m-srv-/, 'Server-Fassung der Nachricht');
  assert.equal(store.getState().appointments.find((a) => a.id === apId).chatId, serverId, 'Termin zeigt auf die neue ID');

  const sent = store.actions.sendMessage(localId, { text: 'Geht auch morgen?' });
  await waitFor(() => hub.requests.some((r) => r.method === 'POST' && r.path === '/chats/' + serverId + '/messages'), { label: 'POST an Server-ID' });
  await waitFor(() => !store.getChat(serverId).messages.some((m) => m.pending), { label: 'abgeglichen' });
  const same = store.getChat(serverId).messages.filter((m) => m.clientMsgId === sent.clientMsgId);
  assert.equal(same.length, 1, 'nur über clientMsgId abgeglichen — trotzdem genau einmal');
  assert.match(same[0].id, /^m-srv-/);
  await store.flush();
  assert.equal(storage.map.has('vn3:demo:hub:chat:' + localId), false, 'alter Speicherschlüssel entfernt');
  assert.ok(storage.map.has('vn3:demo:hub:chat:' + serverId));
});

test('Doppelt gesendetes Ereignis wird genau einmal eingespielt (auch der Ungelesen-Zähler)', async (t) => {
  const { hub, store } = await setup(t);
  const before = chatOf(store, BERGER);
  const unreadOwner = before.unread.owner;
  const m = hub.addMessage(BERGER, { from: 'clinic', text: 'Bitte kommen Sie um 15 Uhr.' });
  await waitFor(() => chatOf(store, BERGER).messages.some((x) => x.id === m.id), { label: 'Nachricht angekommen' });
  // Dasselbe Ereignis nochmal (z. B. Wiederholung nach Verbindungsabbruch, neue rev):
  hub.emit('message', { chatId: BERGER, message: m });
  hub.emit('message:update', { chatId: BERGER, message: { ...m, text: 'Bitte kommen Sie um 15:30 Uhr.', editedAt: Date.now() } });
  await waitFor(() => chatOf(store, BERGER).messages.find((x) => x.id === m.id).text === 'Bitte kommen Sie um 15:30 Uhr.', { label: 'Update angekommen' });
  const after = chatOf(store, BERGER);
  assert.equal(after.messages.filter((x) => x.id === m.id).length, 1, 'genau einmal');
  assert.equal(after.unread.owner, unreadOwner + 1, 'Ungelesen nur einmal erhöht');
  assert.equal(after.messages.length, before.messages.length + 1);
});

test('Typing, Uhr und resync aus Hub-Ereignissen; Chat-Löschung durch ein anderes Gerät', async (t) => {
  const { hub, store } = await setup(t);
  hub.emit('typing', { chatId: BERGER, from: 'clinic', on: true });
  await waitFor(() => store.getState().typing[BERGER] === 'clinic', { label: 'tippt' });
  hub.addMessage(BERGER, { from: 'clinic', text: 'Fertig getippt.' });
  await waitFor(() => !store.getState().typing[BERGER], { label: 'Nachricht beendet die Tipp-Anzeige' });

  hub.setClock(3600e3);
  await waitFor(() => store.getState().clockOffsetMs === 3600e3, { label: 'Uhr-Versatz' });
  assert.equal(getClockOffset(), 3600e3, 'globale Uhr folgt dem Hub');

  // Ein anderes Gerät löscht einen Chat direkt am Hub; zusätzlich erzwingt der Hub einen Neuabgleich.
  hub.state.chats = hub.state.chats.filter((c) => c.id !== 'ch-novak-drautal');
  hub.emit('chat:deleted', { id: 'ch-novak-drautal' });
  await waitFor(() => !chatOf(store, 'ch-novak-drautal'), { label: 'Chat gelöscht' });
  hub.state.chats.push({ id: 'ch-extern', kind: 'direct', practiceId: 'faak', ownerId: 'owner-demo', ownerName: 'Familie Berger', messages: [], labels: [], pinned: {}, unread: { owner: 0, clinic: 0 } });
  hub.emit('resync', {});
  await waitFor(() => chatOf(store, 'ch-extern'), { label: 'resync lädt den kompletten Zustand' });
  await sleep(50);
  assert.equal(store.getState().chats.length, hub.state.chats.length);
  assert.equal(store.getState().lastError, null);
});
