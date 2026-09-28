/* Store im Hub-Modus gegen den ECHTEN VetNow Hub (hub/hub.js, echtes HTTP auf 127.0.0.1).

   Geprüft wird, was im Vertrag §5 „Hub-Modus" steht:
   - Aktionen sind sofort sichtbar (optimistisch) und werden per clientMsgId/ID abgeglichen,
   - Hub-Ereignisse werden idempotent eingespielt (nichts doppelt, auch nicht auf dem 2. Gerät),
   - Auto-Antworten kommen NUR vom Hub,
   - Hub weg → offline → Outbox (gespeichert) → nach dem Reconnect genau einmal gesendet,
   - Uhr, Einstellungen und Reset kommen vom Hub.
   Zwei „Geräte" = zwei Store-Instanzen: Handy (Long-Poll, wie React Native) und Web (SSE). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../store.js';
import { effectiveStatus } from '../status.js';
import { todayISO, setClockOffset } from '../clock.js';
import { spyStorage, waitFor, sleep, TestEventSource } from './_helpers.js';
import { startRealHub } from './_realhub.js';

const OWNER = { role: 'owner', name: 'Familie Berger', ownerId: 'owner-demo' };
const DRAUTAL = { role: 'clinic', practiceId: 'drautal' };
const BERGER = 'ch-berger-drautal';

/* Kurze Wartezeiten, damit die Tests schnell sind (Standard: 25 s Long-Poll, 1–15 s Backoff). */
const FAST = { pollTimeoutMs: 300, backoffMinMs: 50, backoffMaxMs: 250 };

async function device(opts = {}) {
  const store = createStore({
    storage: opts.storage || spyStorage(), flavor: 'demo', typingScale: 0.02, replyDelayMs: 20,
    platform: opts.sse ? 'web' : 'android', EventSource: opts.sse ? TestEventSource : null, ...FAST, ...opts,
  });
  await store.ready;
  return store;
}
async function online(store, url) {
  const ok = await store.actions.connectHub(url);
  assert.equal(ok, true, 'connectHub liefert true');
  await waitFor(() => store.getState().hub.status === 'online', { label: 'Hub-Status online' });
  return store;
}
const chatOf = (store, id) => store.getState().chats.find((c) => c.id === id) || null;
const ids = (list) => list.map((m) => m.id);

test('Verbinden lädt den Hub-Zustand; lokale Daten bleiben getrennt und kommen beim Trennen zurück', async (t) => {
  const h = await startRealHub();
  const storage = spyStorage();
  const store = await device({ storage });
  t.after(async () => { await store.destroy(); await h.close(); });
  const { actions } = store;
  actions.login(DRAUTAL);
  actions.confirmStatus('drautal', 'red', 5);
  const localId = actions.createChat({ kind: 'direct', ownerName: 'Nur lokal', petName: 'Testi', autoReply: false });
  await store.flush();

  await online(store, h.url);
  const s = store.getState();
  assert.equal(s.mode, 'hub');
  assert.equal(s.hub.serverVersion, '3.0.0');
  assert.equal(s.hub.protocol, 3);
  assert.equal(s.hub.url, h.url);
  assert.equal(s.practices.length, h.hub.state.practices.length);
  assert.deepEqual(s.chats.map((c) => c.id).sort(), h.hub.state.chats.map((c) => c.id).sort(), 'Chats = Hub-Chats');
  assert.equal(chatOf(store, localId), null, 'lokaler Chat ist im Hub-Modus nicht sichtbar');
  assert.equal(s.practices.find((p) => p.id === 'drautal').status.value, h.hub.state.practices.find((p) => p.id === 'drautal').status.value);
  assert.equal(store.pendingReplies().length, 0);
  await store.flush();
  assert.ok(storage.map.has('vn3:demo:hub:chatIndex'), 'Hub-Zwischenspeicher unter eigenem Präfix');
  assert.ok(storage.map.has('vn3:demo:chat:' + localId), 'lokaler Chat bleibt gespeichert');
  assert.ok(h.hub.realtime.list().some((c) => c.id === s.hub.clientId && c.via === 'poll' && c.platform === 'android'), 'Gerät ist beim Hub registriert');

  await actions.disconnectHub();
  const l = store.getState();
  assert.equal(l.mode, 'local');
  assert.equal(l.hub.status, 'off');
  assert.ok(chatOf(store, localId), 'lokaler Chat ist wieder da');
  assert.equal(l.practices.find((p) => p.id === 'drautal').status.value, 'red', 'lokaler Status unverändert');
});

