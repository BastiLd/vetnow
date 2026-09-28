/* VetNow Hub — createHub(): der gemeinsame Server für Web, Handy und Extension (Protokoll 3).

   Zwei Einsatzarten mit DEMSELBEN Code:
   1. Standalone:  node hub/index.js  → eigener HTTP-Server (Port 8787, siehe index.js).
   2. Eingehängt:  im Studio (Express) →  const hub = await createHub({ dataDir, webDist, logger });
                   app.use((req, res, next) => hub.handle(req, res, next));
      `handle` beantwortet NUR /api/v1/*, die alten /api/ai/*-Pfade und (mit webDist) /vetnow/ —
      alles andere reicht es mit next() an Express weiter. Hat Express den Body schon gelesen
      (express.json()), wird req.body verwendet.

   Aufbau (jede Datei hat ihre eigene Erklärung):
     lib/store.js     Zustand + rev + Ereignis-Ringpuffer + atomares Speichern
     lib/ops.js       alle Änderungen (prüfen → ändern → Ereignis)
     lib/realtime.js  SSE, Long-Poll, Geräteliste
     lib/autoreply.js Bot-/KI-Antworten serverseitig
     ai/registry.js   KI-Anbieter mock/ollama/anthropic/openai
     lib/routes.js    HTTP-Endpunkte
     lib/static.js    Web-App unter /vetnow/ */
import http from 'node:http';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStateStore } from './lib/store.js';
import { createRealtime } from './lib/realtime.js';
import { createFileStore, FILE_ID_RX } from './lib/files.js';
import { createStatic } from './lib/static.js';
import { createFaults } from './lib/faults.js';
import { createLogBuffer } from './lib/log.js';
import { createOps } from './lib/ops.js';
import { createAutoReplier } from './lib/autoreply.js';
import { createAdminAuth, DEFAULT_ADMIN_PASSWORD } from './lib/admin-auth.js';
import { createSimulator } from './lib/simulate.js';
import { createSelftest } from './lib/selftest.js';
import { registerRoutes, handleLegacyAi, Reply } from './lib/routes.js';
import {
  applyCors, sendJson, sendError, readJson, readRaw, createRouter, socketAddress, HttpError, JSON_LIMIT,
} from './lib/http.js';
import { isId, sleep } from './lib/util.js';
import { createAiRegistry } from './ai/registry.js';
import { APP_VERSION, PROTOCOL } from './lib/shared.js';

export { APP_VERSION, PROTOCOL };

const API = '/api/v1';
const QUIET = new Set(['GET /admin/log', 'GET /admin/overview']); // Admin-Center fragt das ständig ab

/* Optionen:
   dataDir        Pflicht. Ordner für state.json + files/ (wird angelegt).
   webDist        Ordner der gebauten Web-App (web/dist) → /vetnow/. Optional.
   port, host     Wenn `port` gesetzt ist (auch 0), startet createHub einen eigenen HTTP-Server.
   logger         console-ähnlich { info, warn, error }.
   env            Umgebung (Standard process.env) — VN_ADMIN_PASSWORD, OLLAMA_URL, ANTHROPIC_API_KEY …
   Für Tests/Einbettung: seedMode ('demo'|'empty'), remoteAddress(req), fetchImpl, anthropicClient,
   loadAnthropicSdk, random, mockWordDelayMs, keepAliveMs, clientIdleMs, saveDelayMs,
   rootRedirect (Standard true: '/' → 302 '/vetnow/'; im Studio false setzen),
   legacyAi (Standard true: /api/ai/status|models|chat beantworten; im Studio evtl. false). */
