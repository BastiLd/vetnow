/* VetNow Hub — Echtzeit: SSE (EventSource), Long-Poll und das Register der verbundenen Geräte.

   Warum zwei Wege?
   - Browser (Web/PWA) können EventSource → SSE: eine offene Verbindung, Ereignisse kommen sofort.
   - React Native und der Service Worker der Extension haben kein zuverlässiges EventSource.
     Sie fragen per Long-Poll: `GET /changes?since=<rev>` antwortet sofort, wenn es Neues gibt,
     sonst hält der Hub die Anfrage bis zu 25 s offen und antwortet beim ersten Ereignis.

   SSE-Format: Jedes Ereignis wird als `id: <rev>` + `data: <JSON>` gesendet. Das JSON enthält
   `type` und `rev` — also GENAU dieselbe Form wie ein Eintrag in `events[]` beim Long-Poll.
   Dadurch braucht ein Client nur EINE Funktion `applyEvent(ev)` für beide Wege. Zusätzlich
   steht der Typ in der `event:`-Zeile, wenn ein Client `?named=1` anhängt (für
   addEventListener('message:update', …)-Stil). Durch `id:` schickt der Browser bei einem
   automatischen Reconnect `Last-Event-ID` mit — der Hub spielt dann die verpassten Ereignisse
   nach (oder sendet `resync`, wenn die Lücke zu groß ist). */
import { randomBytes } from 'node:crypto';
import { isId, clamp } from './util.js';
import { sendJson } from './http.js';

const cleanStr = (v, max = 80) => (typeof v === 'string' ? v.slice(0, max) : '');

/* Ereignisse mit Ziel (broadcast/ping an EIN Gerät) nur an dieses Gerät ausliefern. */
export function visibleTo(ev, clientId) {
  if ((ev.type === 'broadcast' || ev.type === 'ping') && ev.target && ev.target !== 'all') return ev.target === clientId;
  return true;
}

export function sseFrame(ev, named = false) {
  return (Number.isFinite(ev.rev) ? `id: ${ev.rev}\n` : '')
    + (named ? `event: ${ev.type}\n` : '')
    + `data: ${JSON.stringify(ev)}\n\n`;
}