test('Zwei Geräte live: Anfrage vom Handy erscheint sofort in der Praxis; Auto-Antwort NUR vom Hub, genau einmal, mit Tippen', async (t) => {
  const h = await startRealHub();
  await h.setSettings({ botMode: 'bot', typing: true });
  const phone = await device();
  const web = await device({ sse: true });
  t.after(async () => { await phone.destroy(); await web.destroy(); await h.close(); });
  await online(phone, h.url);
  await online(web, h.url);
  phone.actions.login(OWNER);
  web.actions.login(DRAUTAL);
  const typingSeen = [];
  phone.subscribe((s) => { Object.entries(s.typing).forEach(([id, side]) => { if (side) typingSeen.push(id + ':' + side); }); });

  const chatId = phone.actions.sendRequest({
    practiceId: 'drautal', ownerName: 'Familie Berger', phone: '+43 660 1111111', animal: 'dog', petName: 'Rex',
    situation: 'regular', district: 'Villach', message: 'Guten Tag, Rex braucht bitte einen Impftermin.',
  });
  const optimistic = chatOf(phone, chatId);
  assert.ok(optimistic, 'Chat sofort (optimistisch) da');
  assert.equal(optimistic.messages[0].pending, true, 'erste Nachricht wartet auf den Hub');
  const clientMsgId = optimistic.messages[0].clientMsgId;

  await waitFor(() => web.getVisibleChats().find((v) => v.id === chatId), { label: 'Praxis sieht die Anfrage' });
  const v = web.getVisibleChats().find((x) => x.id === chatId);
  assert.equal(v.rubric, 'clinic');
  assert.equal(v.title, 'Familie Berger');
  assert.ok(v.unread >= 1, 'im Posteingang ungelesen');
  assert.equal(h.chat(chatId).practiceId, 'drautal', 'Hub hat die Client-ID übernommen');

  await waitFor(() => chatOf(phone, chatId).messages.some((m) => m.from === 'clinic'), { label: 'Auto-Antwort vom Hub', timeout: 12000 });
  await waitFor(() => !phone.getState().typing[chatId] && h.hub.replier.stats().queues === 0, { label: 'Antwort fertig', timeout: 12000 });
  await waitFor(() => ids(chatOf(phone, chatId).messages).join() === ids(h.chat(chatId).messages).join(), { label: 'Handy = Hub' });
  await waitFor(() => ids(chatOf(web, chatId).messages).join() === ids(h.chat(chatId).messages).join(), { label: 'Web = Hub' });

  const mine = chatOf(phone, chatId).messages.filter((m) => m.from === 'owner');
  assert.equal(mine.length, 1, 'eigene Nachricht genau einmal (optimistisch + Server-Fassung zusammengeführt)');
  assert.equal(mine[0].clientMsgId, clientMsgId);
  assert.equal(mine[0].pending, undefined);
  const replies = chatOf(phone, chatId).messages.filter((m) => m.from === 'clinic');
  assert.ok(replies.length >= 1 && replies.every((m) => m.source === 'bot'), 'Antwort mit Stempel Bot');
  assert.equal(new Set(ids(chatOf(web, chatId).messages)).size, chatOf(web, chatId).messages.length, 'keine doppelten IDs');
  assert.ok(typingSeen.includes(chatId + ':clinic'), 'Tipp-Anzeige der Praxis kam per Hub-Ereignis');
  assert.equal(phone.pendingReplies().length + web.pendingReplies().length, 0, 'kein Gerät antwortet selbst');
  assert.equal(chatOf(phone, chatId).unread.owner, h.chat(chatId).unread.owner, 'Ungelesen-Zähler wie am Hub');
});