export async function createHub(options = {}) {
  const {
    dataDir, webDist = null, port, host = '0.0.0.0', logger = console, env = process.env,
    seedMode = 'demo', remoteAddress = socketAddress, fetchImpl = globalThis.fetch,
    anthropicClient = null, loadAnthropicSdk, random = Math.random, mockWordDelayMs = 25,
    keepAliveMs = 20000, clientIdleMs = 60000, saveDelayMs = 300,
    rootRedirect = true, legacyAi = true, webPrefix = '/vetnow',
  } = options;
  if (!dataDir) throw new Error('createHub: dataDir fehlt.');
  const dir = path.resolve(dataDir);
  const startedAt = Date.now();

  const log = createLogBuffer({ logger });
  const store = createStateStore({ dataDir: dir, logger, seedMode, saveDelayMs });
  await store.load();
  const faults = createFaults({ random });
  const files = createFileStore({ dataDir: dir, now: () => store.now() });
  const realtime = createRealtime({ store, logger, keepAliveMs, clientIdleMs });
  const ai = createAiRegistry({
    env, fetchImpl, anthropicClient, loadAnthropicSdk, mockWordDelayMs, logger,
    getSettings: () => store.state.settings,
    faults,
    // 'hub:<id>'-Bilder aus Nachrichten für die KI als Base64 bereitstellen.
    resolveImage: async (id) => {
      if (!FILE_ID_RX.test(id)) return null;
      const f = await files.read(id).catch(() => null);
      return f && /^image\//.test(f.meta.mime) ? f.data.toString('base64') : null;
    },
  });
  const ops = createOps({ store, files, log, random });
  const replier = createAutoReplier({ store, ops, ai, log, logger });
  ops.setMessageHook((chat, msg) => replier.onMessage(chat, msg));
  ops.setChatDeletedHook((id) => replier.cancel(id));
  const adminAuth = createAdminAuth({
    password: env.VN_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
    localBypass: env.VN_ADMIN_LOCAL_BYPASS !== '0',
    remoteAddress,
  });
  const simulator = createSimulator({ store, ops, files, random });
  const selftest = createSelftest({ store, files, realtime, ai, dataDir: dir });

  // Jedes Ereignis landet auch im Admin-Protokoll (außer der Geräte-Zähler — zu häufig, zu wenig Inhalt).
  const unlog = store.subscribe((ev) => { if (ev.type !== 'clients') log.event(ev); });

  let staticHandler = null;
  let webDir = null;
  if (webDist) {
    const abs = path.resolve(webDist);
    let ok = false;
    try { ok = existsSync(abs) && statSync(abs).isDirectory(); } catch { ok = false; }
    if (ok) { staticHandler = createStatic({ root: abs, prefix: webPrefix }); webDir = abs; }
    else logger.warn(`[hub] webDist „${abs}" existiert nicht — /vetnow/ wird nicht ausgeliefert.`);
  }

  const hub = {
    store, ops, realtime, ai, files, faults, log, adminAuth, simulator, selftest, replier,
    startedAt, dataDir: dir, webDist: webDir, pings: new Map(),
  };
  const router = createRouter();
  const { legacy } = registerRoutes(router, hub);

  /* ------------------------------------------------------------ Anfrage-Kontext */
  function context(req, res, params, query, pathLabel) {
    const address = remoteAddress(req) || '';
    const headerId = req.headers['x-vn-client'];
    const clientId = isId(headerId) ? headerId : (isId(query.client) ? query.client : '');
    let bodyP = null;
    const c = {
      req, res, params, query, clientId, address, adminVia: null, logged: false,
      json: () => (bodyP ||= readJson(req, JSON_LIMIT)),
      raw: (limit) => readRaw(req, limit),
      logNow(status) {
        if (c.logged) return;
        c.logged = true;
        log.request({ method: req.method, path: pathLabel, status, ms: Date.now() - c.t0, client: clientId || address });
      },
      t0: Date.now(),
    };
    return c;
  }

  function send(res, result) {
    if (res.headersSent || res.writableEnded) return;
    if (result instanceof Reply) sendJson(res, result.status, result.body, result.headers);
    else if (result !== undefined) sendJson(res, 200, result);
  }

  /* ------------------------------------------------------------ /api/v1 */
  async function handleApi(req, res, url, sub) {
    applyCors(res);
    const query = Object.fromEntries(url.searchParams);
    const c = context(req, res, {}, query, sub);
    const key = `${req.method} ${sub}`;
    res.on('finish', () => { if (!QUIET.has(key) || res.statusCode >= 400) c.logNow(res.statusCode); });
    if (c.clientId) realtime.seen(c.clientId);

    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Content-Length': '0' }); res.end(); c.logged = true; return; }
    const isAdmin = sub === '/admin' || sub.startsWith('/admin/');
    try {
      if (!isAdmin) {
        if (faults.active('offline')) throw new HttpError(503, 'Der Hub ist gerade (simuliert) offline.', 'offline');
        if (faults.active('slow')) await sleep(faults.slowMs);
        if (faults.roll500()) throw new HttpError(500, 'Simulierter Serverfehler (Fehler-Injektion).', 'fault-500');
      }
      const m = router.match(req.method, sub);
      if (!m) throw new HttpError(404, 'Unbekannter API-Endpunkt.', 'not-found');
      if (m.methodNotAllowed) throw new HttpError(405, 'Diese Methode ist hier nicht erlaubt.', 'method-not-allowed');
      c.params = m.params;
      if (isAdmin && !(m.route.opts && m.route.opts.public)) c.adminVia = adminAuth.check(req);
      send(res, await m.route.handler(c));
    } catch (e) {
      handleError(res, e, key);
    }
  }

  function handleError(res, e, key) {
    if (!(e instanceof HttpError) && !(e && e.status)) {
      log.error(`${key}: ${(e && e.stack) || e}`);
    }
    if (res.headersSent) { try { res.end(); } catch { /* egal */ } return; }
    sendError(res, e);
  }

  /* ------------------------------------------------------------ Einstieg */
  /* Extension-Popup zum Ansehen/Testen im Browser (Kontrollzentrum → Vorschau). Nur lesend. */
  const extDir = fileURLToPath(new URL('../extension/', import.meta.url));
  const extHandler = existsSync(extDir) ? createStatic({ root: extDir, prefix: '/extension' }) : null;
  const konsoleHandler = createStatic({ root: fileURLToPath(new URL('./public/', import.meta.url)), prefix: '/konsole' });

  async function handle(req, res, next) {
    let url;
    try {
      url = new URL(req.url || '/', 'http://hub.local');
    } catch {
      applyCors(res);
      sendJson(res, 400, { error: 'Ungültige Adresse.', code: 'bad-url' });
      return;
    }
    const p = url.pathname;
    try {
      if (p === API || p.startsWith(API + '/')) { await handleApi(req, res, url, p.slice(API.length) || '/'); return; }
      if (legacyAi && p.startsWith('/api/ai/')) {
        applyCors(res);
        if (req.method === 'OPTIONS') { res.writeHead(204, { 'Content-Length': '0' }); res.end(); return; }
        const c = context(req, res, {}, Object.fromEntries(url.searchParams), p);
        res.on('finish', () => c.logNow(res.statusCode));
        let result;
        try {
          result = await handleLegacyAi(c, legacy, p.slice('/api/ai'.length));
        } catch (e) { handleError(res, e, `${req.method} ${p}`); return; }
        if (result === null) { if (next) { next(); return; } sendJson(res, 404, { error: 'Unbekannter KI-Endpunkt.', code: 'not-found' }); return; }
        send(res, result);
        return;
      }
      /* Admin-/Test-Konsole (hub/public, kein Build nötig) — immer verfügbar, auch ohne gebaute Web-App. */
      if (p === '/konsole') { res.writeHead(302, { Location: '/konsole/' }); res.end(); return; }
      if (p.startsWith('/konsole/') && await konsoleHandler.handle(req, res, p)) return;
      if (extHandler && p.startsWith('/extension/') && await extHandler.handle(req, res, p)) return;
      if (staticHandler) {
        if (p === '/' && rootRedirect && (req.method === 'GET' || req.method === 'HEAD')) {
          res.writeHead(302, { Location: webPrefix + '/' });
          res.end();
          return;
        }
        if (await staticHandler.handle(req, res, p)) return;
      }
      if (next) { next(); return; }
      if (p === '/' && !staticHandler) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('<!doctype html><meta charset="utf-8"><title>VetNow Hub</title><body style="font-family:system-ui;padding:24px">'
          + `<h1>VetNow Hub ${APP_VERSION} läuft</h1><p>Die Web-App ist nicht gebaut (Ordner <code>web/dist</code> fehlt). `
          + 'Bitte im Ordner <code>web/</code> <code>npm run build</code> ausführen und den Hub neu starten.</p>'
          + '<p>API: <a href="/api/v1/health">/api/v1/health</a></p></body>');
        return;
      }
      sendJson(res, 404, { error: 'Nicht gefunden.', code: 'not-found' });
    } catch (e) {
      handleError(res, e, `${req.method} ${p}`);
    }
  }

  /* ------------------------------------------------------------ eigener Server (optional) */
  let server = null;
  let boundPort = null;
  async function listen(p = 8787, h = host) {
    if (server) return server;
    server = http.createServer((req, res) => { handle(req, res).catch((e) => handleError(res, e, 'server')); });
    // Keine Zeitbegrenzung für offene Antworten (SSE/Long-Poll), aber Kopfzeilen müssen zügig kommen.
    server.requestTimeout = 0;
    server.headersTimeout = 30000;
    server.keepAliveTimeout = 65000;
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(p, h, () => { server.off('error', reject); resolve(); });
    });
    boundPort = server.address().port;
    return server;
  }
  if (port !== undefined && port !== null) await listen(Number(port), host);

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    replier.close();
    realtime.close();
    unlog();
    if (server) {
      await new Promise((resolve) => {
        server.close(() => resolve());
        if (server.closeAllConnections) server.closeAllConnections();
      });
    }
    await store.close();
  }

  return {
    handle,
    close,
    listen,
    get server() { return server; },
    get port() { return boundPort; },
    get url() { return boundPort ? `http://${host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host}:${boundPort}` : null; },
    get state() { return store.state; },
    get rev() { return store.rev; },
    version: APP_VERSION,
    protocol: PROTOCOL,
    dataDir: dir,
    webDist: webDir,
    store, ops, realtime, ai, files, faults, log, adminAuth, simulator, selftest, replier,
  };
}

export default createHub;
