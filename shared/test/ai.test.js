import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { vetSystemPrompt, toAiMessages, createAiClient, dataUrlToBase64, parseSseChunk } from '../ai.js';

/* ---------------- Prompts & Verlauf ---------------- */

test('vetSystemPrompt: drei Personas, Sicherheitsregeln, nur Deutsch', () => {
  const clinic = vetSystemPrompt('clinic', 'Tierarztpraxis Drautal', { petName: 'Balu', animalLabel: 'Hund' });
  assert.match(clinic, /Tierarztpraxis Drautal/);
  assert.match(clinic, /AUSSCHLIESSLICH auf Deutsch/);
  assert.match(clinic, /NIEMALS Medikamente oder Dosierungen/);
  assert.match(clinic, /SOFORT zum Anruf/);
  assert.match(clinic, /Balu \(Hund\)/);
  const owner = vetSystemPrompt('owner', 'Tierarztpraxis Drautal');
  assert.match(owner, /Tierhalter/);
  assert.match(owner, /NICHT die Praxis/);
  const col = vetSystemPrompt('colleague', 'Tiernotdienst Wörthersee 24h');
  assert.match(col, /Kolleg/);
  assert.match(col, /per Du/);
  assert.match(col, /KEINE konkreten Medikamente/);
  assert.match(col, /Tiernotdienst Wörthersee 24h/);
  assert.match(vetSystemPrompt('clinic'), /VetNow Kärnten/);
});

const img = (id, from, ref, text = '') => ({ id, ts: 1, from, type: 'image', text, attachment: { kind: 'image', name: 'f.jpg', mime: 'image/jpeg', size: 3, ref } });

test('toAiMessages: Rollen, gelöschte/Hinweise raus, Notiz/Datei als Text, maxTurns', () => {
  const msgs = [
    { id: '1', from: 'owner', type: 'text', text: 'Hallo' },
    { id: '2', from: 'clinic', type: 'text', text: 'Guten Tag' },
    { id: '3', from: 'owner', type: 'text', text: 'weg', deleted: true },
    { id: '4', from: 'clinic', type: 'text', text: 'KI kaputt', source: 'error' },
    { id: '5', from: 'clinic', type: 'note', text: 'Alles gut' },
    { id: '6', from: 'owner', type: 'file', text: 'bitte ansehen', attachment: { kind: 'file', name: 'Befund.pdf', ref: 'data:application/pdf;base64,AA==' } },
    { id: '7', from: 'system', type: 'text', text: 'intern' },
  ];
  const out = toAiMessages(msgs, 'clinic');
  assert.deepEqual(out, [
    { role: 'user', content: 'Hallo' },
    { role: 'assistant', content: 'Guten Tag' },
    { role: 'assistant', content: '[Abschlussnotiz] Alles gut' },
    { role: 'user', content: '[Datei gesendet: Befund.pdf] bitte ansehen' },
  ]);
  assert.deepEqual(toAiMessages(msgs, 'owner')[0], { role: 'assistant', content: 'Hallo' }, 'Persona owner dreht die Rollen');
  const many = Array.from({ length: 30 }, (_, i) => ({ id: 'x' + i, from: i % 2 ? 'clinic' : 'owner', type: 'text', text: 't' + i }));
  assert.equal(toAiMessages(many, 'clinic').length, 10);
  assert.equal(toAiMessages(many, 'clinic', { maxTurns: 4 })[0].content, 't26');
});