test('Nachricht: optimistisch → abgeglichen; beim 2. Gerät genau einmal; Lesen, Bearbeiten, Reaktion, Löschen synchron', async (t) => {
  const h = await startRealHub();
  await h.setSettings({ botMode: 'off' });
  const phone = await device();
  const web = await device({ sse: true });
  t.after(async () => { await phone.destroy(); await web.destroy(); await h.close(); });
  await online(phone, h.url);
  await online(web, h.url);
  phone.actions.login(OWNER);
  web.actions.login(DRAUTAL);
  const unreadBefore = chatOf(web, BERGER).unread.clinic;

  const sent = phone.actions.sendMessage(BERGER, { text: 'Balu frisst wieder normal.' });
  assert.equal(sent.pending, true);
  assert.equal(chatOf(phone, BERGER).messages.at(-1).text, 'Balu frisst wieder normal.', 'sofort sichtbar');
  await waitFor(() => !chatOf(phone, BERGER).messages.find((m) => m.clientMsgId === sent.clientMsgId).pending, { label: 'bestätigt' });
  const confirmed = chatOf(phone, BERGER).messages.filter((m) => m.clientMsgId === sent.clientMsgId);
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].id, sent.id, 'Hub übernimmt die Nachrichten-ID des Geräts');
  assert.equal(h.chat(BERGER).messages.filter((m) => m.clientMsgId === sent.clientMsgId).length, 1, 'am Hub genau einmal');

  await waitFor(() => chatOf(web, BERGER).messages.some((m) => m.id === sent.id), { label: 'Praxis bekommt die Nachricht' });
  await sleep(150); // evtl. nachfolgende Ereignisse (chat) abwarten
  assert.equal(chatOf(web, BERGER).messages.filter((m) => m.id === sent.id).length, 1, 'beim 2. Gerät genau einmal');
  assert.equal(chatOf(web, BERGER).unread.clinic, unreadBefore + 1, 'Ungelesen der Praxis +1');

  web.actions.markRead(BERGER);
  assert.equal(chatOf(web, BERGER).unread.clinic, 0);
  await waitFor(() => chatOf(phone, BERGER).unread.clinic === 0 && h.chat(BERGER).unread.clinic === 0, { label: 'gelesen überall' });

  phone.actions.editMessage(BERGER, sent.id, 'Balu frisst wieder ganz normal.');
  await waitFor(() => { const m = chatOf(web, BERGER).messages.find((x) => x.id === sent.id); return m.text === 'Balu frisst wieder ganz normal.' && m.editedAt; }, { label: 'Bearbeitung kommt an' });
  web.actions.toggleReaction(BERGER, sent.id, '👍');
  await waitFor(() => (chatOf(phone, BERGER).messages.find((x) => x.id === sent.id).reactions || {}).clinic === '👍', { label: 'Reaktion kommt an' });
  phone.actions.deleteMessage(BERGER, sent.id);
  await waitFor(() => chatOf(web, BERGER).messages.find((x) => x.id === sent.id).deleted === true, { label: 'Löschen kommt an' });
  assert.equal(h.chat(BERGER).messages.find((x) => x.id === sent.id).text, '', 'Inhalt am Hub geleert');
  assert.equal(phone.getState().lastError, null);
  assert.equal(web.getState().lastError, null);
});

