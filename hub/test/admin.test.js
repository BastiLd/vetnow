/* Admin-/Test-Endpunkte, Persistenz über Neustart und Auslieferung der Web-App. */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { startHub, openSse, waitUntil, rawGet, tempDir, rmDir } from './helpers.js';

const LAN = { 'x-test-remote': '192.168.1.50' };

describe('Admin', () => {
  let t;
  let rnd = 0.9;
  before(async () => {
    t = await startHub({ random: () => rnd });
    await t.api('/admin/settings', { method: 'PUT', body: { botMode: 'off', typing: false } });
  });
  after(async () => { await t.close(); });

  test('Anmeldung: localhost ohne Token, LAN nur mit Token, Proxy-Header hebt Freigabe auf', async () => {
    const local = await t.api('/admin/overview');
    assert.equal(local.status, 200);
    assert.equal(local.body.auth, 'local');
    const lan = await t.api('/admin/overview', { headers: LAN });
    assert.equal(lan.status, 401);
    assert.equal(lan.body.code, 'unauthorized');
    const fwd = await t.api('/admin/overview', { headers: { 'x-forwarded-for': '203.0.113.9' } });
    assert.equal(fwd.status, 401, 'hinter einem Proxy keine localhost-Freigabe');
    const wrong = await t.api('/admin/login', { method: 'POST', body: { password: 'falsch' }, headers: LAN });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.code, 'bad-password');
    const ok = await t.api('/admin/login', { method: 'POST', body: { password: 'test-pass' }, headers: LAN });
    assert.equal(ok.status, 200);
    assert.match(ok.body.token, /^[0-9a-f]{64}$/);
    assert.ok(ok.body.expiresAt > Date.now() + 11 * 3600e3);
    const withToken = await t.api('/admin/overview', { headers: { ...LAN, 'x-vn-admin': ok.body.token } });
    assert.equal(withToken.status, 200);
    assert.equal(withToken.body.auth, 'token');
    const badToken = await t.api('/admin/settings', { headers: { ...LAN, 'x-vn-admin': 'f'.repeat(64) } });
    assert.equal(badToken.status, 401);
    // Normale (Nicht-Admin-)Endpunkte gehen aus dem LAN ohne Token
    assert.equal((await t.api('/health', { headers: LAN })).status, 200);
  });

  test('Überblick enthält Version, Zähler, Clients, KI, Log, Fehler-Injektion', async () => {
    const { body: o } = await t.api('/admin/overview');
    assert.equal(o.version, '3.0.0');
    assert.equal(typeof o.uptimeS, 'number');
    assert.equal(typeof o.rev, 'number');
    for (const k of ['practices', 'chats', 'messages', 'labels', 'appointments', 'blocks']) assert.equal(typeof o.counts[k], 'number', k);
    const sc = o.statusCounts;
    assert.equal(sc.green + sc.yellow + sc.grey + sc.red, o.counts.practices, 'effektive Ampel für jede Praxis');
    assert.ok(Array.isArray(o.clients));
    assert.ok(Array.isArray(o.log));
    assert.ok(Array.isArray(o.faults));
    assert.ok(o.ai && Array.isArray(o.ai.providers));
    assert.deepEqual(o.shared.fallbacks, []);
  });

  test('Einstellungen lesen/schreiben mit Prüfung, Ereignis settings', async () => {
    const sse = await openSse(t.base + '/api/v1/events');
    try {
      const g = await t.api('/admin/settings');
      assert.equal(g.body.settings.botMode, 'off');
      const p = await t.api('/admin/settings', { method: 'PUT', body: { settings: { greeting: false, ai: { model: 'llama3.2:3b' } } } });
      assert.equal(p.body.settings.greeting, false);
      assert.equal(p.body.settings.ai.model, 'llama3.2:3b');
      assert.equal(p.body.settings.ai.provider, 'auto', 'tiefe Zusammenführung behält provider');
      await sse.waitFor((e) => e.type === 'settings' && e.settings.greeting === false);
      assert.equal((await t.api('/admin/settings', { method: 'PUT', body: { botMode: 'chaos' } })).status, 400);
      assert.equal((await t.api('/admin/settings', { method: 'PUT', body: { ai: { provider: 'skynet' } } })).status, 400);
      await t.api('/admin/settings', { method: 'PUT', body: { greeting: true, ai: { model: '' } } });
    } finally { await sse.close(); }
  });

  test('Simulator: alle Aktionen', async () => {
    const sim = (action, extra = {}) => t.api('/admin/simulate', { method: 'POST', body: { action, ...extra } });
    const state = async () => (await t.api('/state')).body;

    const er = await sim('emergency-request');
    assert.equal(er.status, 200);
    assert.equal(er.body.ok, true);
    let s = await state();
    const ec = s.chats.find((c) => c.id === er.body.chatId);
    assert.equal(ec.kind, 'request');
    assert.ok(ec.labels.includes('notfall'));
    assert.equal(ec.isTestData, true);

    const om = await sim('owner-message', { chatId: ec.id, text: 'Owner hier' });
    const cm = await sim('clinic-message', { chatId: ec.id });
    s = await state();
    const msgs = s.chats.find((c) => c.id === ec.id).messages;
    assert.equal(msgs.find((m) => m.id === om.body.messageId).text, 'Owner hier');
    assert.equal(msgs.find((m) => m.id === cm.body.messageId).from, 'clinic');
    const defaultChat = await sim('owner-message');
    assert.equal(defaultChat.status, 200, 'ohne chatId wird ein passender Chat gewählt');

    await sim('status', { practiceId: 'drautal', value: 'red' });
    assert.equal((await state()).practices.find((p) => p.id === 'drautal').status.value, 'red');
    assert.equal((await sim('status', { practiceId: 'drautal', value: 'pink' })).status, 400);

    const all = await sim('status-all', { value: 'yellow' });
    assert.ok(all.body.count >= 1);
    assert.ok((await state()).practices.every((p) => p.status.value === 'yellow'));

    const rand = await sim('status-random');
    assert.equal(Object.keys(rand.body.values).length, all.body.count);

    const ex = await sim('expire-status', { practiceId: 'drautal' });
    assert.ok(ex.body.expiresAt < Date.now());
    const ex2 = await sim('expire-status', { practiceId: 'drautal', inMs: 60000 });
    assert.ok(ex2.body.expiresAt > Date.now() + 50000);

    const ab = await sim('absence', { practiceId: 'drautal', on: true });
    assert.ok(ab.body.absence.from <= Date.now() && ab.body.absence.to > Date.now());
    assert.ok(ab.body.absence.vertretung);
    const ab2 = await sim('absence', { practiceId: 'drautal', on: false });
    assert.equal(ab2.body.absence, null);

    const ar = await sim('appointment-request');
    s = await state();
    const appt = s.appointments.find((a) => a.id === ar.body.appointmentId);
    assert.equal(appt.chatId, ar.body.chatId);
    assert.equal(appt.status, 'open');
    assert.ok(s.chats.find((c) => c.id === ar.body.chatId).labels.includes('termin'));

    const before = (await state()).chats.find((c) => c.id === ec.id).messages.length;
    const bu = await sim('burst', { chatId: ec.id, count: 5 });
    assert.equal(bu.body.count, 5);
    assert.equal((await state()).chats.find((c) => c.id === ec.id).messages.length, before + 5);

    const xss = await sim('xss-message', { chatId: ec.id });
    s = await state();
    const xm = s.chats.find((c) => c.id === ec.id).messages.find((m) => m.id === xss.body.messageId);
    assert.match(xm.text, /<script>alert\("XSS"\)<\/script>/, 'wortgetreu gespeichert');
    const log = await t.api('/admin/log');
    assert.ok(log.body.entries.some((e) => e.kind === 'warn' && /HTML\/Script/.test(e.msg)), 'im Protokoll vermerkt');

    const img = await sim('image-message', { chatId: ec.id });
    s = await state();
    const im = s.chats.find((c) => c.id === ec.id).messages.find((m) => m.id === img.body.messageId);
    assert.equal(im.type, 'image');
    assert.equal(im.attachment.ref, 'hub:' + img.body.fileId);
    const file = await fetch(t.base + '/api/v1/files/' + img.body.fileId);
    assert.equal(file.headers.get('content-type'), 'image/png');

    const lm = await sim('long-message', { chatId: ec.id });
    assert.ok(lm.body.length > 2000);

    const unknown = await sim('weltuntergang');
    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.code, 'bad-action');
  });

  test('Broadcast an alle und gezielt an ein Gerät', async () => {
    const a = await openSse(t.base + '/api/v1/events?client=c-bc-a');
    const b = await openSse(t.base + '/api/v1/events?client=c-bc-b');
    try {
      await a.waitFor((e) => e.type === 'hello');
      await b.waitFor((e) => e.type === 'hello');
      const r1 = await t.api('/admin/broadcast', { method: 'POST', body: { kind: 'toast', text: 'Nur für B', level: 'warn', target: 'c-bc-b' } });
      assert.equal(r1.body.ok, true);
      const r2 = await t.api('/admin/broadcast', { method: 'POST', body: { kind: 'navigate', route: '#/chats', target: 'all' } });
      const nav = await a.waitFor((e) => e.type === 'broadcast' && e.kind === 'navigate');
      assert.equal(nav.route, '#/chats');
      assert.equal(nav.rev, r2.body.rev);
      assert.ok(!a.events.some((e) => e.type === 'broadcast' && e.text === 'Nur für B'), 'A darf die gezielte Nachricht nicht sehen');
      const toast = await b.waitFor((e) => e.type === 'broadcast' && e.kind === 'toast');
      assert.equal(toast.text, 'Nur für B');
      assert.equal(toast.level, 'warn');
      assert.equal((await t.api('/admin/broadcast', { method: 'POST', body: { kind: 'toast' } })).status, 400);
      assert.equal((await t.api('/admin/broadcast', { method: 'POST', body: { kind: 'explode', text: 'x' } })).status, 400);
    } finally { await a.close(); await b.close(); }
  });

  test('Ping → Pong: Latenz je Gerät', async () => {
    const sse = await openSse(t.base + '/api/v1/events?client=c-pinger&platform=web');
    try {
      await sse.waitFor((e) => e.type === 'hello');
      const p = await t.api('/admin/ping', { method: 'POST', body: { target: 'c-pinger' } });
      assert.equal(p.body.ok, true);
      const ev = await sse.waitFor((e) => e.type === 'ping');
      assert.equal(ev.pingId, p.body.pingId);
      assert.equal(ev.target, 'c-pinger');
      const pong = await t.api('/clients/c-pinger/pong', { method: 'POST', body: { pingId: ev.pingId } });
      assert.equal(pong.body.ok, true);
      assert.equal(typeof pong.body.latencyMs, 'number');
      const c = (await t.api('/clients')).body.find((x) => x.id === 'c-pinger');
      assert.equal(c.latencyMs, pong.body.latencyMs);
      const o = (await t.api('/admin/overview')).body;
      assert.equal(o.pings[0].results['c-pinger'], pong.body.latencyMs);
      assert.equal((await t.api('/clients/c-pinger/pong', { method: 'POST', body: { pingId: 'ping-unbekannt' } })).status, 404);
    } finally { await sse.close(); }
  });

  test('Uhr: Verschiebung, ISO-Datum, zurücksetzen — Status nutzt die simulierte Zeit', async () => {
    const sse = await openSse(t.base + '/api/v1/events');
    try {
      const a = await t.api('/admin/clock', { method: 'POST', body: { offsetMs: 25 * 3600e3 } });
      assert.equal(a.body.offsetMs, 25 * 3600e3);
      await sse.waitFor((e) => e.type === 'clock' && e.offsetMs === 25 * 3600e3);
      assert.equal((await t.api('/health')).body.clockOffsetMs, 25 * 3600e3);
      const st = await t.api('/practices/drautal/status', { method: 'POST', body: { value: 'green' } });
      assert.ok(st.body.practice.status.setAt > Date.now() + 24 * 3600e3);
      const target = Date.parse('2031-06-01T08:00:00Z');
      const b = await t.api('/admin/clock', { method: 'POST', body: { iso: '2031-06-01T08:00:00Z' } });
      assert.ok(Math.abs(b.body.now - target) < 2000);
      const c = await t.api('/admin/clock', { method: 'POST', body: { reset: true } });
      assert.equal(c.body.offsetMs, 0);
      assert.equal((await t.api('/admin/clock', { method: 'POST', body: { iso: 'gestern' } })).status, 400);
    } finally { await sse.close(); }
  });

  test('Fehler-Injektion: offline, slow, ai-offline, error500', async () => {
    // offline: offene SSE-Verbindung wird gekappt, Nicht-Admin → 503, Admin geht weiter
    const sse = await openSse(t.base + '/api/v1/events');
    await sse.waitFor((e) => e.type === 'hello');
    const f = await t.api('/admin/fault', { method: 'POST', body: { kind: 'offline', durationMs: 400 } });
    assert.equal(f.body.ok, true);
    await sse.ended;
    const h = await t.api('/health');
    assert.equal(h.status, 503);
    assert.equal(h.body.code, 'offline');
    assert.equal((await t.api('/state')).status, 503);
    assert.equal((await t.api('/admin/overview')).status, 200);
    assert.ok((await t.api('/admin/overview')).body.faults.some((x) => x.kind === 'offline'));
    await new Promise((r) => setTimeout(r, 450));
    assert.equal((await t.api('/health')).status, 200, 'Störung läuft von selbst ab');

    // slow: +2 s
    await t.api('/admin/fault', { method: 'POST', body: { kind: 'slow', durationMs: 5000 } });
    const t0 = Date.now();
    assert.equal((await t.api('/health')).status, 200);
    assert.ok(Date.now() - t0 >= 1900, 'Antwort um ~2 s verzögert');
    await t.api('/admin/fault', { method: 'POST', body: { kind: 'slow', off: true } });
    const t1 = Date.now();
    await t.api('/health');
    assert.ok(Date.now() - t1 < 1000);

    // ai-offline: auch die Test-KI meldet offline
    await t.api('/admin/fault', { method: 'POST', body: { kind: 'ai-offline', durationMs: 5000 } });
    const ai = await t.api('/ai/chat', { method: 'POST', body: { provider: 'mock', messages: [{ role: 'user', content: 'Sag Apfel' }] } });
    assert.equal(ai.status, 503);
    assert.equal(ai.body.code, 'offline');
    const st = await t.api('/ai/status');
    assert.equal(st.body.ok, false);
    assert.ok(st.body.providers.every((p) => !p.ok));
    assert.equal((await t.api('/health')).body.ai.ok, false);
    await t.api('/admin/fault', { method: 'POST', body: { kind: 'ai-offline', off: true } });
    assert.equal((await t.api('/ai/chat', { method: 'POST', body: { provider: 'mock', messages: [{ role: 'user', content: 'Sag Apfel' }] } })).status, 200);

    // error500: Würfel < 0.5 → 500, sonst normal (Zufall im Test steuerbar)
    await t.api('/admin/fault', { method: 'POST', body: { kind: 'error500', durationMs: 5000 } });
    rnd = 0.2;
    const e1 = await t.api('/health');
    assert.equal(e1.status, 500);
    assert.equal(e1.body.code, 'fault-500');
    assert.equal((await t.api('/admin/overview')).status, 200, 'Admin ist ausgenommen');
    rnd = 0.8;
    assert.equal((await t.api('/health')).status, 200);
    rnd = 0.9;
    const cl = await t.api('/admin/fault', { method: 'POST', body: { clear: true } });
    assert.deepEqual(cl.body.active, []);
    assert.equal((await t.api('/admin/fault', { method: 'POST', body: { kind: 'meteor' } })).status, 400);
  });

  test('Selbsttest: alle Checks grün', async () => {
    const r = await t.api('/admin/selftest');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
    const names = r.body.map((c) => c.name);
    for (const n of ['store-write-read', 'persistence', 'seed-integrity', 'state-integrity', 'bot-suite', 'bot-reply', 'mock-ai', 'ai-registry', 'sse-roundtrip', 'files-roundtrip', 'shared-module']) {
      assert.ok(names.includes(n), n);
    }
    for (const c of r.body) {
      assert.equal(c.ok, true, `${c.name}: ${c.detail}`);
      assert.equal(typeof c.ms, 'number');
      assert.equal(typeof c.detail, 'string');
    }
  });

  test('Protokoll: Anfragen (Methode, Pfad, Status, ms, Client) und Ereignisse, since-Filter', async () => {
    await t.api('/health', { headers: { 'x-vn-client': 'c-logger' } });
    const r = await t.api('/admin/log');
    const req = r.body.entries.filter((e) => e.kind === 'req' && e.path === '/health' && e.client === 'c-logger');
    assert.ok(req.length >= 1);
    const e = req[req.length - 1];
    assert.equal(e.method, 'GET');
    assert.equal(e.status, 200);
    assert.equal(typeof e.ms, 'number');
    assert.ok(r.body.entries.some((x) => x.kind === 'event'));
    const later = await t.api('/admin/log?since=' + r.body.seq);
    assert.ok(later.body.entries.every((x) => x.seq > r.body.seq));
  });

  test('Export → Reset (leer) → Import stellt den Zustand wieder her', async () => {
    const exp = (await t.api('/admin/export')).body;
    assert.equal(exp.kind, 'vetnow-hub-export');
    assert.equal(exp.version, '3.0.0');
    const counts = { practices: exp.practices.length, chats: exp.chats.length, appointments: exp.appointments.length };
    const sse = await openSse(t.base + '/api/v1/events');
    try {
      const reset = await t.api('/admin/reset', { method: 'POST', body: { seed: 'empty' } });
      assert.equal(reset.body.mode, 'empty');
      await sse.waitFor((e) => e.type === 'resync');
      const empty = (await t.api('/state')).body;
      assert.equal(empty.mode, 'empty');
      assert.ok(empty.chats.length < counts.chats);
      const imp = await t.api('/admin/import', { method: 'POST', body: exp });
      assert.equal(imp.body.ok, true);
      assert.equal(imp.body.counts.chats, counts.chats);
      const back = (await t.api('/state')).body;
      assert.equal(back.practices.length, counts.practices);
      assert.equal(back.appointments.length, counts.appointments);
      assert.equal((await t.api('/admin/import', { method: 'POST', body: { hallo: 1 } })).status, 400);
      // Fremder Export mit Altlasten (ts als Text, fehlende Nachrichten-ID) wird repariert
      const legacy = { state: { practices: exp.practices, chats: [{ id: 'ch-imp', kind: 'direct', practiceId: 'drautal', messages: [{ from: 'owner', text: 'alt', ts: 'jetzt' }] }] } };
      assert.equal((await t.api('/admin/import', { method: 'POST', body: legacy })).status, 200);
      const im = (await t.api('/state')).body.chats.find((c) => c.id === 'ch-imp').messages[0];
      assert.match(im.id, /^m-/);
      assert.equal(typeof im.ts, 'number');
      assert.ok((await t.api('/admin/selftest')).body.find((c) => c.name === 'state-integrity').ok);
      // Teil-Export (nur Chats) lässt Praxen & Co. unangetastet
      const partial = await t.api('/admin/import', { method: 'POST', body: { chats: exp.chats } });
      assert.equal(partial.status, 200);
      assert.equal(partial.body.counts.practices, counts.practices);
      assert.equal(partial.body.counts.chats, counts.chats);
      // Alter v1-Export (localStorage-Schlüssel) wird über shared/migrate.js übernommen
      const v1 = {
        vn_chats_v1: JSON.stringify([{ id: 'ch-alt-77', role: 'owner', title: 'Tierarztpraxis Drautal', sub: 'Villach · Balu (Hund)', animal: 'dog', isTestData: false, messages: [{ from: 'owner', text: 'Alte Nachricht aus v1', time: '09:15' }] }]),
        vn_hide_testdata: '1',
      };
      const mig = await t.api('/admin/import', { method: 'POST', body: v1 });
      assert.equal(mig.status, 200, JSON.stringify(mig.body));
      assert.equal(mig.body.migratedFrom, 'v1');
      const after = (await t.api('/state')).body;
      const old = after.chats.find((c) => c.messages.some((m) => m.text === 'Alte Nachricht aus v1'));
      assert.ok(old, 'v1-Chat übernommen');
      assert.equal(old.practiceId, 'drautal');
      assert.equal(after.settings.hideTestData, true);
      assert.equal(after.practices.length, counts.practices);
      const demo = await t.api('/admin/reset', { method: 'POST', body: { seed: 'demo' } });
      assert.equal(demo.body.mode, 'demo');
      assert.equal((await t.api('/admin/reset', { method: 'POST', body: { seed: 'xyz' } })).status, 400);
    } finally { await sse.close(); }
  });
});