test('toAiMessages: NUR das neueste unbeantwortete Bild der Gegenseite, ohne data:-Präfix', () => {
  const msgs = [
    img('a', 'owner', 'data:image/jpeg;base64,AAAA'),
    { id: 'b', from: 'clinic', type: 'text', text: 'Danke' },
    img('c', 'owner', 'data:image/jpeg;base64,CCCC', 'Pfote'),
    img('d', 'owner', 'data:image/jpeg;base64,DDDD'),
  ];
  const out = toAiMessages(msgs, 'clinic');
  assert.deepEqual(out.map((m) => m.images || null), [null, null, null, ['DDDD']]);
  assert.equal(out[0].content, '[Bild gesendet]');
  assert.equal(out[2].content, 'Pfote');
  assert.equal(out[3].content, 'Bitte sieh dir dieses Bild an.');
  // Schon beantwortet → kein Bild mehr (sonst ginge jede Folgefrage ans langsame Bild-Modell).
  const answered = msgs.concat([{ id: 'e', from: 'clinic', type: 'text', text: 'Sieht gut aus' }, { id: 'f', from: 'owner', type: 'text', text: 'Danke' }]);
  assert.ok(toAiMessages(answered, 'clinic').every((m) => !m.images));
  assert.deepEqual(toAiMessages(answered, 'clinic', { imageScope: 'window' }).find((m) => m.images).images, ['DDDD']);
  // Eigenes Bild (Assistent) wird nie mitgeschickt
  assert.ok(toAiMessages([img('z', 'clinic', 'data:image/jpeg;base64,ZZZZ')], 'clinic').every((m) => !m.images));
});

test('toAiMessages: resolveImage für idb:/file://, hub:-Refs bleiben für den Hub', () => {
  const out = toAiMessages([img('a', 'owner', 'idb:42')], 'clinic', { resolveImage: (ref) => (ref === 'idb:42' ? 'data:image/jpeg;base64,IDB' : '') });
  assert.deepEqual(out[0].images, ['IDB']);
  assert.ok(!toAiMessages([img('a', 'owner', 'file:///x.jpg')], 'clinic')[0].images, 'ohne Resolver kein Bild');
  assert.deepEqual(toAiMessages([img('a', 'owner', 'hub:f-1')], 'clinic')[0].images, ['hub:f-1']);
  // colleague: antwortende Seite = Gegenseite der letzten Nachricht
  const net = toAiMessages([{ id: '1', from: 'clinic', type: 'text', text: 'Servus' }], 'colleague');
  assert.equal(net[0].role, 'user');
  assert.equal(toAiMessages([{ id: '1', from: 'owner', type: 'text', text: 'Servus' }], 'colleague')[0].role, 'user');
  assert.equal(dataUrlToBase64('data:image/png;base64,QQ=='), 'QQ==');
  assert.equal(dataUrlToBase64('file:///x'), '');
});

test('parseSseChunk: vollständige Blöcke + Rest', () => {
  const r = parseSseChunk('data: {"delta":"a"}\n\ndata: {"delta":"b"}\n\ndata: {"del');
  assert.deepEqual(r.events, [{ delta: 'a' }, { delta: 'b' }]);
  assert.equal(r.rest, 'data: {"del');
});

/* ---------------- Client gegen einen echten kleinen HTTP-Server ---------------- */

function readJson(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => { s += c; });
    req.on('end', () => { try { resolve(JSON.parse(s || 'null')); } catch { resolve(null); } });
  });
}

