import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHubClient, resolveHubCandidates, probeHub, probeHubs, findHub, normalizeHubUrl, hostFromHostUri } from '../hubclient.js';
import { startFakeHub, waitFor, TestEventSource } from './_helpers.js';

test('resolveHubCandidates: Reihenfolge und Plattform-Regeln (Vertrag §7)', () => {
  assert.deepEqual(resolveHubCandidates({ platform: 'web', origin: 'http://192.168.68.10:3000', saved: 'http://10.0.0.5:8787/' }), [
    'http://10.0.0.5:8787', 'http://192.168.68.10:3000',
  ]);
  assert.deepEqual(resolveHubCandidates({ platform: 'web', origin: 'https://bastild.github.io' }), [], 'GitHub Pages: kein LAN-Hub (Mixed Content)');
  assert.deepEqual(resolveHubCandidates({ platform: 'web', origin: 'http://localhost:5199' }), ['http://localhost:5199', 'http://localhost:8787']);
  assert.deepEqual(resolveHubCandidates({ platform: 'android', hostUri: '192.168.1.20:8081', envUrl: 'http://hub.local:8787' }), [
    'http://hub.local:8787', 'http://192.168.1.20:8787', 'http://192.168.1.20:3000', 'http://192.168.68.10:3000',
  ]);
  assert.deepEqual(resolveHubCandidates({ platform: 'ios', hostUri: 'exp://10.1.2.3:8081/--/home' }).slice(0, 2), ['http://10.1.2.3:8787', 'http://10.1.2.3:3000']);
  assert.deepEqual(resolveHubCandidates({ platform: 'ios' }), ['http://192.168.68.10:3000'], 'Release-Build ohne hostUri');
  assert.deepEqual(resolveHubCandidates({ platform: 'extension' }), ['http://localhost:8787', 'http://127.0.0.1:8787']);
  assert.deepEqual(resolveHubCandidates({ platform: 'extension', saved: 'http://localhost:8787' }), ['http://localhost:8787', 'http://127.0.0.1:8787'], 'keine Doppelten');
  assert.equal(normalizeHubUrl('192.168.1.5:8787/api/v1/'), 'http://192.168.1.5:8787');
  assert.equal(hostFromHostUri('[fe80::1]:8081'), '[fe80::1]');
});

test('probeHub / findHub: echter Hub, fremder Server, toter Port', async (t) => {
  const hub = await startFakeHub();
  const other = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"hello":"world"}'); });
  await new Promise((r) => other.listen(0, '127.0.0.1', r));
  t.after(async () => { await hub.stop(); await new Promise((r) => other.close(r)); });
  const otherUrl = 'http://127.0.0.1:' + other.address().port;
  const ok = await probeHub(hub.url, 2500);
  assert.equal(ok.ok, true);
  assert.equal(ok.compatible, true);
  assert.equal(ok.info.name, 'VetNow Hub');
  assert.ok(ok.ms >= 0);
  const foreign = await probeHub(otherUrl, 2500);
  assert.equal(foreign.ok, false);
  const found = await findHub(['http://127.0.0.1:9', otherUrl, hub.url], { timeoutMs: 2500 });
  assert.equal(found.url, hub.url, 'erster ERREICHBARER in Prioritätsreihenfolge');
  assert.deepEqual(found.results.map((r) => r.ok), [false, false, true]);
  assert.equal((await probeHubs([hub.url])).length, 1);
});

test('request: JSON, Header, Fehlercodes', async (t) => {
  const hub = await startFakeHub({ practices: [{ id: 'drautal', name: 'Drautal', status: {} }] });
  t.after(() => hub.stop());
  const c = createHubClient({ baseUrl: hub.url, platform: 'test', clientName: 'Testgerät', EventSource: null, adminToken: 'tok' });
  const h = await c.health();
  assert.equal(h.name, 'VetNow Hub');
  assert.ok(c.latencyMs >= 0);
  const s = await c.state();
  assert.equal(s.practices.length, 1);
  assert.equal(c.rev, 0);
  await c.request('GET', '/health', undefined, { admin: true });
  const last = hub.requests.at(-1);
  assert.equal(last.headers['x-vn-client'], c.clientId);
  assert.equal(last.headers['x-vn-admin'], 'tok');
  await assert.rejects(c.request('GET', '/secret'), (e) => e.code === 'unauthorized' && e.status === 401 && /Admin/.test(e.message));
  await assert.rejects(c.request('GET', '/gibtsnicht'), (e) => e.status === 404 && e.code === 'not-found');
  hub.setOffline(true);
  await assert.rejects(c.request('GET', '/health'), (e) => e.status === 503 && e.code === 'offline');
  hub.setOffline(false);
  assert.equal(c.fileUrl('hub:f-1'), hub.url + '/api/v1/files/f-1');
});

