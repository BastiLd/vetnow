/* Hub-Kern: Health, State, CORS, SSE, Long-Poll, Geräte, Praxen, Chats, Nachrichten, Anfragen,
   Auto-Antwort, Labels, Termine, Blockzeiten, Anhänge, Bot, Express-Einbettung. */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startHub, openSse, waitUntil, rawGet, tempDir, rmDir, quietLogger, offlineFetch } from './helpers.js';
import { createHub } from '../hub.js';
import { makePng } from '../lib/png.js';

describe('Hub-Kern', () => {
  let t;
  before(async () => {
    t = await startHub();
    // Auto-Antworten in diesen Tests standardmäßig aus — einzelne Tests schalten sie gezielt an.
    await t.api('/admin/settings', { method: 'PUT', body: { botMode: 'off', typing: false } });
  });
  after(async () => { await t.close(); });

  test('GET /health liefert Vertragsfelder', async () => {
    const r = await t.api('/health');
    assert.equal(r.status, 200);
    const h = r.body;
    assert.equal(h.ok, true);
    assert.equal(h.name, 'VetNow Hub');
    assert.equal(h.version, '3.0.0');
    assert.equal(h.protocol, 3);
    for (const k of ['serverTime', 'clockOffsetMs', 'rev', 'uptimeS', 'clients']) assert.equal(typeof h[k], 'number', k);
    assert.equal(h.mode, 'demo');
    assert.ok(h.ai && 'provider' in h.ai && 'ok' in h.ai && 'model' in h.ai);
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
  });

  test('GET /state liefert den kompletten Demo-Zustand', async () => {
    const r = await t.api('/state');
    assert.equal(r.status, 200);
    const s = r.body;
    for (const k of ['practices', 'chats', 'labels', 'appointments', 'blocks']) assert.ok(Array.isArray(s[k]), k);
    assert.ok(s.practices.length >= 1);
    assert.ok(s.practices.some((p) => p.id === 'drautal'));
    assert.ok(s.labels.some((l) => l.id === 'posteingang'));
    assert.equal(typeof s.rev, 'number');
    assert.equal(s.settings.botMode, 'off');
  });

  test('CORS-Preflight inkl. Private Network Access', async () => {
    const res = await fetch(t.base + '/api/v1/chats', {
      method: 'OPTIONS',
      headers: { origin: 'https://bastild.github.io', 'access-control-request-method': 'POST', 'access-control-request-private-network': 'true' },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.equal(res.headers.get('access-control-allow-private-network'), 'true');
    assert.match(res.headers.get('access-control-allow-methods'), /PATCH/);
    const allowed = res.headers.get('access-control-allow-headers');
    for (const h of ['content-type', 'x-vn-client', 'x-vn-admin', 'x-filename']) assert.ok(allowed.includes(h), h);
  });

  test('Unbekannter Endpunkt → 404 JSON, falsche Methode → 405, kaputtes JSON → 400', async () => {
    const a = await t.api('/gibtsnicht');
    assert.equal(a.status, 404);
    assert.equal(a.body.code, 'not-found');
    const b = await t.api('/health', { method: 'DELETE' });
    assert.equal(b.status, 405);
    const c = await t.api('/chats', { method: 'POST', body: '{kaputt', raw: true, headers: { 'content-type': 'application/json' } });
    assert.equal(c.status, 400);
    assert.equal(c.body.code, 'bad-json');
    assert.match(c.body.error, /JSON/);
  });

  test('SSE: hello zuerst, dann Live-Ereignisse mit rev', async () => {
    const sse = await openSse(t.base + '/api/v1/events?client=c-ssetest&platform=web&name=Testgeraet&version=3.0.0');
    try {
      assert.match(sse.res.headers.get('content-type'), /text\/event-stream/);
      const hello = await sse.waitFor((e) => e.type === 'hello');
      assert.equal(hello.clientId, 'c-ssetest');
      assert.equal(typeof hello.rev, 'number');
      assert.equal(typeof hello.serverTime, 'number');
      assert.equal(sse.events[0].type, 'hello');
      await t.api('/practices/drautal/status', { method: 'POST', body: { value: 'yellow', hours: 2 } });
      const ev = await sse.waitFor((e) => e.type === 'practice' && e.practice.id === 'drautal');
      assert.equal(ev.practice.status.value, 'yellow');
      assert.ok(ev.rev > hello.rev);
    } finally { await sse.close(); }
  });

  test('SSE: Keep-alive-Kommentar (kurzes Intervall im Test)', async () => {
    const k = await startHub({ keepAliveMs: 80 });
    try {
      const sse = await openSse(k.base + '/api/v1/events');
      await waitUntil(() => sse.comments.some((c) => c.startsWith(': ka')), 2000);
      assert.ok(sse.comments.length >= 1);
      await sse.close();
    } finally { await k.close(); }
  });

  test('Long-Poll: sofort bei neueren Ereignissen, wartet sonst, resync bei Lücke', async () => {
    const { body: h } = await t.api('/health');
    // 1) Es gibt schon Neues seit rev-1 → sofortige Antwort
    await t.api('/practices/drautal/status', { method: 'POST', body: { value: 'green' } });
    const t0 = Date.now();
    const a = await t.api(`/changes?since=${h.rev}&timeout=5000`);
    assert.equal(a.status, 200);
    assert.ok(Date.now() - t0 < 1500);
    assert.ok(a.body.events.some((e) => e.type === 'practice'));
    assert.ok(a.body.events.every((e) => e.rev > h.rev));
    // 2) Nichts Neues → wartet, bis ein Ereignis kommt. Erst anmelden (timeout=0): Die Anmeldung
    //    eines NEUEN Geräts ist selbst ein Ereignis ('clients') und würde sonst sofort antworten.
    const reg = await t.api(`/changes?since=${a.body.rev}&timeout=0&client=c-poller`);
    const cur = reg.body.rev;
    const t1 = Date.now();
    const pending = t.api(`/changes?since=${cur}&timeout=5000&client=c-poller`);
    await new Promise((r) => setTimeout(r, 150));
    await t.api('/practices/drautal/status', { method: 'POST', body: { value: 'red' } });
    const b = await pending;
    assert.ok(Date.now() - t1 >= 140, 'Long-Poll hat gewartet');
    assert.ok(b.body.events.length >= 1);
    assert.ok(b.body.events.some((e) => e.type === 'practice' && e.practice.status.value === 'red'));
    // 3) Nichts Neues und kurzer Timeout → leere Liste
    const c = await t.api(`/changes?since=${b.body.rev}&timeout=100`);
    assert.deepEqual(c.body.events, []);
    // 4) Unbekannte/zu neue rev → resync
    const d = await t.api('/changes?since=999999999&timeout=100');
    assert.equal(d.body.resync, true);
    const e = await t.api('/changes?timeout=100');
    assert.equal(e.body.resync, true);
  });

  test('Geräteliste: SSE + Long-Poll registriert, clients-Ereignis, Aufräumen nach Leerlauf', async () => {
    const k = await startHub({ clientIdleMs: 100 });
    try {
      const watch = await openSse(k.base + '/api/v1/events?client=c-watcher');
      await watch.waitFor((e) => e.type === 'hello');
      const sse = await openSse(k.base + '/api/v1/events?client=c-geraet1&platform=ios&name=iPhone&version=3.0.0');
      await sse.waitFor((e) => e.type === 'hello');
      await watch.waitFor((e) => e.type === 'clients' && e.count >= 2);
      await k.api('/changes?since=0&timeout=0&client=c-poll1&platform=android');
      const { body: list } = await k.api('/clients');
      assert.ok(Array.isArray(list));
      const g = list.find((c) => c.id === 'c-geraet1');
      assert.ok(g, 'SSE-Gerät fehlt');
      assert.equal(g.via, 'sse');
      assert.equal(g.platform, 'ios');
      assert.equal(g.name, 'iPhone');
      for (const f of ['connectedAt', 'lastSeen']) assert.equal(typeof g[f], 'number');
      const p = list.find((c) => c.id === 'c-poll1');
      assert.equal(p.via, 'poll');
      await sse.close();
      await new Promise((r) => setTimeout(r, 250));
      k.hub.realtime.sweep();
      const { body: after } = await k.api('/clients');
      assert.ok(!after.some((c) => c.id === 'c-geraet1'), 'Gerät wurde nicht entfernt');
      assert.ok(!after.some((c) => c.id === 'c-poll1'));
      assert.ok(after.some((c) => c.id === 'c-watcher'), 'verbundenes Gerät darf bleiben');
      await watch.close();
    } finally { await k.close(); }
  });

  test('Praxis-Status bestätigen, ablaufen lassen, Abwesenheit, PATCH', async () => {
    const before = Date.now();
    const a = await t.api('/practices/drautal/status', { method: 'POST', body: { value: 'green', hours: 24, note: 'Notdienst bis 22 Uhr' } });
    assert.equal(a.status, 200);
    const s = a.body.practice.status;
    assert.equal(s.value, 'green');
    assert.ok(s.setAt >= before && s.setAt <= Date.now());
    assert.ok(Math.abs(s.expiresAt - s.setAt - 24 * 3600e3) < 5);
    assert.equal(s.note, 'Notdienst bis 22 Uhr');
    const b = await t.api('/practices/drautal/status', { method: 'POST', body: { expire: true } });
    assert.ok(b.body.practice.status.expiresAt < Date.now());
    assert.equal(b.body.practice.status.value, 'green', 'Rohwert bleibt, grau rechnen die Clients');
    const bad = await t.api('/practices/drautal/status', { method: 'POST', body: { value: 'lila' } });
    assert.equal(bad.status, 400);
    const nf = await t.api('/practices/gibtsnicht/status', { method: 'POST', body: { value: 'green' } });
    assert.equal(nf.status, 404);
    const from = Date.now();
    const c = await t.api('/practices/drautal/absence', { method: 'POST', body: { from, to: from + 3600e3, vertretung: 'Tiernotdienst Wörthersee' } });
    assert.deepEqual(c.body.practice.absence, { from, to: from + 3600e3, vertretung: 'Tiernotdienst Wörthersee' });
    const badAbs = await t.api('/practices/drautal/absence', { method: 'POST', body: { from, to: from - 1 } });
    assert.equal(badAbs.status, 400);
    const d = await t.api('/practices/drautal/absence', { method: 'POST', body: 'null', raw: true, headers: { 'content-type': 'application/json' } });
    assert.equal(d.body.practice.absence, null);
    const e = await t.api('/practices/drautal', { method: 'PATCH', body: { phone: '+43 4242 12345', profile: { about: 'Neu' }, id: 'hack' } });
    assert.equal(e.body.practice.phone, '+43 4242 12345');
    assert.equal(e.body.practice.profile.about, 'Neu');
    assert.equal(e.body.practice.id, 'drautal');
  });

  test('Chats: anlegen, idempotent, ändern, löschen (+ Ereignisse)', async () => {
    const sse = await openSse(t.base + '/api/v1/events');
    try {
      const r = await t.api('/chats', { method: 'POST', body: { id: 'ch-test1', kind: 'direct', practiceId: 'drautal', petName: 'Balu', animal: 'dog', topic: 'Test', autoReply: false } });
      assert.equal(r.status, 201);
      assert.equal(r.body.chat.id, 'ch-test1');
      assert.equal(r.body.chat.ownerId, 'owner-demo');
      assert.deepEqual(r.body.chat.unread, { owner: 0, clinic: 0 });
      const ev = await sse.waitFor((e) => e.type === 'chat' && e.chat.id === 'ch-test1');
      assert.equal(ev.chat.messages, undefined, 'chat-Ereignis ohne messages');
      const again = await t.api('/chats', { method: 'POST', body: { id: 'ch-test1', kind: 'direct', practiceId: 'drautal' } });
      assert.equal(again.status, 200);
      assert.equal(again.body.created, false);
      const net = await t.api('/chats', { method: 'POST', body: { kind: 'network', practiceId: 'drautal', peerPracticeId: 'drautal' } });
      assert.equal(net.status, 400);
      const badKind = await t.api('/chats', { method: 'POST', body: { kind: 'quatsch', practiceId: 'drautal' } });
      assert.equal(badKind.status, 400);
      const p = await t.api('/chats/ch-test1', { method: 'PATCH', body: { labels: ['termin', 'termin'], pinned: { clinic: true }, topic: 'Geändert', messages: [] } });
      assert.equal(p.status, 200);
      assert.deepEqual(p.body.chat.labels, ['termin']);
      assert.equal(p.body.chat.pinned.clinic, true);
      assert.equal(p.body.chat.topic, 'Geändert');
      const d = await t.api('/chats/ch-test1', { method: 'DELETE' });
      assert.equal(d.body.ok, true);
      await sse.waitFor((e) => e.type === 'chat:deleted' && e.id === 'ch-test1');
      assert.equal((await t.api('/chats/ch-test1', { method: 'DELETE' })).status, 404);
      assert.equal((await t.api('/chats/..%2Fx', { method: 'DELETE' })).status, 400);
    } finally { await sse.close(); }
  });

  test('Nachrichten: senden (clientMsgId idempotent, meta durchgereicht), bearbeiten, Reaktion, Sterne, löschen', async () => {
    await t.api('/chats', { method: 'POST', body: { id: 'ch-msg', kind: 'request', practiceId: 'drautal', autoReply: false } });
    const a = await t.api('/chats/ch-msg/messages', { method: 'POST', body: { from: 'owner', type: 'text', text: 'Hallo <b>Praxis</b>', clientMsgId: 'cm-1', meta: { foo: { bar: 1 } }, unbekannt: 'bleibt' } });
    assert.equal(a.status, 201);
    const m = a.body.message;
    assert.match(m.id, /^m-/);
    assert.equal(m.text, 'Hallo <b>Praxis</b>', 'Text wortgetreu');
    assert.deepEqual(m.meta, { foo: { bar: 1 } });
    assert.equal(m.unbekannt, 'bleibt');
    assert.equal(typeof m.ts, 'number');
    const dup = await t.api('/chats/ch-msg/messages', { method: 'POST', body: { from: 'owner', text: 'Hallo <b>Praxis</b>', clientMsgId: 'cm-1' } });
    assert.equal(dup.status, 200);
    assert.equal(dup.body.duplicate, true);
    assert.equal(dup.body.message.id, m.id);
    const state = (await t.api('/state')).body;
    const chat = state.chats.find((c) => c.id === 'ch-msg');
    assert.equal(chat.messages.length, 1);
    assert.equal(chat.unread.clinic, 1, 'Ungelesen der Praxis erhöht');
    assert.equal((await t.api('/chats/ch-msg/messages', { method: 'POST', body: { from: 'hacker', text: 'x' } })).status, 400);
    assert.equal((await t.api('/chats/ch-msg/messages', { method: 'POST', body: { from: 'owner', text: '   ' } })).status, 400);
    assert.equal((await t.api('/chats/ch-nope/messages', { method: 'POST', body: { from: 'owner', text: 'x' } })).status, 404);
    const e = await t.api(`/chats/ch-msg/messages/${m.id}`, { method: 'PATCH', body: { text: 'Hallo Praxis (bearbeitet)' } });
    assert.equal(e.body.message.text, 'Hallo Praxis (bearbeitet)');
    assert.equal(typeof e.body.message.editedAt, 'number');
    const r = await t.api(`/chats/ch-msg/messages/${m.id}`, { method: 'PATCH', body: { reaction: { side: 'clinic', emoji: '👍' } } });
    assert.deepEqual(r.body.message.reactions, { clinic: '👍' });
    const r2 = await t.api(`/chats/ch-msg/messages/${m.id}`, { method: 'PATCH', body: { reaction: { side: 'clinic', emoji: null } } });
    assert.equal(r2.body.message.reactions, undefined);
    const s = await t.api(`/chats/ch-msg/messages/${m.id}`, { method: 'PATCH', body: { rating: 5 } });
    assert.equal(s.body.message.rating, 5);
    assert.equal((await t.api(`/chats/ch-msg/messages/${m.id}`, { method: 'PATCH', body: { rating: 9 } })).status, 400);
    const del = await t.api(`/chats/ch-msg/messages/${m.id}`, { method: 'PATCH', body: { deleted: true } });
    assert.equal(del.body.message.deleted, true);
    assert.equal(del.body.message.text, '');
    assert.equal(typeof del.body.message.deletedAt, 'number');
    assert.equal((await t.api(`/chats/ch-msg/messages/${m.id}`, { method: 'PATCH', body: { text: 'wieder da?' } })).status, 409);
  });

  test('Gelesen-Markierung und Tipp-Anzeige werden als Ereignisse verteilt', async () => {
    const sse = await openSse(t.base + '/api/v1/events');
    try {
      await t.api('/chats', { method: 'POST', body: { id: 'ch-read', kind: 'direct', practiceId: 'drautal', unread: { clinic: 4, owner: 2 } } });
      const r = await t.api('/chats/ch-read/read', { method: 'POST', body: { side: 'clinic' } });
      assert.equal(r.body.ok, true);
      const ev = await sse.waitFor((e) => e.type === 'read' && e.chatId === 'ch-read');
      assert.equal(ev.side, 'clinic');
      const chat = (await t.api('/state')).body.chats.find((c) => c.id === 'ch-read');
      assert.deepEqual(chat.unread, { owner: 2, clinic: 0 });
      assert.equal((await t.api('/chats/ch-read/read', { method: 'POST', body: { side: 'x' } })).status, 400);
      const ty = await t.api('/chats/ch-read/typing', { method: 'POST', body: { from: 'owner', on: true } });
      assert.equal(ty.body.ok, true);
      const tev = await sse.waitFor((e) => e.type === 'typing' && e.chatId === 'ch-read');
      assert.equal(tev.from, 'owner');
      assert.equal(tev.on, true);
    } finally { await sse.close(); }
  });

  test('Anfrage → Chat im Posteingang + Bot-Antwort (botMode bot, typing aus)', async () => {
    await t.api('/admin/settings', { method: 'PUT', body: { botMode: 'bot', typing: false } });
    try {
      const r = await t.api('/requests', { method: 'POST', body: { practiceId: 'drautal', ownerName: 'Anna Test', phone: '+43 660 111', animal: 'dog', petName: 'Rex', situation: 'emergency', district: 'Villach', message: 'Rex hat Schokolade gefressen!' } });
      assert.equal(r.status, 201);
      const c = r.body.chat;
      assert.equal(c.kind, 'request');
      assert.equal(c.practiceId, 'drautal');
      assert.equal(c.ownerId, 'owner-demo');
      assert.deepEqual(c.labels, ['posteingang', 'notfall']);
      assert.equal(c.messages[0].from, 'owner');
      assert.equal(c.messages[0].text, 'Rex hat Schokolade gefressen!');
      assert.equal(c.unread.clinic, 1);
      const reply = await waitUntil(async () => {
        const chat = (await t.api('/state')).body.chats.find((x) => x.id === c.id);
        return chat.messages.find((m) => m.from === 'clinic');
      });
      assert.equal(reply.source, 'bot');
      assert.ok(reply.text.length > 10);
      const plain = await t.api('/requests', { method: 'POST', body: { practiceId: 'drautal', ownerId: 'owner-x', situation: 'regular', autoReply: false } });
      assert.deepEqual(plain.body.chat.labels, ['posteingang']);
      assert.equal(plain.body.chat.ownerId, 'owner-x');
      assert.equal(plain.body.chat.messages[0].text, 'Guten Tag, ich hätte gern einen Termin.');
      assert.equal((await t.api('/requests', { method: 'POST', body: { practiceId: 'nope' } })).status, 404);
    } finally {
      await t.hub.replier.idle();
      await t.api('/admin/settings', { method: 'PUT', body: { botMode: 'off', typing: false } });
    }
  });

  test('Auto-Antwort mit Test-KI (botMode ai, Anbieter mock) → Stempel mock-ai', async () => {
    await t.api('/admin/settings', { method: 'PUT', body: { botMode: 'ai', typing: false, ai: { provider: 'mock' } } });
    try {
      const r = await t.api('/requests', { method: 'POST', body: { practiceId: 'drautal', situation: 'regular', message: 'Sag Apfel' } });
      const reply = await waitUntil(async () => {
        const chat = (await t.api('/state')).body.chats.find((x) => x.id === r.body.chat.id);
        return chat.messages.find((m) => m.from === 'clinic');
      });
      assert.equal(reply.source, 'mock-ai');
      assert.equal(reply.text, 'Apfel');
    } finally {
      await t.hub.replier.idle();
      await t.api('/admin/settings', { method: 'PUT', body: { botMode: 'off', ai: { provider: 'auto' } } });
    }
  });

  test('Auto-Antwort: Tipp-Anzeige an/aus, Zusammenfassen bei mehreren Nachrichten, Abbruch beim Löschen', async () => {
    await t.api('/admin/settings', { method: 'PUT', body: { botMode: 'bot', typing: true } });
    const sse = await openSse(t.base + '/api/v1/events');
    try {
      await t.api('/chats', { method: 'POST', body: { id: 'ch-auto', kind: 'request', practiceId: 'drautal', autoReply: true } });
      for (const text of ['Hallo', 'Unser Hund humpelt', 'Können wir morgen kommen?']) {
        await t.api('/chats/ch-auto/messages', { method: 'POST', body: { from: 'owner', text } });
      }
      await sse.waitFor((e) => e.type === 'typing' && e.chatId === 'ch-auto' && e.on === true && e.from === 'clinic');
      await sse.waitFor((e) => e.type === 'message' && e.chatId === 'ch-auto' && e.message.from === 'clinic', 8000);
      await sse.waitFor((e) => e.type === 'typing' && e.chatId === 'ch-auto' && e.on === false, 8000);
      await t.hub.replier.idle();
      const chat = (await t.api('/state')).body.chats.find((c) => c.id === 'ch-auto');
      const replies = chat.messages.filter((m) => m.from === 'clinic');
      assert.ok(replies.length >= 1);
      const firstReplyIdx = chat.messages.findIndex((m) => m.from === 'clinic');
      assert.equal(firstReplyIdx, 3, 'nur EINE Antwortrunde nach der letzten Nachricht');
      // Abbruch: Nachricht senden, Chat sofort löschen → keine Antwort, kein Fehler
      await t.api('/chats', { method: 'POST', body: { id: 'ch-cancel', kind: 'request', practiceId: 'drautal', autoReply: true } });
      await t.api('/chats/ch-cancel/messages', { method: 'POST', body: { from: 'owner', text: 'Hallo?' } });
      await t.api('/chats/ch-cancel', { method: 'DELETE' });
      await t.hub.replier.idle();
      assert.equal(t.hub.replier.stats().failed, 0);
      assert.ok(!(await t.api('/state')).body.chats.some((c) => c.id === 'ch-cancel'));
    } finally {
      await sse.close();
      await t.api('/admin/settings', { method: 'PUT', body: { botMode: 'off', typing: false } });
    }
  });

  test('Labels: anlegen, ändern, löschen (Seed-Labels geschützt, Chats bereinigt)', async () => {
    const a = await t.api('/labels', { method: 'POST', body: { name: 'Rückruf', color: '#ff8800', icon: 'phone', roles: ['clinic'] } });
    assert.equal(a.status, 201);
    const id = a.body.label.id;
    assert.match(id, /^lb-/);
    assert.deepEqual(a.body.label.roles, ['clinic']);
    assert.equal(a.body.label.seed, false);
    await t.api('/chats', { method: 'POST', body: { id: 'ch-lbl', kind: 'direct', practiceId: 'drautal', labels: [id, 'termin'] } });
    const u = await t.api(`/labels/${id}`, { method: 'PATCH', body: { name: 'Rückruf bitte', color: 'rot' } });
    assert.equal(u.status, 400);
    const u2 = await t.api(`/labels/${id}`, { method: 'PATCH', body: { name: 'Rückruf bitte' } });
    assert.equal(u2.body.label.name, 'Rückruf bitte');
    assert.equal((await t.api('/labels', { method: 'POST', body: { name: '' } })).status, 400);
    assert.equal((await t.api('/labels/posteingang', { method: 'DELETE' })).status, 409);
    const d = await t.api(`/labels/${id}`, { method: 'DELETE' });
    assert.equal(d.body.ok, true);
    const chat = (await t.api('/state')).body.chats.find((c) => c.id === 'ch-lbl');
    assert.deepEqual(chat.labels, ['termin']);
  });

  test('Termine: Liste mit Filter, anlegen, prüfen, Abschlussnotiz landet im Chat', async () => {
    await t.api('/chats', { method: 'POST', body: { id: 'ch-appt', kind: 'request', practiceId: 'drautal' } });
    const sse = await openSse(t.base + '/api/v1/events');
    try {
      const a = await t.api('/appointments', { method: 'POST', body: { practiceId: 'drautal', date: '2030-01-15', time: '09:30', durationMin: 30, name: 'Familie Test', animal: 'cat', reason: 'Impfung', chatId: 'ch-appt' } });
      assert.equal(a.status, 201);
      const id = a.body.appointment.id;
      assert.equal(a.body.appointment.status, 'open');
      assert.equal((await t.api('/appointments', { method: 'POST', body: { practiceId: 'drautal', date: '15.01.2030', time: '09:30' } })).status, 400);
      assert.equal((await t.api('/appointments', { method: 'POST', body: { practiceId: 'drautal', date: '2030-01-15', time: '25:00' } })).status, 400);
      const list = await t.api('/appointments?practiceId=drautal&from=2030-01-01&to=2030-01-31');
      assert.deepEqual(list.body.appointments.map((x) => x.id), [id]);
      const done = await t.api(`/appointments/${id}`, { method: 'PATCH', body: { status: 'done', note: 'Impfung erledigt, nächste in 1 Jahr.' } });
      assert.equal(done.status, 200);
      assert.equal(done.body.appointment.status, 'done');
      assert.equal(done.body.noteMessage.type, 'note');
      assert.equal(done.body.noteMessage.from, 'clinic');
      const ev = await sse.waitFor((e) => e.type === 'message' && e.chatId === 'ch-appt' && e.message.type === 'note');
      assert.equal(ev.message.text, 'Impfung erledigt, nächste in 1 Jahr.');
      // gleiche Notiz nochmal → keine zweite Nachricht
      await t.api(`/appointments/${id}`, { method: 'PATCH', body: { status: 'done', note: 'Impfung erledigt, nächste in 1 Jahr.' } });
      const chat = (await t.api('/state')).body.chats.find((c) => c.id === 'ch-appt');
      assert.equal(chat.messages.filter((m) => m.type === 'note').length, 1);
      const del = await t.api(`/appointments/${id}`, { method: 'DELETE' });
      assert.equal(del.body.ok, true);
      await sse.waitFor((e) => e.type === 'appointment:deleted' && e.id === id);
    } finally { await sse.close(); }
  });

  test('Blockzeiten anlegen und prüfen', async () => {
    const a = await t.api('/blocks', { method: 'POST', body: { practiceId: 'drautal', weekday: 2, time: '12:00', end: '13:30', label: 'OP-Zeit' } });
    assert.equal(a.status, 201);
    assert.equal(a.body.block.weekday, 2);
    assert.equal((await t.api('/blocks', { method: 'POST', body: { practiceId: 'drautal', weekday: 7, time: '12:00', end: '13:00' } })).status, 400);
    assert.equal((await t.api('/blocks', { method: 'POST', body: { practiceId: 'drautal', weekday: 1, time: '14:00', end: '13:00' } })).status, 400);
  });

  test('Anhänge: hoch-/runterladen, 413 über 10 MB, Pfad-Tricks abgewiesen, HTML nur als Download', async () => {
    const png = makePng(20, 20);
    const up = await t.api('/files', { method: 'POST', body: png, raw: true, headers: { 'content-type': 'image/png', 'x-filename': encodeURIComponent('Röntgen Bild.png') } });
    assert.equal(up.status, 201);
    assert.match(up.body.id, /^f-/);
    assert.equal(up.body.ref, 'hub:' + up.body.id);
    assert.equal(up.body.url, '/api/v1/files/' + up.body.id);
    assert.equal(up.body.size, png.length);
    assert.equal(up.body.mime, 'image/png');
    assert.equal(up.body.name, 'Röntgen Bild.png');
    const down = await fetch(t.base + up.body.url);
    assert.equal(down.status, 200);
    assert.equal(down.headers.get('content-type'), 'image/png');
    assert.ok(Buffer.from(await down.arrayBuffer()).equals(png));
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
    const tooBig = await t.api('/files', { method: 'POST', body: big, raw: true, headers: { 'content-type': 'application/octet-stream' } });
    assert.equal(tooBig.status, 413);
    assert.equal(tooBig.body.code, 'too-large');
    const trav = await rawGet(t.base, '/api/v1/files/..%2F..%2Fstate.json');
    assert.equal(trav.status, 400);
    assert.ok(!trav.body.includes('practices'));
    const trav2 = await rawGet(t.base, '/api/v1/files/f-abc/../../state.json');
    assert.notEqual(trav2.status, 200);
    assert.equal((await t.api('/files/f-000000notfound')).status, 404);
    const html = await t.api('/files', { method: 'POST', body: '<script>alert(1)</script>', raw: true, headers: { 'content-type': 'text/html' } });
    const h = await fetch(t.base + html.body.url);
    assert.match(h.headers.get('content-disposition'), /^attachment/);
    assert.match(h.headers.get('content-security-policy'), /sandbox/);
    assert.equal(h.headers.get('x-content-type-options'), 'nosniff');
  });

  test('Bot: /bot/reply liefert Antwort inkl. explain, /bot/suite liefert Ergebnis', async () => {
    const r = await t.api('/bot/reply', { method: 'POST', body: { text: 'Mein Hund hat Schokolade gefressen', persona: 'clinic', practiceName: 'Tierarztpraxis Drautal' } });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.texts) && r.body.texts.length >= 1);
    assert.ok('intent' in r.body && 'explain' in r.body);
    assert.equal((await t.api('/bot/reply', { method: 'POST', body: { text: '' } })).status, 400);
    const s = await t.api('/bot/suite', { method: 'POST', body: {} });
    assert.equal(s.status, 200);
    assert.equal(typeof s.body.passed, 'number');
    assert.equal(typeof s.body.failed, 'number');
    assert.ok(Array.isArray(s.body.results));
    assert.equal(s.body.failed, 0, 'Bot-Regression muss grün sein');
  });
});