test('Hub offline (Fehler-Injektion) → Outbox wird gespeichert → nach Wiederkehr genau einmal und in Reihenfolge gesendet', async (t) => {
  const h = await startRealHub();
  await h.setSettings({ botMode: 'off' });
  const storage = spyStorage();
  const phone = await device({ storage });
  t.after(async () => { await phone.destroy(); await h.close(); });
  await online(phone, h.url);
  phone.actions.login(OWNER);

  await h.fault({ kind: 'offline', durationMs: 60000 });
  await waitFor(() => phone.getState().hub.status === 'offline', { label: 'offline erkannt' });
  const a = phone.actions.sendMessage(BERGER, { text: 'Erste Nachricht im Funkloch.' });
  const b = phone.actions.sendMessage(BERGER, { text: 'Zweite Nachricht im Funkloch.' });
  const pinned = phone.actions.togglePin(BERGER);
  assert.equal(chatOf(phone, BERGER).pinned.owner, pinned, 'Anheften sofort sichtbar');
  assert.equal(phone.getState().hub.outbox, 3, 'drei Änderungen warten');
  assert.ok(chatOf(phone, BERGER).messages.filter((m) => m.pending).length === 2, 'beide Nachrichten sichtbar als „wird gesendet"');
  await phone.flush();
  const stored = JSON.parse(storage.map.get('vn3:demo:hub:outbox'));
  assert.deepEqual(stored.map((op) => op.method + ' ' + op.path), [
    'POST /chats/' + BERGER + '/messages', 'POST /chats/' + BERGER + '/messages', 'PATCH /chats/' + BERGER,
  ], 'Outbox ist gespeichert (überlebt einen Neustart)');
  assert.equal(h.chat(BERGER).messages.some((m) => m.clientMsgId === a.clientMsgId), false, 'noch nichts am Hub');

  await h.fault({ clear: true });
  await waitFor(() => phone.getState().hub.status === 'online' && phone.getState().hub.outbox === 0, { label: 'Outbox geleert', timeout: 6000 });
  await waitFor(() => chatOf(phone, BERGER).messages.every((m) => !m.pending), { label: 'nichts mehr pending' });
  const hubMsgs = h.chat(BERGER).messages;
  const ia = hubMsgs.findIndex((m) => m.clientMsgId === a.clientMsgId);
  const ib = hubMsgs.findIndex((m) => m.clientMsgId === b.clientMsgId);
  assert.ok(ia >= 0 && ib > ia, 'beide am Hub, in Reihenfolge');
  assert.equal(hubMsgs.filter((m) => m.clientMsgId === a.clientMsgId || m.clientMsgId === b.clientMsgId).length, 2, 'genau einmal');
  assert.equal(!!h.chat(BERGER).pinned.owner, pinned, 'Anheften kam auch an');
  await phone.flush();
  assert.deepEqual(JSON.parse(storage.map.get('vn3:demo:hub:outbox')), [], 'gespeicherte Outbox leer');
  assert.equal(chatOf(phone, BERGER).messages.filter((m) => m.clientMsgId === a.clientMsgId).length, 1);
});

test('Outbox überlebt einen App-Neustart und wird beim nächsten Start automatisch gesendet', async (t) => {
  const h = await startRealHub();
  await h.setSettings({ botMode: 'off' });
  const storage = spyStorage();
  const first = await device({ storage });
  await online(first, h.url);
  first.actions.login(OWNER);
  await h.fault({ kind: 'offline', durationMs: 60000 });
  await waitFor(() => first.getState().hub.status === 'offline', { label: 'offline' });
  const msg = first.actions.sendMessage(BERGER, { text: 'Gesendet kurz vor dem Schließen der App.' });
  await first.destroy(); // App geschlossen — die Outbox liegt nur noch im Speicher-Adapter
  await h.fault({ clear: true });

  const second = await device({ storage });
  t.after(async () => { await second.destroy(); await h.close(); });
  assert.equal(second.getState().mode, 'hub', 'startet wieder im Hub-Modus');
  assert.equal(second.getState().auth.role, 'owner');
  await waitFor(() => h.chat(BERGER).messages.some((m) => m.clientMsgId === msg.clientMsgId), { label: 'Nachricht am Hub', timeout: 6000 });
  await waitFor(() => second.getState().hub.outbox === 0 && chatOf(second, BERGER).messages.every((m) => !m.pending), { label: 'abgeglichen' });
  assert.equal(h.chat(BERGER).messages.filter((m) => m.clientMsgId === msg.clientMsgId).length, 1);
  assert.equal(chatOf(second, BERGER).messages.filter((m) => m.clientMsgId === msg.clientMsgId).length, 1);
});