export function createRealtime({
  store, logger = console, keepAliveMs = 20000, clientIdleMs = 60000, sweepMs = 5000, now = () => Date.now(),
} = {}) {
  const clients = new Map(); // id → Eintrag
  const sseConns = new Set(); // { res, clientId, named, internal }
  const waiters = new Set(); // Long-Poll-Anfragen, die gerade warten
  let lastCount = 0;
  let closed = false;

  const unsubscribe = store.subscribe((ev) => {
    for (const c of sseConns) {
      if (visibleTo(ev, c.clientId)) write(c, sseFrame(ev, c.named));
    }
    // Long-Poll: gesammelt im nächsten Tick antworten, damit zusammengehörige Ereignisse
    // (z. B. `message` + `chat`) in EINER Antwort landen statt in zwei Runden.
    if (waiters.size) setImmediate(flushWaiters);
  });

  function write(conn, chunk) {
    try {
      if (!conn.res.writableEnded && !conn.res.destroyed) conn.res.write(chunk);
    } catch (e) {
      logger.warn('[sse] Schreiben fehlgeschlagen: ' + e.message);
    }
  }

  function newClientId() { return 'c-' + randomBytes(6).toString('hex'); }

  function publicClient(c) {
    return {
      id: c.id, platform: c.platform, name: c.name, version: c.version, via: c.via,
      connectedAt: c.connectedAt, lastSeen: c.lastSeen,
      online: c.sse > 0 || c.waiting > 0 || now() - c.lastSeen < clientIdleMs,
      latencyMs: c.latencyMs ?? null, lastPongAt: c.lastPongAt ?? null, address: c.address || '',
    };
  }

  function emitCountIfChanged() {
    const count = clients.size;
    if (count !== lastCount) {
      lastCount = count;
      if (!closed) store.emit('clients', { count }, { persist: false });
    }
  }

  /* Gerät anlegen/auffrischen. Neue Geräte lösen ein `clients`-Ereignis aus (Admin-Liste live). */
  function touch(id, info = {}, via) {
    if (!isId(id)) return null;
    let c = clients.get(id);
    const t = now();
    if (!c) {
      c = { id, platform: '', name: '', version: '', via: via || 'rest', connectedAt: t, lastSeen: t, sse: 0, waiting: 0, address: '' };
      clients.set(id, c);
    }
    if (info.platform) c.platform = cleanStr(info.platform, 40);
    if (info.name) c.name = cleanStr(info.name, 80);
    if (info.version) c.version = cleanStr(info.version, 40);
    if (info.address) c.address = cleanStr(info.address, 60);
    if (via) c.via = via;
    c.lastSeen = t;
    emitCountIfChanged();
    return c;
  }

  /* Nur bekannte Geräte auffrischen (normale REST-Anfragen mit x-vn-client). */
  function seen(id) {
    const c = isId(id) ? clients.get(id) : null;
    if (c) c.lastSeen = now();
    return c;
  }

  function sweep() {
    const t = now();
    for (const [id, c] of clients) {
      if (c.sse > 0 || c.waiting > 0) continue;
      if (t - c.lastSeen > clientIdleMs) clients.delete(id);
    }
    emitCountIfChanged();
  }
  const sweeper = setInterval(sweep, sweepMs);
  if (sweeper.unref) sweeper.unref();

  /* SSE öffnen. `internal:true` = Selbsttest-Abonnent, erscheint nicht in der Geräteliste. */
  function openSse(req, res, query = {}, { internal = false, address = '' } = {}) {
    const headerId = req.headers && req.headers['x-vn-client'];
    const clientId = isId(query.client) ? query.client : (isId(headerId) ? headerId : newClientId());
    const named = query.named === '1' || query.named === 'true';
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx/Proxy: nicht puffern, sonst kommen Ereignisse verspätet an
    });
    if (res.flushHeaders) res.flushHeaders();
    const conn = { res, clientId, named, internal };
    // Browser verbinden sich nach Abbruch selbst neu; 3 s Pause schont den Hub.
    write(conn, 'retry: 3000\n\n');
    write(conn, sseFrame({ type: 'hello', rev: store.rev, clientId, serverTime: Date.now(), clockOffsetMs: store.state.clockOffsetMs || 0 }, named));

    // Verpasste Ereignisse nachliefern (Reconnect mit Last-Event-ID bzw. ?since=).
    const lastId = Number(req.headers && req.headers['last-event-id'] !== undefined ? req.headers['last-event-id'] : query.since);
    if (Number.isFinite(lastId) && lastId < store.rev) {
      const r = store.eventsSince(lastId);
      if (r.resync) write(conn, sseFrame({ type: 'resync', rev: store.rev, reason: 'gap' }, named));
      else for (const ev of r.events) if (visibleTo(ev, clientId)) write(conn, sseFrame(ev, named));
    }

    sseConns.add(conn);
    let entry = null;
    if (!internal) {
      entry = touch(clientId, { platform: query.platform, name: query.name, version: query.version, address }, 'sse');
      if (entry) entry.sse += 1;
    }
    const ka = setInterval(() => {
      write(conn, `: ka ${Date.now()}\n\n`);
      if (entry) entry.lastSeen = now();
    }, keepAliveMs);
    if (ka.unref) ka.unref();

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(ka);
      sseConns.delete(conn);
      if (entry) { entry.sse = Math.max(0, entry.sse - 1); entry.lastSeen = now(); }
    };
    conn.cleanup = cleanup;
    res.on('close', cleanup);
    if (req.on) req.on('close', cleanup);
    return { clientId, close: () => { cleanup(); try { res.end(); } catch { /* egal */ } } };
  }

  function flushWaiters() {
    for (const w of [...waiters]) {
      const r = store.eventsSince(w.since);
      if (r.resync) { w.finish({ resync: true, rev: store.rev }); continue; }
      const evs = r.events.filter((e) => visibleTo(e, w.clientId));
      if (evs.length) w.finish({ rev: store.rev, events: evs });
    }
  }

  /* Long-Poll: sofort antworten, wenn es Neues gibt; sonst bis `timeout` warten. */
  function longPoll(req, res, query = {}, { address = '' } = {}) {
    const headerId = req.headers && req.headers['x-vn-client'];
    const clientId = isId(query.client) ? query.client : (isId(headerId) ? headerId : null);
    const entry = clientId ? touch(clientId, { platform: query.platform, name: query.name, version: query.version, address }, 'poll') : null;
    const since = query.since === undefined || query.since === '' ? NaN : Number(query.since);
    const timeout = clamp(Number.isFinite(Number(query.timeout)) && query.timeout !== '' ? Number(query.timeout) : 25000, 0, 60000);

    return new Promise((resolve) => {
      const r = store.eventsSince(since);
      if (r.resync) { sendJson(res, 200, { resync: true, rev: store.rev }); resolve(); return; }
      const evs = r.events.filter((e) => visibleTo(e, clientId));
      if (evs.length || timeout === 0) { sendJson(res, 200, { rev: store.rev, events: evs }); resolve(); return; }

      let done = false;
      const w = { since, clientId, finish: null };
      const timer = setTimeout(() => w.finish({ rev: store.rev, events: [] }), timeout);
      if (entry) entry.waiting += 1;
      w.finish = (body, status = 200) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        waiters.delete(w);
        if (entry) { entry.waiting = Math.max(0, entry.waiting - 1); entry.lastSeen = now(); }
        if (body) sendJson(res, status, body);
        resolve();
      };
      waiters.add(w);
      res.on('close', () => w.finish(null)); // Client weg → nichts mehr senden
    });
  }

  /* Alle SSE-Verbindungen und wartenden Long-Polls beenden.
     `offline:true` (Fehler-Injektion): Long-Polls bekommen 503 wie jede andere Anfrage auch,
     damit die Clients in den Offline-Zustand wechseln statt sofort neu zu fragen. */
  function dropAll({ offline = false } = {}) {
    for (const c of [...sseConns]) {
      if (c.cleanup) c.cleanup(); else sseConns.delete(c);
      try { c.res.end(); } catch { /* egal */ }
    }
    for (const w of [...waiters]) {
      if (offline) w.finish({ error: 'Der Hub ist gerade (simuliert) offline.', code: 'offline' }, 503);
      else w.finish({ rev: store.rev, events: [] });
    }
  }

  return {
    openSse,
    longPoll,
    touch,
    seen,
    sweep,
    dropAll,
    get(id) { return clients.get(id) || null; },
    list() { return [...clients.values()].map(publicClient); },
    count() { return clients.size; },
    get sseCount() { return sseConns.size; },
    get waitingCount() { return waiters.size; },
    close() {
      closed = true;
      clearInterval(sweeper);
      unsubscribe();
      dropAll();
    },
  };
}
