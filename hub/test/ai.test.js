/* KI im Hub: Test-KI (mock), Ollama (Offline-Fehler, NDJSON, Bild-Modell), Anthropic (ohne Schlüssel,
   Nachrichten-Umbau, Ablehnung, Fehler-Zuordnung mit Fake-Client), OpenAI-kompatibel, Register,
   /api/v1/ai/* und die Legacy-Pfade /api/ai/*. */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHub, closedPort } from './helpers.js';
import { createMockProvider, sayCommand, inferPersona, buildJsonPlan } from '../ai/mock.js';
import { createOllamaProvider } from '../ai/ollama.js';
import { createAnthropicProvider, toAnthropicMessages, mapAnthropicError } from '../ai/anthropic.js';
import { createOpenAiProvider } from '../ai/openai.js';
import { createAiRegistry } from '../ai/registry.js';
import { AiError, toAiError } from '../ai/errors.js';
import { makePng } from '../lib/png.js';
import { botReply, botImageReply, vetSystemPrompt } from '../lib/shared.js';

// Das SDK ist eine OPTIONALE Abhängigkeit — fehlt es, wird nur der Fehlerklassen-Test übersprungen.
const Anthropic = await import('@anthropic-ai/sdk').then((m) => m.default).catch(() => null);
const PNG_B64 = makePng(8, 8).toString('base64');
const JPEG_B64 = '/9j/4AAQSkZJRgABAQAAAQABAAD';

/* Antwort-Attrappe für fetch (Body als Web-Stream aus Textstücken). */
function fakeResponse({ status = 200, json, chunks }) {
  const body = chunks ? new ReadableStream({ start(c) { for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch)); c.close(); } }) : null;
  return {
    ok: status >= 200 && status < 300, status, body,
    json: async () => json,
    text: async () => (json !== undefined ? JSON.stringify(json) : (chunks || []).join('')),
  };
}

/* Fake-Anthropic-Client: zeichnet Parameter auf, liefert Stream-Ereignisse und eine finale Nachricht. */
function fakeAnthropic({ text = 'Hallo aus Claude', stopReason = 'end_turn', throwErr = null, model = 'claude-opus-5' } = {}) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        stream(params, opts) {
          calls.push({ params, opts });
          if (throwErr) {
            return { async* [Symbol.asyncIterator]() { throw throwErr; }, finalMessage: async () => { throw throwErr; } };
          }
          const words = text.split(' ');
          return {
            async* [Symbol.asyncIterator]() {
              yield { type: 'message_start', message: { model } };
              for (let i = 0; i < words.length; i++) {
                yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: (i ? ' ' : '') + words[i] } };
              }
              yield { type: 'message_stop' };
            },
            finalMessage: async () => ({
              model, stop_reason: stopReason,
              stop_details: stopReason === 'refusal' ? { type: 'refusal', category: 'cyber', explanation: 'x' } : null,
              content: stopReason === 'refusal' ? [] : [{ type: 'text', text }],
            }),
          };
        },
      },
    },
  };
}