test('Echter Hub-Neustart: Verbindung reißt ab → offline → Hub kommt mit denselben Daten zurück → Abgleich + Outbox', async (t) => {
  const h = await startRealHub();
  await h.setSettings({ botMode: 'off' });
  const phone = await device();
  t.after(async () => { await phone.destroy(); await h.close(); });
  await online(phone, h.url);
  phone.actions.login(OWNER);
  await h.stop();
  await waitFor(() => phone.getState().hub.status === 'offline', { label: 'offline nach Absturz' });
  const msg = phone.actions.sendMessage(BERGER, { text: 'Während der Hub neu startet.' });
  assert.equal(phone.getState().hub.outbox, 1);
  await h.restart();
  await waitFor(() => phone.getState().hub.status === 'online' && phone.getState().hub.outbox === 0, { label: 'wieder online + Outbox leer', timeout: 8000 });
  await waitFor(() => chatOf(phone, BERGER).messages.every((m) => !m.pending), { label: 'abgeglichen' });
  assert.equal(h.chat(BERGER).messages.filter((m) => m.clientMsgId === msg.clientMsgId).length, 1, 'genau einmal am neu gestarteten Hub');
  assert.deepEqual(phone.getState().chats.map((c) => c.id).sort(), h.hub.state.chats.map((c) => c.id).sort());
});

test('Vorübergehender Serverfehler (5xx) bei laufender Echtzeit-Verbindung: Outbox erholt sich von selbst', async (t) => {
  let failNext = 0;
  // Der Hub würfelt bei aktiver error500-Störung pro Anfrage; so trifft der Fehler genau EINE Anfrage.
  const h = await startRealHub({ hubOptions: { random: () => (failNext > 0 ? (failNext--, 0) : 0.99) } });
  await h.setSettings({ botMode: 'off' });
  const phone = await device({ pollTimeoutMs: 20000 });
  t.after(async () => { await phone.destroy(); await h.close(); });
  await online(phone, h.url);
  phone.actions.login(OWNER);
  await h.fault({ kind: 'error500', durationMs: 60000 });
  await waitFor(() => h.hub.realtime.waitingCount >= 1, { label: 'Long-Poll wartet am Hub' });
  failNext = 1;
  const msg = phone.actions.sendMessage(BERGER, { text: 'Kommt trotz 500 an.' });
  await waitFor(() => failNext === 0, { label: 'Fehler wurde ausgelöst' });
  await waitFor(() => h.chat(BERGER).messages.some((m) => m.clientMsgId === msg.clientMsgId), { label: 'automatisch erneut gesendet', timeout: 6000 });
  await waitFor(() => phone.getState().hub.outbox === 0 && !chatOf(phone, BERGER).messages.find((m) => m.id === msg.id).pending, { label: 'abgeglichen' });
  assert.equal(h.chat(BERGER).messages.filter((m) => m.clientMsgId === msg.clientMsgId).length, 1);
  assert.equal(phone.getState().hub.status, 'online');
  assert.equal(phone.getState().lastError, null, 'kein Fehler für die Nutzer:in — es hat ja geklappt');
});

test('Vom Hub abgelehnte Nachricht (zu lang) wird als „nicht gesendet" markiert und bleibt sichtbar; Löschen entfernt sie lokal', async (t) => {
  const h = await startRealHub();
  await h.setSettings({ botMode: 'off' });
  const phone = await device();
  t.after(async () => { await phone.destroy(); await h.close(); });
  await online(phone, h.url);
  phone.actions.login(OWNER);
  const long = phone.actions.sendMessage(BERGER, { text: 'x'.repeat(20001) });
  await waitFor(() => { const m = chatOf(phone, BERGER).messages.find((x) => x.id === long.id); return m && m.failed; }, { label: 'als fehlgeschlagen markiert' });
  assert.match(phone.getState().lastError.message, /zu lang/);
  await sleep(200); // der anschließende Neuabgleich darf sie nicht verschwinden lassen
  const m = chatOf(phone, BERGER).messages.find((x) => x.id === long.id);
  assert.ok(m && m.failed && !m.pending, 'bleibt als „nicht gesendet" stehen');
  assert.equal(h.chat(BERGER).messages.some((x) => x.id === long.id), false);
  const requestsBefore = h.hub.log.last(1000).filter((e) => e.kind === 'req' && e.method === 'PATCH').length;
  phone.actions.deleteMessage(BERGER, long.id);
  assert.equal(chatOf(phone, BERGER).messages.some((x) => x.id === long.id), false, 'lokal entfernt');
  await sleep(100);
  assert.equal(h.hub.log.last(1000).filter((e) => e.kind === 'req' && e.method === 'PATCH').length, requestsBefore, 'kein sinnloser PATCH an den Hub');
});

