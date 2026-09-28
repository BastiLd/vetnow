/* VetNow Hub — alle Endpunkte unter /api/v1 (Vertrag §6) und die Legacy-KI unter /api/ai.

   Die Routen sind absichtlich dünn: Sie lesen die Anfrage, rufen ops.js (Zustand), das KI-Register
   oder den Simulator auf und geben JSON zurück. Prüfungen und Ereignisse stecken in ops.js.

   Handler bekommen `c` = { req, res, params, query, clientId, address, json(), raw() } und geben
   entweder ein Objekt zurück (→ 200 JSON), `reply(status, body)` oder nichts (Antwort selbst gesendet). */
import { HttpError, badRequest, notFound, sendError, FILE_LIMIT } from './http.js';
import { isId, isPlainObject } from './util.js';
import { chatMeta } from './store.js';
import { FAULT_KINDS } from './faults.js';
import { AiError, toAiError } from '../ai/errors.js';
import { APP_VERSION, PROTOCOL, DATA_SCHEMA, botReply, runBotSuite, uid, effectiveStatus, SHARED_FALLBACKS } from './shared.js';

export class Reply {
  constructor(status, body, headers = {}) { this.status = status; this.body = body; this.headers = headers; }
}
export const reply = (status, body, headers) => new Reply(status, body, headers);

const PERSONAS = ['clinic', 'owner', 'colleague'];
const BROADCAST_KINDS = ['toast', 'notify', 'reload', 'navigate'];
const LEVELS = ['info', 'success', 'warn', 'error'];