describe('Test-KI (mock)', () => {
  const mock = createMockProvider({ botReply, botImageReply, wordDelayMs: 0 });

  test('„Sag X"-Befehl erkennt Varianten und ignoriert normale Sätze', () => {
    assert.equal(sayCommand('Sag Apfel'), 'Apfel');
    assert.equal(sayCommand('sage bitte „Hallo Welt"'), 'Hallo Welt');
    assert.equal(sayCommand("Bitte sag 'Birne'."), 'Birne');
    assert.equal(sayCommand('Sag das Wort: Kiwi!'), 'Kiwi');
    assert.equal(sayCommand('Sag mal, wann habt ihr offen?'), null);
    assert.equal(sayCommand('Können Sie mir sagen, wann Sie offen haben?'), null);
  });

  test('Persona aus dem System-Prompt', () => {
    assert.equal(inferPersona(vetSystemPrompt('owner', 'Tierarztpraxis Drautal')), 'owner');
    assert.equal(inferPersona(vetSystemPrompt('clinic', 'Tierarztpraxis Drautal')), 'clinic');
    assert.equal(inferPersona(vetSystemPrompt('colleague', 'Tierarztpraxis Drautal')), 'colleague');
  });

  test('Antwort über den Bot, Streaming Wort für Wort ergibt exakt den Gesamttext', async () => {
    const deltas = [];
    const r = await mock.chat({
      messages: [{ role: 'system', content: vetSystemPrompt('clinic', 'Tierarztpraxis Drautal') }, { role: 'user', content: 'Mein Hund humpelt seit gestern.' }],
      stream: true, onDelta: (d) => deltas.push(d),
    });
    assert.ok(r.text.length > 10);
    assert.equal(r.model, 'test-ki');
    assert.ok(deltas.length > 3);
    assert.equal(deltas.join(''), r.text);
    const again = await mock.chat({ messages: [{ role: 'user', content: 'Mein Hund humpelt seit gestern.' }], persona: 'clinic' });
    assert.equal(again.text, r.text, 'deterministisch');
  });

  test('Bild → „Bild erhalten (Test-KI)", vision:true', async () => {
    const r = await mock.chat({ messages: [{ role: 'user', content: 'Was ist das?', images: [PNG_B64] }] });
    assert.equal(r.vision, true);
    assert.match(r.text, /^Bild erhalten \(Test-KI\): PNG/);
  });

  test('format json → gültiger Plan mit Aktionen aus dem Katalog', async () => {
    const sys = 'Planer.\n- "home": Startseite öffnen\n- "search": Suche öffnen\n- "results": Ergebnisse\n- "filters_emergency": Notfallfilter\n- "detail_best": Beste Praxis';
    const r = await mock.chat({ messages: [{ role: 'system', content: sys }, { role: 'user', content: 'AUFGABE: Spiele einen Notfall durch\n\nFAKTEN: {}' }], format: 'json' });
    const plan = JSON.parse(r.text);
    assert.deepEqual(plan.steps.map((s) => s.act), ['search', 'filters_emergency', 'results', 'detail_best', 'home']);
    assert.ok(plan.steps.every((s) => typeof s.say === 'string' && s.say.length > 5));
    const generic = JSON.parse(buildJsonPlan('', 'Tag simulieren'));
    assert.ok(generic.steps.length >= 3);
  });
});