test('Status, Abwesenheit, Termin-Abschluss und Labels laufen über den Hub zum anderen Gerät', async (t) => {
  const h = await startRealHub();
  await h.setSettings({ botMode: 'off' });
  const phone = await device();
  const web = await device({ sse: true });
  t.after(async () => { await phone.destroy(); await web.destroy(); await h.close(); });
  await online(phone, h.url);
  await online(web, h.url);
  phone.actions.login(OWNER);
  web.actions.login(DRAUTAL);
  const pOf = (s) => s.getState().practices.find((p) => p.id === 'drautal');

  web.actions.confirmStatus('drautal', 'yellow', 2, 'Nur nach Anruf');
  await waitFor(() => pOf(phone).status.value === 'yellow', { label: 'Status am Handy' });
  assert.equal(effectiveStatus(pOf(phone), Date.now()), 'yellow');
  assert.equal(pOf(phone).status.note, 'Nur nach Anruf');
  web.actions.expireStatus('drautal');
  await waitFor(() => effectiveStatus(pOf(phone), Date.now()) === 'grey', { label: 'abgelaufen → grau' });
  web.actions.setAbsence('drautal', { from: Date.now() - 1000, to: Date.now() + 3600e3, vertretung: 'Tierklinik Villach' });
  await waitFor(() => pOf(phone).absence && effectiveStatus(pOf(phone), Date.now()) === 'red', { label: 'Abwesenheit → rot' });
  assert.equal(pOf(phone).absence.vertretung, 'Tierklinik Villach');

  const apId = web.actions.addAppointment({ date: todayISO(), time: '16:30', name: 'Balu (Familie Berger)', animal: 'dog', reason: 'Kontrolle', chatId: BERGER });
  await waitFor(() => h.hub.state.appointments.some((a) => a.id === apId), { label: 'Termin am Hub' });
  web.actions.completeAppointment(apId, 'Balu geht es wieder gut. Kontrolle in 2 Wochen.');
  const isNote = (m) => m.type === 'note' && m.text === 'Balu geht es wieder gut. Kontrolle in 2 Wochen.';
  await waitFor(() => chatOf(phone, BERGER).messages.some(isNote), { label: 'Abschlussnotiz beim Handy' });
  await waitFor(() => chatOf(web, BERGER).messages.some(isNote), { label: 'Abschlussnotiz in der Praxis' });
  await sleep(150);
  assert.equal(chatOf(phone, BERGER).messages.filter(isNote).length, 1, 'Notiz genau einmal (vom Hub, nicht zusätzlich lokal)');
  assert.equal(chatOf(web, BERGER).messages.filter(isNote).length, 1);
  assert.equal(phone.getState().appointments.find((a) => a.id === apId).status, 'done');

  const lbId = web.actions.createLabel({ name: 'Rückruf', color: '#aa3300', roles: ['clinic'] });
  await waitFor(() => phone.getState().labels.some((l) => l.id === lbId), { label: 'Label am Handy' });
  web.actions.deleteLabel(lbId);
  await waitFor(() => !phone.getState().labels.some((l) => l.id === lbId), { label: 'Label gelöscht' });
  assert.equal(web.getState().lastError, null);
});