test('Long-Poll: resync beim Start, Ereignisse in Reihenfolge, rev wird mitgeführt', async (t) => {
  const hub = await startFakeHub();
  t.after(() => hub.stop());
  const c = createHubClient({ baseUrl: hub.url, platform: 'android', EventSource: null, pollTimeoutMs: 400 });
  const events = [];
  const statuses = [];
  const stop = c.subscribe((ev) => events.push(ev), (s) => statuses.push(s));
  t.after(stop);
  await waitFor(() => events.some((e) => e.type === 'resync'), { label: 'resync' });
  await waitFor(() => statuses.includes('online'), { label: 'online' });
  hub.emit('practice', { practice: { id: 'drautal' } });
  hub.emit('clock', { offsetMs: 5000 });
  await waitFor(() => events.filter((e) => e.type !== 'resync').length >= 2, { label: 'zwei Ereignisse' });
  const real = events.filter((e) => e.type !== 'resync');
  assert.deepEqual(real.map((e) => e.type), ['practice', 'clock']);
  assert.deepEqual(real.map((e) => e.rev), [1, 2]);
  assert.equal(c.rev, 2);
  await waitFor(() => hub.requests.some((r) => r.path === '/changes' && r.query.get('since') === '2'), { label: 'Folgeabfrage mit since=2' });
  const first = hub.requests.find((r) => r.path === '/changes');
  assert.equal(first.query.get('timeout'), '0', 'erste Abfrage antwortet sofort');
  assert.equal(first.query.get('platform'), 'android');
  assert.equal(statuses[0], 'connecting');
});

test('Reconnect: Hub stirbt → offline mit Backoff → Hub startet neu → online, nichts verloren', async (t) => {
  const hub = await startFakeHub();
  const c = createHubClient({ baseUrl: hub.url, platform: 'android', EventSource: null, pollTimeoutMs: 300, backoffMinMs: 50, backoffMaxMs: 200 });
  const events = [];
  const statuses = [];
  const stop = c.subscribe((ev) => events.push(ev), (s, info) => statuses.push([s, info && info.retryInMs]));
  t.after(async () => { stop(); await hub.stop().catch(() => {}); });
  await waitFor(() => statuses.some(([s]) => s === 'online'), { label: 'online' });
  hub.emit('practice', { practice: { id: 'a' } });
  await waitFor(() => events.some((e) => e.type === 'practice'), { label: 'erstes Ereignis' });
  await hub.stop();
  await waitFor(() => statuses.some(([s]) => s === 'offline'), { label: 'offline' });
  const offs = statuses.filter(([s]) => s === 'offline').map(([, ms]) => ms);
  assert.ok(offs[0] >= 50 && offs[0] <= 200, 'Backoff beginnt klein');
  // Ereignis, das während des Ausfalls entsteht (Hub-Zustand bleibt erhalten, rev läuft weiter)
  hub.emit('chat', { chat: { id: 'ch-neu' } });
  await hub.restart();
  await waitFor(() => events.some((e) => e.type === 'chat'), { label: 'verpasstes Ereignis nach Reconnect', timeout: 5000 });
  assert.equal(statuses.at(-1)[0], 'online');
  const revs = events.filter((e) => e.type !== 'resync').map((e) => e.rev);
  assert.deepEqual(revs, [1, 2], 'jedes Ereignis genau einmal, in Reihenfolge');
});

test('SSE: hello + Ereignisse + Nachholen per since', async (t) => {
  const hub = await startFakeHub();
  t.after(() => hub.stop());
  hub.emit('practice', { practice: { id: 'x' } }); // rev 1 vor dem Verbinden
  const c = createHubClient({ baseUrl: hub.url, platform: 'web', EventSource: TestEventSource, rev: 0, backoffMinMs: 50 });
  const events = [];
  const statuses = [];
  const stop = c.subscribe((ev) => events.push(ev), (s) => statuses.push(s));
  t.after(stop);
  await waitFor(() => events.some((e) => e.type === 'hello'), { label: 'hello' });
  await waitFor(() => events.some((e) => e.type === 'practice'), { label: 'nachgeholtes Ereignis (since=0)' });
  hub.emit('typing', { chatId: 'ch-1', from: 'clinic', on: true });
  await waitFor(() => events.some((e) => e.type === 'typing'), { label: 'live-Ereignis' });
  assert.equal(c.rev, 2);
  assert.ok(statuses.includes('online'));
  assert.equal(hub.requests.find((r) => r.path === '/events') !== undefined, true);
  // Verbindung reißt ab → eigener Reconnect mit since=2
  hub.setOffline(true);
  await waitFor(() => statuses.includes('offline'), { label: 'offline' });
  hub.setOffline(false);
  hub.emit('clock', { offsetMs: 1 });
  await waitFor(() => events.some((e) => e.type === 'clock'), { label: 'nach Reconnect', timeout: 5000 });
  assert.equal(events.filter((e) => e.type === 'clock').length, 1);
});