describe('Ollama', () => {
  test('geschlossener Port → Code offline mit deutscher Meldung', async () => {
    const port = await closedPort();
    const p = createOllamaProvider({ config: () => ({ baseUrl: `http://127.0.0.1:${port}` }) });
    const st = await p.available();
    assert.equal(st.ok, false);
    assert.equal(st.code, 'offline');
    await assert.rejects(p.chat({ messages: [{ role: 'user', content: 'Hallo' }] }), (e) => e instanceof AiError && e.code === 'offline' && /nicht erreichbar/.test(e.message));
  });

  test('NDJSON-Streaming, Optionen, Bild → Bild-Modell', async () => {
    const seen = [];
    const fetchImpl = async (url, init) => {
      seen.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
      return fakeResponse({ chunks: ['{"message":{"content":"Hal"},"done":false}\n{"message":{"con', 'tent":"lo"},"done":false}\n', '{"done":true}\n'] });
    };
    const p = createOllamaProvider({ fetchImpl, config: () => ({ baseUrl: 'http://x', model: 'qwen2.5:7b', visionModel: 'llava' }) });
    const deltas = [];
    const r = await p.chat({ messages: [{ role: 'user', content: 'Hi' }], stream: true, onDelta: (d) => deltas.push(d) });
    assert.equal(r.text, 'Hallo');
    assert.deepEqual(deltas, ['Hal', 'lo']);
    assert.equal(seen[0].url, 'http://x/api/chat');
    assert.equal(seen[0].body.model, 'qwen2.5:7b');
    assert.equal(seen[0].body.options.temperature, 0.4);
    assert.equal(seen[0].body.stream, true);
    const v = await p.chat({ messages: [{ role: 'user', content: 'Bild?', images: ['data:image/png;base64,' + PNG_B64] }] }).catch((e) => e);
    // nicht-streamend liefert die Attrappe dieselben Stücke — hier zählt nur das Modell:
    assert.equal(seen[1].body.model, 'llava');
    assert.deepEqual(seen[1].body.messages[0].images, [PNG_B64], 'Base64 ohne data:-Präfix');
    void v;
  });

  test('Bild ohne Bild-Modell → no-vision; unbekanntes Modell → no-model; Zeitlimit → timeout', async () => {
    const p = createOllamaProvider({ fetchImpl: async () => fakeResponse({ status: 404, json: { error: 'model "gibtsnicht" not found, try pulling it first' } }), config: () => ({ baseUrl: 'http://x', model: 'gibtsnicht' }) });
    await assert.rejects(p.chat({ messages: [{ role: 'user', content: 'x', images: [PNG_B64] }] }), (e) => e.code === 'no-vision');
    await assert.rejects(p.chat({ messages: [{ role: 'user', content: 'x' }] }), (e) => e.code === 'no-model');
    const hang = (url, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const slow = createOllamaProvider({ fetchImpl: hang, config: () => ({ baseUrl: 'http://x', model: 'm', timeoutMs: 50 }) });
    await assert.rejects(slow.chat({ messages: [{ role: 'user', content: 'x' }] }), (e) => e.code === 'timeout');
  });
});

describe('Anthropic', () => {
  test('ohne API-Schlüssel nicht verfügbar; ohne SDK „nicht installiert"', async () => {
    const p = createAnthropicProvider({ env: {} });
    const st = await p.available();
    assert.equal(st.ok, false);
    assert.match(st.reason, /ANTHROPIC_API_KEY/);
    const noSdk = createAnthropicProvider({ env: { ANTHROPIC_API_KEY: 'x' }, loadSdk: () => Promise.reject(new Error("Cannot find package '@anthropic-ai/sdk'")) });
    const st2 = await noSdk.available();
    assert.equal(st2.ok, false);
    assert.match(st2.reason, /nicht installiert/);
    await assert.rejects(noSdk.chat({ messages: [{ role: 'user', content: 'x' }] }), (e) => e.code === 'offline');
  });

  test('Nachrichten-Umbau: System separat, Bild vor Text, Rollen zusammengelegt, kein Prefill', () => {
    const { system, messages } = toAnthropicMessages([
      { role: 'system', content: 'Du bist das Praxisteam.' },
      { role: 'assistant', content: 'Guten Tag!' },
      { role: 'user', content: 'Hallo' },
      { role: 'user', content: 'Schau mal', images: ['data:image/png;base64,' + PNG_B64, JPEG_B64] },
      { role: 'assistant', content: 'Danke.' },
    ], { format: 'json' });
    assert.match(system, /^Du bist das Praxisteam\./);
    assert.match(system, /JSON/);
    assert.equal(messages[0].role, 'user', 'beginnt mit Nutzer-Platzhalter');
    assert.equal(messages[1].role, 'assistant');
    const u = messages[2];
    assert.equal(u.role, 'user');
    assert.deepEqual(u.content.map((b) => b.type), ['text', 'image', 'image', 'text']);
    assert.deepEqual(u.content[1], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG_B64 } });
    assert.equal(u.content[2].source.media_type, 'image/jpeg');
    assert.equal(messages[messages.length - 1].role, 'user', 'endet mit Nutzer-Nachricht (kein Prefill)');
    assert.throws(() => toAnthropicMessages([{ role: 'system', content: 'x' }]), (e) => e.code === 'bad-request');
  });

  test('Streaming mit Fake-Client: richtige Parameter, Deltas, Endtext', async () => {
    const client = fakeAnthropic({ text: 'Bitte kommen Sie morgen um 9 Uhr.' });
    const p = createAnthropicProvider({ env: {}, client });
    assert.equal((await p.available()).ok, true);
    const deltas = [];
    const r = await p.chat({ messages: [{ role: 'system', content: 'Sys' }, { role: 'user', content: 'Termin?', images: [JPEG_B64] }], stream: true, onDelta: (d) => deltas.push(d) });
    assert.equal(r.text, 'Bitte kommen Sie morgen um 9 Uhr.');
    assert.equal(deltas.join(''), r.text);
    assert.equal(r.vision, true);
    assert.equal(r.model, 'claude-opus-5');
    const { params, opts } = client.calls[0];
    assert.equal(params.model, 'claude-opus-5');
    assert.equal(params.max_tokens, 16000);
    assert.equal(params.system, 'Sys');
    assert.deepEqual(params.output_config, { effort: 'low' });
    assert.deepEqual(params.betas, ['server-side-fallback-2026-07-01']);
    assert.equal(params.fallbacks, 'default');
    for (const k of ['temperature', 'top_p', 'thinking']) assert.equal(k in params, false, k + ' darf nicht gesetzt sein');
    assert.equal(params.messages[0].content[0].type, 'image');
    assert.ok(opts && opts.signal, 'Abbruch-Signal wird durchgereicht');
  });

  test('stop_reason refusal → Code refusal', async () => {
    const p = createAnthropicProvider({ env: {}, client: fakeAnthropic({ stopReason: 'refusal' }) });
    await assert.rejects(p.chat({ messages: [{ role: 'user', content: 'x' }] }), (e) => e instanceof AiError && e.code === 'refusal' && e.category === 'cyber' && /abgelehnt/.test(e.message));
  });

  test('SDK-Fehlerklassen → deutsche Meldungen und Codes', { skip: !Anthropic && '@anthropic-ai/sdk nicht installiert' }, async () => {
    const H = new Headers();
    const cases = [
      [new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 'x', H), 'offline', /Schlüssel/],
      [new Anthropic.RateLimitError(429, { error: { message: 'rate' } }, 'x', H), 'offline', /Anfragelimit/],
      [new Anthropic.NotFoundError(404, { error: { message: 'model' } }, 'x', H), 'no-model', /Modell/],
      [new Anthropic.BadRequestError(400, { error: { message: 'bad' } }, 'x', H), 'bad-request', /abgelehnt/],
      [new Anthropic.InternalServerError(500, { error: { message: 'boom' } }, 'x', H), 'model-crash', /interner Fehler/],
      [new Anthropic.APIConnectionError({ message: 'Connection error.' }), 'offline', /nicht erreichbar/],
      [new Anthropic.APIConnectionTimeoutError({ message: 'Request timed out.' }), 'timeout', /Zeitlimit/],
      [new Anthropic.APIError(418, { error: { message: 'teapot' } }, 'x', H), 'model-crash', /Unerwarteter/],
    ];
    for (const [err, code, rx] of cases) {
      const p = createAnthropicProvider({ env: {}, client: fakeAnthropic({ throwErr: err }) });
      await assert.rejects(p.chat({ messages: [{ role: 'user', content: 'x' }] }), (e) => e.code === code && rx.test(e.message), err.constructor.name);
    }
    assert.equal(mapAnthropicError(new Error('???'), Anthropic).code, 'model-crash');
  });
});