describe('Persistenz', () => {
  test('Zustand übersteht einen Neustart (gleicher Datenordner), rev bleibt monoton', async () => {
    const dir = tempDir();
    try {
      const a = await startHub({ dataDir: dir });
      await a.api('/admin/settings', { method: 'PUT', body: { botMode: 'off' } });
      const chat = await a.api('/chats', { method: 'POST', body: { id: 'ch-persist', kind: 'direct', practiceId: 'drautal' } });
      assert.equal(chat.status, 201);
      await a.api('/chats/ch-persist/messages', { method: 'POST', body: { from: 'owner', text: 'Bleibe ich erhalten?' } });
      await a.api('/admin/clock', { method: 'POST', body: { offsetMs: 7200e3 } });
      const rev = (await a.api('/health')).body.rev;
      await a.close({ keep: true });
      assert.ok(existsSync(path.join(dir, 'state.json')));
      const saved = JSON.parse(readFileSync(path.join(dir, 'state.json'), 'utf8'));
      assert.equal(saved.schema, 3);

      const b = await startHub({ dataDir: dir });
      try {
        const s = (await b.api('/state')).body;
        const c = s.chats.find((x) => x.id === 'ch-persist');
        assert.ok(c, 'Chat nach Neustart vorhanden');
        assert.equal(c.messages[0].text, 'Bleibe ich erhalten?');
        assert.equal(s.settings.botMode, 'off');
        assert.equal(s.clockOffsetMs, 7200e3);
        assert.ok(s.rev >= rev, 'rev springt nicht zurück');
      } finally { await b.close({ keep: true }); }
    } finally { rmDir(dir); }
  });

  test('Beschädigte state.json wird gesichert, nicht stumm überschrieben', async () => {
    const dir = tempDir();
    try {
      writeFileSync(path.join(dir, 'state.json'), '{ kaputt');
      const h = await startHub({ dataDir: dir });
      await h.close({ keep: true });
      const { readdirSync } = await import('node:fs');
      assert.ok(readdirSync(dir).some((f) => /^state\.corrupt-\d+\.json$/.test(f)), 'kaputte Datei aufgehoben');
    } finally { rmDir(dir); }
  });
});