describe('Einbettung wie im Studio (Express-artig)', () => {
  test('handle() nutzt vorgelesenen req.body und ruft next() für fremde Pfade', async () => {
    const dir = tempDir();
    const hub = await createHub({ dataDir: dir, logger: quietLogger, fetchImpl: offlineFetch, env: {}, rootRedirect: false });
    let nextCalls = 0;
    const server = http.createServer((req, res) => {
      // Nachbau von express.json(): Body lesen, req.body setzen, req._body = true
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        if ((req.headers['content-type'] || '').includes('json') && chunks.length) { req.body = JSON.parse(Buffer.concat(chunks).toString()); req._body = true; }
        hub.handle(req, res, () => { nextCalls++; res.writeHead(200, { 'content-type': 'text/plain' }); res.end('studio'); });
      });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const r = await fetch(base + '/api/v1/chats', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'direct', practiceId: 'drautal' }) });
      assert.equal(r.status, 201);
      const other = await fetch(base + '/studio/apps');
      assert.equal(await other.text(), 'studio');
      const root = await fetch(base + '/', { redirect: 'manual' });
      assert.equal(root.status, 200);
      assert.equal(nextCalls, 2);
    } finally {
      await new Promise((r) => server.close(r));
      await hub.close();
      rmDir(dir);
    }
  });
});