async function startAiServer() {
  const log = [];
  const server = http.createServer(async (req, res) => {
    const body = req.method === 'POST' ? await readJson(req) : null;
    log.push({ url: req.url, body });
    const json = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    const last = body && Array.isArray(body.messages) ? body.messages[body.messages.length - 1] : null;
    const cmd = last ? last.content : '';
    const hasImg = !!(body && body.messages && body.messages.some((m) => m.images && m.images.length));
    if (req.url === '/api/v1/ai/status') return json(200, { ok: true, provider: 'ollama', providers: { ollama: { ok: true } } });
    if (req.url.startsWith('/api/v1/ai/models')) return json(200, { models: [{ name: 'qwen2.5:7b', provider: new URL(req.url, 'http://x').searchParams.get('provider') }] });
    if (req.url === '/api/v1/ai/test') return json(200, { ok: true, text: 'Apfel', provider: 'mock', model: 'mock-1', ms: 2 });
    if (req.url === '/api/v1/ai/chat') {
      if (cmd === 'crash') return json(502, { error: 'Das Modell ist abgestürzt.', code: 'model-crash' });
      if (cmd === 'novision') return json(400, { error: 'Kein Bild-Modell.', code: 'no-vision-model' });
      if (cmd === 'offline') return json(503, { error: 'Keine KI.', code: 'offline' });
      if (cmd === 'refusal') return json(422, { error: 'Abgelehnt.', code: 'refusal' });
      if (cmd === 'big') return json(413, {});
      if (cmd === 'empty') return json(200, { text: '   ' });
      if (cmd === 'slow') { await new Promise((r) => setTimeout(r, 400)); return json(200, { text: 'spät' }); }
      if (body.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        if (cmd === 'streamfail') {
          res.write('data: {"delta":"Hal"}\n\n');
          res.end('data: {"error":"Abbruch im Modell","code":"model-crash"}\n\n');
          return undefined;
        }
        for (const d of ['Hal', 'lo ', 'Welt']) {
          res.write('data: ' + JSON.stringify({ delta: d }) + '\n\n');
          await new Promise((r) => setTimeout(r, 15));
        }
        res.end('data: ' + JSON.stringify({ done: true, text: 'Hallo Welt', provider: 'mock', model: 'mock-1', ms: 45 }) + '\n\n');
        return undefined;
      }
      return json(200, { text: 'Antwort auf: ' + cmd, provider: 'ollama', model: body.model || 'qwen2.5:7b', vision: hasImg, ms: 7 });
    }
    // Legacy-Studio (Ollama-Format)
    if (req.url === '/api/ai/status') return json(200, { ok: true, ollama: 'Ollama 0.5.0', defaultModel: 'qwen2.5:3b' });
    if (req.url === '/api/ai/models') return json(200, { models: [{ name: 'qwen2.5:3b' }] });
    if (req.url === '/api/ai/chat') {
      if (cmd === 'crash') return json(502, { error: 'Absturz', code: 'model-crash' });
      if (cmd === 'offline') return json(502, { error: 'Ollama ist nicht erreichbar.', code: 'offline' });
      return json(200, { message: { role: 'assistant', content: /apfel/i.test(cmd) ? 'Apfel' : 'Legacy: ' + cmd }, vnModel: 'qwen2.5:3b', vnVision: hasImg });
    }
    return json(404, { error: 'nicht gefunden' });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: 'http://127.0.0.1:' + server.address().port, log, close: () => new Promise((r) => server.close(r)) };
}

test('Hub-Client: status, models, chat, test', async (t) => {
  const srv = await startAiServer();
  t.after(() => srv.close());
  const ai = createAiClient({ baseUrl: srv.url, clientId: 'c-test' });
  assert.equal(ai.baseUrl, srv.url + '/api/v1/ai');
  assert.equal((await ai.status()).ok, true);
  assert.deepEqual((await ai.models('ollama'))[0], { name: 'qwen2.5:7b', provider: 'ollama' });
  const r = await ai.chat({ messages: [{ role: 'system', content: 'x' }, { role: 'user', content: 'Hallo' }], persona: 'clinic', model: 'qwen2.5:7b' });
  assert.equal(r.text, 'Antwort auf: Hallo');
  assert.equal(r.provider, 'ollama');
  assert.equal(r.vision, false);
  const sent = srv.log.find((l) => l.url === '/api/v1/ai/chat').body;
  assert.equal(sent.persona, 'clinic');
  assert.equal(sent.model, 'qwen2.5:7b');
  assert.equal(sent.stream, undefined);
  const v = await ai.chat({ messages: [{ role: 'user', content: 'Bild', images: ['AAAA'] }] });
  assert.equal(v.vision, true);
  const tr = await ai.test();
  assert.equal(tr.ok, true);
  assert.equal(tr.text, 'Apfel');
  // Basis mit /api/v1 am Ende wird nicht verdoppelt
  assert.equal(createAiClient({ baseUrl: srv.url + '/api/v1/' }).baseUrl, srv.url + '/api/v1/ai');
});

test('Hub-Client: Streaming über SSE mit onDelta', async (t) => {
  const srv = await startAiServer();
  t.after(() => srv.close());
  const ai = createAiClient({ baseUrl: srv.url });
  const deltas = [];
  const r = await ai.chat({ messages: [{ role: 'user', content: 'stream bitte' }], stream: true, onDelta: (d, full) => deltas.push([d, full]) });
  assert.equal(r.text, 'Hallo Welt');
  assert.equal(r.provider, 'mock');
  assert.deepEqual(deltas.map((d) => d[0]), ['Hal', 'lo ', 'Welt']);
  assert.equal(deltas[2][1], 'Hallo Welt');
  assert.equal(srv.log.at(-1).body.stream, true);
  await assert.rejects(ai.chat({ messages: [{ role: 'user', content: 'streamfail' }], stream: true }), (e) => e.code === 'model-crash' && e.visible === true);
});

test('Fehlercodes: sichtbar vs. still', async (t) => {
  const srv = await startAiServer();
  t.after(() => srv.close());
  const ai = createAiClient({ baseUrl: srv.url, timeoutMs: 150 });
  const call = (content, extra = {}) => ai.chat({ messages: [{ role: 'user', content, ...extra }] });
  await assert.rejects(call('crash'), (e) => e.code === 'model-crash' && e.visible === true && e.message === 'Das Modell ist abgestürzt.');
  await assert.rejects(call('novision'), (e) => e.code === 'no-vision' && e.visible === true);
  await assert.rejects(call('offline'), (e) => e.code === 'offline' && e.visible === false);
  await assert.rejects(call('refusal'), (e) => e.code === 'refusal' && e.visible === true);
  await assert.rejects(call('big', { images: ['AAAA'] }), (e) => e.code === 'bad-request' && /Bild war zu groß/.test(e.message));
  await assert.rejects(call('empty'), (e) => e.code === 'model-crash');
  await assert.rejects(call('slow'), (e) => e.code === 'timeout' && e.visible === false);
  const ctrl = new AbortController();
  const p = ai.chat({ messages: [{ role: 'user', content: 'slow' }], signal: ctrl.signal });
  setTimeout(() => ctrl.abort(), 20);
  await assert.rejects(p, (e) => e.name === 'AbortError');
  // Niemand hört zu → offline (still)
  const dead = createAiClient({ baseUrl: 'http://127.0.0.1:9' });
  await assert.rejects(dead.chat({ messages: [{ role: 'user', content: 'x' }] }), (e) => e.code === 'offline' && e.visible === false);
  assert.equal((await dead.status()).ok, false);
  assert.deepEqual(await dead.models(), []);
  assert.equal((await dead.test()).ok, false);
});

test('Legacy-Client (altes Studio): Ollama-Format, hub:-Bilder werden entfernt', async (t) => {
  const srv = await startAiServer();
  t.after(() => srv.close());
  const ai = createAiClient({ baseUrl: srv.url, legacy: true });
  assert.equal(ai.baseUrl, srv.url + '/api/ai');
  assert.equal(createAiClient({ baseUrl: srv.url + '/api/ai/', legacy: true }).baseUrl, srv.url + '/api/ai');
  assert.equal((await ai.status()).ok, true);
  assert.equal((await ai.models())[0].name, 'qwen2.5:3b');
  const r = await ai.chat({ messages: [{ role: 'user', content: 'Hi', images: ['hub:f-9', 'BBBB'] }], stream: true, format: 'json', provider: 'egal' });
  assert.equal(r.text, 'Legacy: Hi');
  assert.equal(r.model, 'qwen2.5:3b');
  assert.equal(r.vision, true);
  const body = srv.log.at(-1).body;
  assert.deepEqual(body.messages[0].images, ['BBBB']);
  assert.equal(body.format, 'json');
  assert.equal(body.stream, undefined, 'altes Studio kennt kein Streaming');
  const t2 = await ai.test();
  assert.equal(t2.ok, true);
  assert.equal(t2.text, 'Apfel');
  await assert.rejects(ai.chat({ messages: [{ role: 'user', content: 'offline' }] }), (e) => e.code === 'offline' && !e.visible);
  await assert.rejects(ai.chat({ messages: [{ role: 'user', content: 'crash' }] }), (e) => e.code === 'model-crash' && e.visible);
});