describe('OpenAI-kompatibel (lokal)', () => {
  test('ohne VN_OPENAI_URL nicht verfügbar; mit Server: Modelle + SSE-Streaming', async () => {
    const off = createOpenAiProvider({ config: () => ({}) });
    assert.equal((await off.available()).ok, false);
    const fetchImpl = async (url, init) => {
      if (url.endsWith('/models')) return fakeResponse({ json: { data: [{ id: 'qwen2.5-7b-instruct' }] } });
      const body = JSON.parse(init.body);
      assert.equal(body.model, 'qwen2.5-7b-instruct');
      assert.equal(body.messages[0].content[0].type, 'image_url');
      return fakeResponse({ chunks: ['data: {"choices":[{"delta":{"content":"Gu"}}]}\n\n', 'data: {"choices":[{"delta":{"content":"ten Tag"}}]}\n\ndata: [DONE]\n\n'] });
    };
    const p = createOpenAiProvider({ fetchImpl, config: () => ({ baseUrl: 'http://127.0.0.1:1234/v1' }) });
    const st = await p.available();
    assert.equal(st.ok, true);
    assert.deepEqual(st.models, ['qwen2.5-7b-instruct']);
    const deltas = [];
    const r = await p.chat({ messages: [{ role: 'user', content: 'Hallo', images: [PNG_B64] }], stream: true, onDelta: (d) => deltas.push(d) });
    assert.equal(r.text, 'Guten Tag');
    assert.deepEqual(deltas, ['Gu', 'ten Tag']);
    assert.equal(r.vision, true);
  });
});