describe('Web-App unter /vetnow/', () => {
  let t;
  let dist;
  before(async () => {
    dist = tempDir('vnweb-');
    mkdirSync(path.join(dist, 'assets'));
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>VetNow</title><div id="root"></div>');
    writeFileSync(path.join(dist, 'sw.js'), 'self.addEventListener("fetch",()=>{})');
    writeFileSync(path.join(dist, 'manifest.webmanifest'), '{"name":"VetNow"}');
    writeFileSync(path.join(dist, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    writeFileSync(path.join(dist, 'assets', 'index-AbCd1234.js'), 'console.log(1)');
    writeFileSync(path.join(dist, 'assets', 'inter-Xy98Zw76.woff2'), Buffer.from([0x77, 0x4f, 0x46, 0x32]));
    writeFileSync(path.join(path.dirname(dist), 'geheim.txt'), 'GEHEIM');
    t = await startHub({ webDist: dist });
  });
  after(async () => { await t.close(); rmDir(dist); });

  test('"/" → 302 /vetnow/, index.html ohne Cache, SPA-Fallback', async () => {
    const root = await fetch(t.base + '/', { redirect: 'manual' });
    assert.equal(root.status, 302);
    assert.equal(root.headers.get('location'), '/vetnow/');
    const noSlash = await fetch(t.base + '/vetnow', { redirect: 'manual' });
    assert.equal(noSlash.status, 302);
    const idx = await fetch(t.base + '/vetnow/');
    assert.equal(idx.status, 200);
    assert.match(idx.headers.get('content-type'), /text\/html/);
    assert.equal(idx.headers.get('cache-control'), 'no-cache');
    assert.match(await idx.text(), /id="root"/);
    const deep = await fetch(t.base + '/vetnow/praxis/drautal');
    assert.equal(deep.status, 200);
    assert.match(await deep.text(), /id="root"/);
    const missing = await fetch(t.base + '/vetnow/assets/fehlt-12345678.js');
    assert.equal(missing.status, 404, 'fehlende Datei mit Endung → ehrliches 404');
  });

  test('MIME-Typen und Cache-Regeln', async () => {
    const js = await fetch(t.base + '/vetnow/assets/index-AbCd1234.js');
    assert.match(js.headers.get('content-type'), /text\/javascript/);
    assert.match(js.headers.get('cache-control'), /immutable/);
    const sw = await fetch(t.base + '/vetnow/sw.js');
    assert.equal(sw.headers.get('cache-control'), 'no-cache');
    const man = await fetch(t.base + '/vetnow/manifest.webmanifest');
    assert.match(man.headers.get('content-type'), /application\/manifest\+json/);
    const svg = await fetch(t.base + '/vetnow/icon.svg');
    assert.equal(svg.headers.get('content-type'), 'image/svg+xml');
    const font = await fetch(t.base + '/vetnow/assets/inter-Xy98Zw76.woff2');
    assert.equal(font.headers.get('content-type'), 'font/woff2');
    const etag = js.headers.get('etag');
    const again = await fetch(t.base + '/vetnow/assets/index-AbCd1234.js', { headers: { 'if-none-match': etag } });
    assert.equal(again.status, 304);
  });

  test('Pfad-Traversal wird abgewiesen', async () => {
    for (const p of ['/vetnow/..%2Fgeheim.txt', '/vetnow/..%2F..%2Fgeheim.txt', '/vetnow/%2e%2e/geheim.txt', '/vetnow/..\\geheim.txt', '/vetnow/assets/..%5C..%5Cgeheim.txt']) {
      const r = await rawGet(t.base, p);
      assert.ok(!r.body.includes('GEHEIM'), p);
      assert.ok([400, 403, 404, 200].includes(r.status), p);
      if (r.status === 200) assert.match(r.body, /id="root"/, p + ' darf nur die App liefern');
    }
  });

  test('API funktioniert parallel zur Web-App', async () => {
    const r = await t.api('/health');
    assert.equal(r.status, 200);
    await waitUntil(async () => (await t.api('/state')).status === 200);
  });
});