test('Uhr-Simulation, Einstellungen, Broadcast/Ping und Reset kommen vom Hub auf alle Geräte', async (t) => {
  const h = await startRealHub();
  await h.setSettings({ botMode: 'off' });
  const toasts = [];
  const phone = await device({ onBroadcast: (ev) => toasts.push(ev) });
  const web = await device({ sse: true });
  t.after(async () => { setClockOffset(0); await phone.destroy(); await web.destroy(); await h.close(); });
  await online(phone, h.url);
  await online(web, h.url);
  phone.actions.login(OWNER);
  web.actions.login(DRAUTAL);

  await h.api('/admin/clock', { method: 'POST', body: { offsetMs: 2 * 3600e3 } });
  await waitFor(() => phone.getState().clockOffsetMs === 2 * 3600e3 && web.getState().clockOffsetMs === 2 * 3600e3, { label: 'Uhr-Versatz' });
  await h.api('/admin/clock', { method: 'POST', body: { reset: true } });
  await waitFor(() => phone.getState().clockOffsetMs === 0, { label: 'Uhr zurück' });

  await h.api('/admin/broadcast', { method: 'POST', body: { kind: 'toast', text: 'Übung beginnt in 5 Minuten.', target: 'all' } });
  await waitFor(() => phone.getState().broadcast && phone.getState().broadcast.text === 'Übung beginnt in 5 Minuten.', { label: 'Broadcast' });
  assert.equal(toasts.length, 1, 'onBroadcast wird genau einmal aufgerufen');
  const ping = await h.api('/admin/ping', { method: 'POST', body: { target: 'all' } });
  const phoneId = phone.getState().hub.clientId;
  // Ergebnis wie im Admin-Center: GET /admin/overview → pings[].results[clientId] = Latenz in ms.
  await waitFor(async () => {
    const ov = await h.api('/admin/overview');
    const p = ov.pings.find((x) => x.pingId === ping.pingId);
    return p && p.results[phoneId] >= 0;
  }, { label: 'Pong vom Handy', interval: 50 });

  web.actions.setSetting('botMode', 'bot');
  await waitFor(() => h.hub.state.settings.botMode === 'bot', { label: 'Einstellung am Hub' });
  await waitFor(() => phone.getState().settings.botMode === 'bot', { label: 'Einstellung am Handy' });

  const extra = phone.actions.createChat({ kind: 'direct', practiceId: 'faak', autoReply: false });
  await waitFor(() => web.getState().chats.some((c) => c.id === extra) || h.chat(extra), { label: 'neuer Chat am Hub' });
  assert.ok(h.chat(extra), 'Hub hat die Client-ID übernommen');
  web.actions.resetDemo();
  await waitFor(() => !h.chat(extra), { label: 'Hub zurückgesetzt' });
  await waitFor(() => !phone.getState().chats.some((c) => c.id === extra), { label: 'Handy hat neu geladen (resync)' });
  await waitFor(() => phone.getState().chats.length === h.hub.state.chats.length, { label: 'Handy = Hub' });
  assert.equal(web.getState().lastError, null);
});

test('Anhänge über den Hub (hub:<id>), Bild erreicht das andere Gerät; Hub-Suche und Admin-Anmeldung', async (t) => {
  const h = await startRealHub();
  await h.setSettings({ botMode: 'off' });
  const phone = await device();
  const web = await device({ sse: true });
  t.after(async () => { await phone.destroy(); await web.destroy(); await h.close(); });
  await online(phone, h.url);
  await online(web, h.url);
  phone.actions.login(OWNER);
  web.actions.login(DRAUTAL);

  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const att = await phone.actions.uploadAttachment('data:image/png;base64,' + PNG, 'pfote.png', 'image/png');
  assert.match(att.ref, /^hub:f-/);
  assert.equal(att.kind, 'image');
  assert.equal(att.mime, 'image/png');
  assert.equal(att.size, Buffer.from(PNG, 'base64').length);
  const sent = phone.actions.sendMessage(BERGER, { text: 'So sieht die Pfote aus.', attachment: att });
  assert.equal(sent.type, 'image');
  await waitFor(() => chatOf(web, BERGER).messages.some((m) => m.id === sent.id), { label: 'Bild bei der Praxis' });
  const got = chatOf(web, BERGER).messages.find((m) => m.id === sent.id);
  assert.equal(got.attachment.ref, att.ref);
  const res = await fetch(web.hubClient().fileUrl(got.attachment.ref));
  assert.equal(res.status, 200);
  assert.equal(Buffer.from(await res.arrayBuffer()).toString('base64'), PNG, 'Datei byte-genau abrufbar');

  const probe = await phone.actions.probeHubs([h.url, 'http://127.0.0.1:9']);
  assert.deepEqual(probe.map((r) => r.ok), [true, false]);
  assert.equal(phone.getState().hub.candidates.length, 2);

  assert.equal(await web.actions.hubAdminLogin('falsch'), false);
  assert.ok(web.getState().lastError, 'falsches Passwort wird gemeldet');
  assert.equal(await web.actions.hubAdminLogin('vetnow2026'), true, 'Standard-Passwort laut Vertrag');
  assert.ok(web.hubClient().adminToken, 'Token wird für Admin-Aktionen mitgeschickt');
});