describe('KI-Register', () => {
  test('auto ohne erreichbare KI → offline; auto nimmt Anthropic, wenn Ollama fehlt', async () => {
    const off = async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED', message: 'ECONNREFUSED' } }); };
    const settings = { ai: { provider: 'auto' } };
    const reg = createAiRegistry({ env: {}, fetchImpl: off, getSettings: () => settings, logger: { warn() {} } });
    await assert.rejects(reg.chat({ messages: [{ role: 'user', content: 'x' }] }), (e) => e.code === 'offline' && /Bot/.test(e.message));
    const withClaude = createAiRegistry({ env: {}, fetchImpl: off, getSettings: () => settings, anthropicClient: fakeAnthropic({ text: 'Claude hier' }), logger: { warn() {} } });
    const r = await withClaude.chat({ messages: [{ role: 'user', content: 'x' }], model: 'qwen2.5:7b' });
    assert.equal(r.provider, 'anthropic');
    assert.equal(r.text, 'Claude hier');
    const st = await withClaude.status();
    assert.equal(st.active.id, 'anthropic');
    assert.equal(st.providers.find((p) => p.id === 'ollama').ok, false);
  });

  test('toAiError ordnet Rohtexte zu', () => {
    assert.equal(toAiError('llama runner process has terminated with exit code -1').code, 'model-crash');
    assert.equal(toAiError('this model does not support images').code, 'no-vision');
    assert.equal(toAiError(new Error('connect ECONNREFUSED')).code, 'offline');
    assert.equal(toAiError('request timed out').code, 'timeout');
  });
});