export function registerRoutes(router, hub) {
  const { store, ops, realtime, ai, files, faults, log, adminAuth, simulator, selftest, startedAt } = hub;
  const S = () => store.state;

  /* ================================================================ Basis */
  router.get('/health', () => ({
    ok: true,
    name: 'VetNow Hub',
    version: APP_VERSION,
    protocol: PROTOCOL,
    schema: DATA_SCHEMA,
    serverTime: Date.now(),
    clockOffsetMs: S().clockOffsetMs || 0,
    rev: store.rev,
    uptimeS: Math.round((Date.now() - startedAt) / 1000),
    mode: S().mode,
    ai: (({ provider, ok, model }) => ({ provider, ok, model }))(ai.cachedStatus()),
    clients: realtime.count(),
  }));

  router.get('/state', () => ({
    rev: store.rev,
    serverTime: Date.now(),
    clockOffsetMs: S().clockOffsetMs || 0,
    mode: S().mode,
    practices: S().practices,
    chats: S().chats,
    labels: S().labels,
    appointments: S().appointments,
    blocks: S().blocks,
    settings: S().settings,
  }));

  router.get('/events', (c) => {
    realtime.openSse(c.req, c.res, c.query, { address: c.address });
    c.logNow(200); // SSE bleibt offen — sofort protokollieren statt erst beim Trennen
  });

  router.get('/changes', async (c) => {
    await realtime.longPoll(c.req, c.res, c.query, { address: c.address });
  });

  router.get('/clients', () => realtime.list());

  router.post('/clients/:id/pong', async (c) => {
    if (!isId(c.params.id)) throw badRequest('Ungültige Geräte-ID.', 'bad-id');
    const body = await c.json();
    const ping = hub.pings.get(String(body && body.pingId || ''));
    if (!ping) throw notFound('Unbekannter oder abgelaufener Ping.', 'unknown-ping');
    const latencyMs = Math.max(0, Date.now() - ping.sentAt);
    const entry = realtime.touch(c.params.id, { address: c.address });
    if (entry) { entry.latencyMs = latencyMs; entry.lastPongAt = Date.now(); }
    ping.results[c.params.id] = latencyMs;
    return { ok: true, pingId: ping.pingId, latencyMs };
  });

  /* ================================================================ Praxen */
  router.patch('/practices/:id', async (c) => ({ practice: ops.updatePractice(c.params.id, await c.json()) }));
  router.post('/practices/:id/status', async (c) => ({ practice: ops.setStatus(c.params.id, await c.json()) }));
  router.post('/practices/:id/absence', async (c) => ({ practice: ops.setAbsence(c.params.id, await c.json()) }));

  /* ================================================================ Chats & Nachrichten */
  router.post('/chats', async (c) => {
    const { chat, created } = ops.createChat(await c.json());
    return reply(created ? 201 : 200, { chat, created });
  });
  router.patch('/chats/:id', async (c) => ({ chat: chatMeta(ops.updateChat(c.params.id, await c.json())) }));
  router.delete('/chats/:id', (c) => ({ ok: true, ...ops.deleteChat(c.params.id) }));

  router.post('/chats/:id/messages', async (c) => {
    const { message, duplicate } = ops.addMessage(c.params.id, await c.json());
    return reply(duplicate ? 200 : 201, { message, duplicate });
  });
  router.patch('/chats/:id/messages/:mid', async (c) => ({ message: ops.updateMessage(c.params.id, c.params.mid, await c.json()) }));
  router.post('/chats/:id/read', async (c) => {
    const b = await c.json();
    ops.markRead(c.params.id, b && b.side);
    return { ok: true, chatId: c.params.id, side: b.side };
  });
  router.post('/chats/:id/typing', async (c) => {
    const b = await c.json();
    ops.typing(c.params.id, b && b.from, b && b.on);
    return { ok: true };
  });

  router.post('/requests', async (c) => {
    const { chat, created } = ops.createRequest(await c.json());
    return reply(created ? 201 : 200, { chat, created });
  });

  /* ================================================================ Labels */
  router.post('/labels', async (c) => {
    const { label, created } = ops.createLabel(await c.json());
    return reply(created ? 201 : 200, { label, created });
  });
  router.patch('/labels/:id', async (c) => ({ label: ops.updateLabel(c.params.id, await c.json()) }));
  router.delete('/labels/:id', (c) => ({ ok: true, ...ops.deleteLabel(c.params.id) }));

  /* ================================================================ Termine & Blockzeiten */
  router.get('/appointments', (c) => {
    const { practiceId, from, to } = c.query;
    return { appointments: ops.listAppointments({ practiceId, from, to }) };
  });
  router.post('/appointments', async (c) => {
    const { appointment, created } = ops.createAppointment(await c.json());
    return reply(created ? 201 : 200, { appointment, created });
  });
  router.patch('/appointments/:id', async (c) => ops.updateAppointment(c.params.id, await c.json()));
  router.delete('/appointments/:id', (c) => ({ ok: true, ...ops.deleteAppointment(c.params.id) }));
  router.post('/blocks', async (c) => reply(201, { block: ops.createBlock(await c.json()) }));

  /* ================================================================ Anhänge */
  router.post('/files', async (c) => {
    const buf = await c.raw(FILE_LIMIT);
    if (!buf.length) throw badRequest('Leere Datei.', 'empty');
    const meta = await files.save(buf, { mime: c.req.headers['content-type'], name: c.req.headers['x-filename'] });
    return reply(201, { id: meta.id, ref: 'hub:' + meta.id, url: '/api/v1/files/' + meta.id, size: meta.size, mime: meta.mime, name: meta.name });
  });
  router.get('/files/:id', async (c) => { await files.stream(c.params.id, c.req, c.res); });

  /* ================================================================ Bot */
  router.post('/bot/reply', async (c) => {
    const b = await c.json();
    const text = b && typeof b.text === 'string' ? b.text : (b && typeof b.userText === 'string' ? b.userText : '');
    if (!text.trim()) throw badRequest('„text" fehlt.', 'bad-text');
    if (text.length > 5000) throw new HttpError(413, 'Text zu lang (max. 5000 Zeichen).', 'too-long');
    const persona = PERSONAS.includes(b.persona) ? b.persona : 'clinic';
    const practice = isId(b.practiceId) ? store.practice(b.practiceId) : null;
    const practiceName = typeof b.practiceName === 'string' ? b.practiceName.slice(0, 120) : (practice ? practice.name : '');
    const messages = Array.isArray(b.messages) ? b.messages.slice(-30).filter(isPlainObject) : [];
    return botReply({ messages, userText: text, persona, practiceName, practice: practice || undefined, now: store.now() });
  });
  const suite = () => runBotSuite();
  router.post('/bot/suite', suite);
  router.get('/bot/suite', suite);

  /* ================================================================ KI */
  router.get('/ai/status', (c) => ai.status({ fresh: c.query.fresh === '1' || c.query.fresh === 'true' }));
  router.get('/ai/models', async (c) => {
    try {
      return await ai.models(c.query.provider || undefined);
    } catch (e) {
      const err = toAiError(e, 'offline');
      throw new HttpError(err.status, err.message, err.code, { models: [] });
    }
  });
  router.post('/ai/chat', async (c) => aiChat(c, await c.json(), 'v1'));
  router.post('/ai/test', async (c) => {
    const b = await c.json();
    return ai.test({ provider: b && b.provider, model: b && b.model });
  });

  /* ================================================================ Admin */
  router.post('/admin/login', async (c) => {
    const b = await c.json();
    return adminAuth.login(b && b.password, c.req);
  }, { public: true });

  router.get('/admin/overview', async (c) => ({
    name: 'VetNow Hub',
    version: APP_VERSION,
    protocol: PROTOCOL,
    schema: DATA_SCHEMA,
    startedAt,
    uptimeS: Math.round((Date.now() - startedAt) / 1000),
    serverTime: Date.now(),
    clockOffsetMs: S().clockOffsetMs || 0,
    rev: store.rev,
    mode: S().mode,
    counts: ops.counts(),
    // Ampel so, wie die Clients sie gerade sehen (effektiver Status mit Hub-Uhr inkl. Zeitverschiebung).
    statusCounts: S().practices.reduce((acc, p) => { const k = effectiveStatus(p, store.now()); acc[k] = (acc[k] || 0) + 1; return acc; }, { green: 0, yellow: 0, grey: 0, red: 0 }),
    clients: realtime.list(),
    connections: { sse: realtime.sseCount, waiting: realtime.waitingCount },
    ai: await ai.status(),
    faults: faults.list(),
    pings: [...hub.pings.values()].slice(-10).reverse(),
    autoReply: hub.replier.stats(),
    log: log.last(40),
    storage: { dataDir: hub.dataDir, loadedFrom: store.loadedFrom, lastSaveError: store.lastSaveError ? store.lastSaveError.message : null },
    shared: { fallbacks: SHARED_FALLBACKS },
    web: { served: !!hub.webDist, dir: hub.webDist || null },
    auth: c.adminVia,
  }));

  router.post('/admin/reset', async (c) => {
    const b = await c.json();
    const r = ops.reset((b && b.seed) || 'demo');
    log.info(`Zustand zurückgesetzt (${r.mode}).`);
    return r;
  });

  router.post('/admin/simulate', async (c) => {
    const b = await c.json();
    if (!isPlainObject(b) || typeof b.action !== 'string') throw badRequest('„action" fehlt.', 'bad-action');
    const { action, ...params } = b;
    const r = await simulator.run(action, params);
    log.info(`Simulation: ${action}`);
    return r;
  });

  router.post('/admin/broadcast', async (c) => {
    const b = await c.json();
    if (!isPlainObject(b) || !BROADCAST_KINDS.includes(b.kind)) throw badRequest('„kind" muss toast, notify, reload oder navigate sein.', 'bad-kind');
    const target = b.target === undefined || b.target === '' ? 'all' : b.target;
    if (target !== 'all' && !isId(target)) throw badRequest('„target" muss "all" oder eine Geräte-ID sein.', 'bad-target');
    if ((b.kind === 'toast' || b.kind === 'notify') && !(typeof b.text === 'string' && b.text.trim())) throw badRequest('„text" fehlt.', 'bad-text');
    if (b.kind === 'navigate' && !(typeof b.route === 'string' && /^[#/]/.test(b.route))) throw badRequest('„route" muss mit # oder / beginnen (z. B. "#/chats").', 'bad-route');
    const ev = store.emit('broadcast', {
      kind: b.kind, target,
      ...(b.text ? { text: String(b.text).slice(0, 500) } : {}),
      ...(b.route ? { route: String(b.route).slice(0, 200) } : {}),
      level: LEVELS.includes(b.level) ? b.level : 'info',
    }, { persist: false });
    return { ok: true, rev: ev.rev, target };
  });

  router.post('/admin/ping', async (c) => {
    const b = await c.json();
    const target = !b || b.target === undefined || b.target === '' ? 'all' : b.target;
    if (target !== 'all' && !isId(target)) throw badRequest('„target" muss "all" oder eine Geräte-ID sein.', 'bad-target');
    const ping = { pingId: uid('ping'), target, sentAt: Date.now(), results: {} };
    hub.pings.set(ping.pingId, ping);
    while (hub.pings.size > 50) hub.pings.delete(hub.pings.keys().next().value);
    store.emit('ping', { pingId: ping.pingId, target, sentAt: ping.sentAt }, { persist: false });
    return { ok: true, pingId: ping.pingId, target, sentAt: ping.sentAt };
  });

  router.get('/admin/settings', () => ({ settings: S().settings }));
  router.put('/admin/settings', async (c) => {
    const b = await c.json();
    const patch = isPlainObject(b) && isPlainObject(b.settings) ? b.settings : b;
    const settings = ops.updateSettings(patch);
    ai.invalidate(); // Anbieter/Modell evtl. geändert → Status neu prüfen
    return { settings };
  });

  router.post('/admin/clock', async (c) => ops.setClock(await c.json()));

  router.post('/admin/fault', async (c) => {
    const b = await c.json();
    if (isPlainObject(b) && b.clear === true && !b.kind) { faults.clear(); log.warn('Fehler-Injektion: alle Störungen beendet.'); return { ok: true, active: faults.list() }; }
    if (!isPlainObject(b) || !FAULT_KINDS.includes(b.kind)) throw badRequest(`„kind" muss ${FAULT_KINDS.join(', ')} sein.`, 'bad-kind');
    if (b.off === true || b.clear === true) {
      faults.clear(b.kind);
      log.warn(`Fehler-Injektion beendet: ${b.kind}`);
      return { ok: true, active: faults.list() };
    }
    const until = faults.set(b.kind, b.durationMs);
    log.warn(`Fehler-Injektion aktiv: ${b.kind} bis ${new Date(until).toISOString()}`);
    // Offline: offene Verbindungen kappen, damit die Geräte den Ausfall sofort bemerken.
    if (b.kind === 'offline') realtime.dropAll({ offline: true });
    if (b.kind === 'ai-offline') ai.invalidate();
    return { ok: true, kind: b.kind, until, active: faults.list() };
  });

  router.get('/admin/selftest', () => selftest.run());

  router.get('/admin/log', (c) => {
    const since = Number(c.query.since) || 0;
    const limit = Math.min(1000, Math.max(1, Number(c.query.limit) || 500));
    return { seq: log.seq, entries: log.since(since, limit) };
  });

  router.get('/admin/export', () => ({
    kind: 'vetnow-hub-export',
    app: 'VetNow Hub',
    version: APP_VERSION,
    protocol: PROTOCOL,
    schema: DATA_SCHEMA,
    exportedAt: Date.now(),
    rev: store.rev,
    mode: S().mode,
    clockOffsetMs: S().clockOffsetMs || 0,
    practices: S().practices,
    chats: S().chats,
    labels: S().labels,
    appointments: S().appointments,
    blocks: S().blocks,
    settings: S().settings,
  }));

  router.post('/admin/import', async (c) => {
    const r = ops.importState(await c.json());
    log.info(`Zustand importiert (${r.counts.chats} Chats).`);
    return r;
  });

  /* ================================================================ KI-Chat (v1 + Legacy) */

  /* flavor 'v1'     → { text, provider, model, vision, ms } bzw. SSE data:{delta} … data:{done:true,…}
     flavor 'legacy' → Ollama-Form { message:{role, content}, vnModel, vnVision } (alte Apps/Studio-Proxy) */
  async function aiChat(c, b, flavor) {
    if (!isPlainObject(b)) throw badRequest('Anfrage-Body fehlt.');
    const ctrl = new AbortController();
    // Browser weg → laufende KI-Anfrage abbrechen (früher lief sie ins Leere weiter).
    c.res.on('close', () => { if (!c.res.writableEnded) ctrl.abort(new Error('client-closed')); });
    const opts = {
      messages: b.messages, persona: PERSONAS.includes(b.persona) ? b.persona : undefined,
      practiceName: typeof b.practiceName === 'string' ? b.practiceName : undefined,
      model: typeof b.model === 'string' ? b.model : undefined,
      provider: typeof b.provider === 'string' ? b.provider : undefined,
      format: b.format === 'json' ? 'json' : undefined,
      signal: ctrl.signal,
    };
    if (flavor === 'v1' && b.stream === true) return aiStream(c, opts, ctrl);
    try {
      const r = await ai.chat(opts);
      if (flavor === 'legacy') {
        return { model: r.model, message: { role: 'assistant', content: r.text }, done: true, vnModel: r.model, vnVision: r.vision, vnProvider: r.provider };
      }
      return r;
    } catch (e) {
      if (e && e.name === 'AbortError') return undefined; // Client ist weg — niemand liest die Antwort
      const err = e instanceof AiError ? e : toAiError(e);
      if (flavor === 'legacy') {
        // Alte Clients: 400 = Konfiguration (sichtbarer Hinweis), 502 + code = KI-Problem (offline → still Bot).
        const status = ['no-model', 'no-vision', 'bad-request'].includes(err.code) ? 400 : 502;
        throw new HttpError(status, err.message, err.code, { model: opts.model || '', usedVision: false, provider: err.provider || null });
      }
      throw new HttpError(err.status, err.message, err.code, { provider: err.provider || null });
    }
  }

  /* Streaming: Kopfzeilen erst beim ersten Stück senden — scheitert die KI vorher (z. B. offline),
     bekommt der Client eine normale Fehlerantwort (503 JSON) statt eines leeren Streams. */
  async function aiStream(c, opts, ctrl) {
    const { res } = c;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
    };
    const send = (obj) => { start(); if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`); };
    try {
      const r = await ai.chat({ ...opts, stream: true, onDelta: (delta) => send({ delta }) });
      send({ done: true, text: r.text, provider: r.provider, model: r.model, vision: r.vision, ms: r.ms });
    } catch (e) {
      if (e && e.name === 'AbortError') { if (!res.writableEnded) res.end(); return; }
      const err = e instanceof AiError ? e : toAiError(e);
      if (!started) {
        sendError(res, new HttpError(err.status, err.message, err.code, { provider: err.provider || null }));
        return;
      }
      send({ done: true, error: err.message, code: err.code, provider: err.provider || null });
    }
    if (!res.writableEnded) res.end();
    void ctrl;
  }

  /* ================================================================ Legacy /api/ai/* */
  const legacy = {
    async status() {
      const st = await ai.status();
      const active = st.active ? st.providers.find((p) => p.id === st.active.id) : null;
      const ollama = st.providers.find((p) => p.id === 'ollama') || {};
      if (!active) return { ok: false, url: ollama.url || '', hint: st.reason, provider: st.provider };
      return {
        ok: true,
        ollama: active.id === 'ollama' ? 'Ollama ' + (active.version || '') : active.label,
        url: active.url || ollama.url || '',
        defaultModel: active.model || '',
        visionModel: active.visionModel || '',
        autoVision: true,
        provider: active.id,
      };
    },
    async models() {
      try {
        return await ai.models();
      } catch (e) {
        throw new HttpError(502, toAiError(e, 'offline').message, 'offline', { models: [] });
      }
    },
    chat: (c, b) => aiChat(c, b, 'legacy'),
  };

  return { aiChat, legacy };
}

/* Wird von hub.js für /api/ai/* benutzt (ohne Router, da nur drei feste Pfade). */
export async function handleLegacyAi(c, legacy, sub) {
  if (c.req.method === 'GET' && sub === '/status') return legacy.status();
  if (c.req.method === 'GET' && sub === '/models') return legacy.models();
  if (c.req.method === 'POST' && sub === '/chat') return legacy.chat(c, await c.json());
  return null; // nicht zuständig → next()
}