describe('KI-Endpunkte im Hub', () => {
  let t;
  before(async () => {
    t = await startHub({ anthropicClient: null });
  });
  after(async () => { await t.close(); });

  test('GET /ai/status listet alle Anbieter; Anthropic ohne Schlüssel aus', async () => {
    const r = await t.api('/ai/status');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.providers.map((p) => p.id), ['mock', 'ollama', 'anthropic', 'openai']);
    const a = r.body.providers.find((p) => p.id === 'anthropic');
    assert.equal(a.ok, false);
    assert.match(a.reason, /ANTHROPIC_API_KEY/);
    assert.equal(r.body.provider, 'auto');
    assert.equal(r.body.ok, false, 'auto ohne Ollama/Anthropic → keine KI');
  });

  test('POST /ai/chat mit auto und ohne KI → 503 offline (Clients fallen still auf den Bot zurück)', async () => {
    const r = await t.api('/ai/chat', { method: 'POST', body: { messages: [{ role: 'user', content: 'Hallo' }] } });
    assert.equal(r.status, 503);
    assert.equal(r.body.code, 'offline');
    assert.ok(r.body.error.length > 10);
  });

  test('POST /ai/chat mit Test-KI: normal, mit persona, Stream als SSE', async () => {
    const a = await t.api('/ai/chat', { method: 'POST', body: { provider: 'mock', messages: [{ role: 'user', content: 'Sag Apfel' }] } });
    assert.equal(a.status, 200);
    assert.equal(a.body.text, 'Apfel');
    assert.equal(a.body.provider, 'mock');
    assert.equal(a.body.model, 'test-ki');
    assert.equal(a.body.vision, false);
    assert.equal(typeof a.body.ms, 'number');
    const b = await t.api('/ai/chat', { method: 'POST', body: { provider: 'mock', persona: 'owner', messages: [{ role: 'user', content: 'Wir haben morgen um 10 Uhr einen Termin frei.' }] } });
    assert.equal(b.status, 200);
    assert.ok(b.body.text.length > 3);
    assert.equal((await t.api('/ai/chat')).status, 405, 'nur POST');
    const res = await fetch(t.base + '/api/v1/ai/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'mock', stream: true, messages: [{ role: 'user', content: 'Mein Hund humpelt seit gestern.' }] }) });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /event-stream/);
    const raw = await res.text();
    const frames = raw.split('\n\n').filter(Boolean).map((f) => JSON.parse(f.replace(/^data: /, '')));
    const deltas = frames.filter((f) => typeof f.delta === 'string');
    const done = frames[frames.length - 1];
    assert.ok(deltas.length > 3);
    assert.equal(done.done, true);
    assert.equal(done.provider, 'mock');
    assert.equal(deltas.map((d) => d.delta).join(''), done.text);
    const bad = await t.api('/ai/chat', { method: 'POST', body: { provider: 'mock', messages: 'hallo' } });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, 'bad-request');
  });

  test('Bild per hub:-Verweis wird für die KI aufgelöst', async () => {
    const up = await t.api('/files', { method: 'POST', body: makePng(10, 10), raw: true, headers: { 'content-type': 'image/png' } });
    const r = await t.api('/ai/chat', { method: 'POST', body: { provider: 'mock', messages: [{ role: 'user', content: 'Was ist das?', images: [up.body.ref] }] } });
    assert.equal(r.status, 200);
    assert.equal(r.body.vision, true);
    assert.match(r.body.text, /Bild erhalten \(Test-KI\)/);
  });

  test('POST /ai/test („Sag Apfel") und GET /ai/models', async () => {
    await t.api('/admin/settings', { method: 'PUT', body: { ai: { provider: 'mock' } } });
    const r = await t.api('/ai/test', { method: 'POST', body: {} });
    assert.equal(r.body.ok, true);
    assert.equal(r.body.text, 'Apfel');
    assert.equal(r.body.provider, 'mock');
    assert.equal(typeof r.body.ms, 'number');
    const m = await t.api('/ai/models?provider=mock');
    assert.equal(m.body.provider, 'mock');
    assert.equal(m.body.models[0].name, 'test-ki');
    await t.api('/admin/settings', { method: 'PUT', body: { ai: { provider: 'auto' } } });
    const off = await t.api('/ai/test', { method: 'POST', body: {} });
    assert.equal(off.body.ok, false);
    assert.equal(off.body.code, 'offline');
  });

  test('Ollama gewählt, Server aus (echter geschlossener Port) → 503 offline', async () => {
    const port = await closedPort();
    const k = await startHub({ env: { OLLAMA_URL: `http://127.0.0.1:${port}` }, fetchImpl: globalThis.fetch });
    try {
      await k.api('/admin/settings', { method: 'PUT', body: { ai: { provider: 'ollama' } } });
      const r = await k.api('/ai/chat', { method: 'POST', body: { messages: [{ role: 'user', content: 'Hallo' }] } });
      assert.equal(r.status, 503);
      assert.equal(r.body.code, 'offline');
      assert.match(r.body.error, /Ollama/);
      const st = await k.api('/ai/status?fresh=1');
      const o = st.body.providers.find((p) => p.id === 'ollama');
      assert.equal(o.ok, false);
      assert.equal(o.url, `http://127.0.0.1:${port}`);
    } finally { await k.close(); }
  });

  test('Anthropic über den Hub mit Fake-Client (provider anthropic)', async () => {
    const client = fakeAnthropic({ text: 'Grüß Gott aus Claude' });
    const k = await startHub({ anthropicClient: client });
    try {
      await k.api('/admin/settings', { method: 'PUT', body: { ai: { provider: 'anthropic' } } });
      const r = await k.api('/ai/chat', { method: 'POST', body: { persona: 'clinic', practiceName: 'Tierarztpraxis Drautal', messages: [{ role: 'user', content: 'Hallo' }] } });
      assert.equal(r.status, 200);
      assert.equal(r.body.provider, 'anthropic');
      assert.equal(r.body.text, 'Grüß Gott aus Claude');
      assert.match(client.calls[0].params.system, /Tierarztpraxis/, 'persona erzeugt System-Prompt');
    } finally { await k.close(); }
  });

  test('Legacy /api/ai/status|models|chat im Ollama-Format', async () => {
    const off = await t.api('/api/ai/status');
    assert.equal(off.status, 200);
    assert.equal(off.body.ok, false);
    const offChat = await t.api('/api/ai/chat', { method: 'POST', body: { messages: [{ role: 'user', content: 'Hallo' }] } });
    assert.equal(offChat.status, 502);
    assert.equal(offChat.body.code, 'offline');
    await t.api('/admin/settings', { method: 'PUT', body: { ai: { provider: 'mock' } } });
    try {
      const st = await t.api('/api/ai/status');
      assert.equal(st.body.ok, true);
      assert.equal(st.body.provider, 'mock');
      const m = await t.api('/api/ai/models');
      assert.ok(Array.isArray(m.body.models));
      const r = await t.api('/api/ai/chat', { method: 'POST', body: { model: 'egal', messages: [{ role: 'user', content: 'Sag Apfel' }] } });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.message, { role: 'assistant', content: 'Apfel' });
      assert.equal(r.body.vnModel, 'test-ki');
      assert.equal(r.body.vnVision, false);
      const pre = await fetch(t.base + '/api/ai/chat', { method: 'OPTIONS' });
      assert.equal(pre.status, 204);
      assert.equal(pre.headers.get('access-control-allow-origin'), '*');
      const json = await t.api('/api/ai/chat', { method: 'POST', body: { format: 'json', messages: [{ role: 'system', content: '- "home": Start' }, { role: 'user', content: 'AUFGABE: Tag' }] } });
      assert.ok(Array.isArray(JSON.parse(json.body.message.content).steps));
    } finally {
      await t.api('/admin/settings', { method: 'PUT', body: { ai: { provider: 'auto' } } });
    }
  });
});
