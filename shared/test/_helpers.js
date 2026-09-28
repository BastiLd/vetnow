/* Test-Hilfen (nur für node:test — hier dürfen Node-Module benutzt werden).
   - startFakeHub(): kleiner Hub nach Vertrag §6 mit rev-Ringpuffer, Long-Poll, SSE, offline-Schalter
     und Neustart auf demselben Port. Reicht für hubclient- und Store-Tests; der echte Hub hat
     eigene Tests in hub/.
   - TestEventSource: minimales EventSource auf fetch-Basis (Node hat keins ohne Flag).
   - waitFor(): wartet, bis eine Bedingung wahr ist (statt fester Sleeps). */
import http from 'node:http';

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitFor(fn, { timeout = 4000, interval = 10, label = 'Bedingung' } = {}) {
  const t0 = Date.now();
  for (;;) {
    let v;
    try { v = await fn(); } catch { v = false; }
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error('Timeout beim Warten auf: ' + label);
    await sleep(interval);
  }
}

function send(res, status, body, headers = {}) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': data.length, ...headers });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const t = Buffer.concat(chunks).toString('utf8');
      if (!t) { resolve(undefined); return; }
      try { resolve(JSON.parse(t)); } catch { resolve(t); }
    });
  });
}

/* state: { practices, chats, labels, appointments, blocks, settings } (wird kopiert). */
export async function startFakeHub(initialState = {}, { port = 0 } = {}) {
  const st = JSON.parse(JSON.stringify({ practices: [], chats: [], labels: [], appointments: [], blocks: [], settings: {}, ...initialState }));
  let rev = 0;
  const ring = [];
  const waiters = new Set();
  const sse = new Set();
  const sockets = new Set();
  const requests = [];
  let offline = false;
  let msgCounter = 0;
  let chatCounter = 0;
  let clockOffsetMs = 0;

  function emit(type, payload = {}) {
    rev += 1;
    const ev = { ...payload, type, rev, ts: Date.now() };
    ring.push(ev);
    for (const c of sse) c.write('id: ' + rev + '\ndata: ' + JSON.stringify(ev) + '\n\n');
    setImmediate(flushWaiters);
    return ev;
  }
  function eventsSince(since) {
    if (!Number.isFinite(since) || since < 0 || since > rev) return { resync: true, rev };
    return { rev, events: ring.filter((e) => e.rev > since) };
  }
  function flushWaiters() {
    for (const w of [...waiters]) {
      const r = eventsSince(w.since);
      if (r.resync) { w.finish({ resync: true, rev }); continue; }
      if (r.events.length) w.finish({ rev, events: r.events });
    }
  }
  const chatNoMsgs = (c) => { const { messages, ...rest } = c; return rest; };
  const findChat = (id) => st.chats.find((c) => c.id === id);
  function addMessage(chat, body) {
    const m = {
      id: 'm-srv-' + (++msgCounter), ts: Date.now(), from: body.from || 'owner', type: body.type || 'text', text: String(body.text || ''),
    };
    if (body.clientMsgId) m.clientMsgId = body.clientMsgId;
    if (body.attachment) m.attachment = body.attachment;
    if (body.meta) m.meta = body.meta;
    if (body.source) m.source = body.source;
    chat.messages.push(m);
    const other = m.from === 'owner' ? 'clinic' : 'owner';
    chat.unread = { owner: 0, clinic: 0, ...(chat.unread || {}) };
    chat.unread[other] = (chat.unread[other] || 0) + 1;
    chat.updatedAt = m.ts;
    emit('message', { chatId: chat.id, message: m });
    emit('chat', { chat: chatNoMsgs(chat) });
    return m;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const body = req.method === 'GET' ? undefined : await readBody(req);
    requests.push({ method: req.method, path, query: url.searchParams, body, headers: req.headers });
    if (offline) {
      send(res, 503, { error: 'Der Hub ist gerade (simuliert) offline.', code: 'offline' });
      return;
    }
    let m;
    if (req.method === 'GET' && path === '/health') {
      return send(res, 200, { ok: true, name: 'VetNow Hub', version: '3.0.0', protocol: 3, serverTime: Date.now(), clockOffsetMs, rev, clients: 1 });
    }
    if (req.method === 'GET' && path === '/state') {
      return send(res, 200, { rev, serverTime: Date.now(), ...JSON.parse(JSON.stringify(st)), clockOffsetMs });
    }
    if (req.method === 'GET' && path === '/changes') {
      const since = url.searchParams.get('since') === '' || url.searchParams.get('since') == null ? NaN : Number(url.searchParams.get('since'));
      const timeout = Number(url.searchParams.get('timeout') || 25000);
      const r = eventsSince(since);
      if (r.resync) return send(res, 200, { resync: true, rev });
      if (r.events.length || timeout === 0) return send(res, 200, { rev, events: r.events });
      const w = { since, finish: null };
      const timer = setTimeout(() => w.finish({ rev, events: [] }), timeout);
      w.finish = (b, status = 200) => {
        clearTimeout(timer);
        waiters.delete(w);
        if (!res.writableEnded && !res.destroyed) send(res, status, b);
      };
      waiters.add(w);
      res.on('close', () => { clearTimeout(timer); waiters.delete(w); });
      return undefined;
    }
    if (req.method === 'GET' && path === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write('retry: 3000\n\n');
      res.write('data: ' + JSON.stringify({ type: 'hello', rev, clientId: url.searchParams.get('client') || 'c-x', serverTime: Date.now(), clockOffsetMs }) + '\n\n');
      const since = Number(url.searchParams.get('since'));
      if (url.searchParams.get('since') && Number.isFinite(since) && since < rev) {
        const r = eventsSince(since);
        if (r.resync) res.write('data: ' + JSON.stringify({ type: 'resync', rev }) + '\n\n');
        else r.events.forEach((e) => res.write('id: ' + e.rev + '\ndata: ' + JSON.stringify(e) + '\n\n'));
      }
      sse.add(res);
      res.on('close', () => sse.delete(res));
      return undefined;
    }
    if (req.method === 'POST' && (m = /^\/chats\/([^/]+)\/messages$/.exec(path))) {
      const chat = findChat(m[1]);
      if (!chat) return send(res, 404, { error: 'Chat nicht gefunden.', code: 'not-found' });
      const msg = addMessage(chat, body || {});
      return send(res, 201, { message: msg });
    }
    if (req.method === 'POST' && (m = /^\/chats\/([^/]+)\/read$/.exec(path))) {
      const chat = findChat(m[1]);
      if (!chat) return send(res, 404, { error: 'Chat nicht gefunden.', code: 'not-found' });
      chat.unread = { ...(chat.unread || {}), [body.side]: 0 };
      emit('read', { chatId: chat.id, side: body.side });
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && path === '/chats') {
      const chat = { messages: [], unread: { owner: 0, clinic: 0 }, pinned: {}, labels: [], ...body, id: body && body.id ? body.id : 'ch-srv-' + (++chatCounter) };
      st.chats.push(chat);
      emit('chat', { chat: chatNoMsgs(chat) });
      return send(res, 201, { chat });
    }
    if (req.method === 'PATCH' && (m = /^\/chats\/([^/]+)$/.exec(path))) {
      const chat = findChat(m[1]);
      if (!chat) return send(res, 404, { error: 'Chat nicht gefunden.', code: 'not-found' });
      Object.assign(chat, body || {});
      emit('chat', { chat: chatNoMsgs(chat) });
      return send(res, 200, { chat });
    }
    if (req.method === 'POST' && path === '/requests') {
      const b = body || {};
      // Absichtlich EIGENE ID (wie ein Hub, der Client-IDs ignoriert) → testet die Umbenennung.
      const chat = {
        id: 'ch-srv-' + (++chatCounter), kind: 'request', practiceId: b.practiceId, ownerId: b.ownerId, ownerName: b.ownerName,
        petName: b.petName, animal: b.animal, topic: 'Anfrage', labels: ['tiere', 'posteingang'], pinned: {}, unread: { owner: 0, clinic: 0 },
        autoReply: false, messages: [], createdAt: Date.now(), updatedAt: Date.now(),
      };
      st.chats.push(chat);
      emit('chat', { chat: chatNoMsgs(chat) });
      addMessage(chat, { from: 'owner', text: b.message, clientMsgId: b.clientMsgId });
      return send(res, 201, { chat });
    }
    if (req.method === 'POST' && (m = /^\/practices\/([^/]+)\/status$/.exec(path))) {
      const p = st.practices.find((x) => x.id === m[1]);
      if (!p) return send(res, 404, { error: 'Praxis nicht gefunden.', code: 'not-found' });
      const t = Date.now();
      p.status = body.expire ? { ...p.status, expiresAt: t - 1 } : { value: body.value, setAt: t, expiresAt: t + (body.hours || 24) * 3600e3 };
      emit('practice', { practice: p });
      return send(res, 200, { practice: p });
    }
    if (req.method === 'GET' && path === '/secret') {
      return send(res, 401, { error: 'Admin-Anmeldung nötig.', code: 'unauthorized' });
    }
    return send(res, 404, { error: 'Unbekannter Pfad.', code: 'not-found' });
  });
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  let actualPort = server.address().port;

  const api = {
    get url() { return 'http://127.0.0.1:' + actualPort; },
    get port() { return actualPort; },
    get rev() { return rev; },
    state: st,
    requests,
    emit,
    addMessage(chatId, body) { return addMessage(findChat(chatId), body); },
    setClock(ms) { clockOffsetMs = ms; return emit('clock', { offsetMs: ms }); },
    setOffline(on) {
      offline = !!on;
      if (offline) {
        for (const w of [...waiters]) w.finish({ error: 'offline', code: 'offline' }, 503);
        for (const c of [...sse]) { try { c.destroy(); } catch { /* egal */ } }
      }
    },
    /* Server hart stoppen (alle Verbindungen kappen) — wie ein abgestürzter Hub. */
    async stop() {
      for (const w of [...waiters]) { try { w.finish(null); } catch { /* egal */ } }
      waiters.clear();
      for (const c of [...sse]) { try { c.destroy(); } catch { /* egal */ } }
      for (const s of [...sockets]) { try { s.destroy(); } catch { /* egal */ } }
      await new Promise((r) => server.close(() => r()));
    },
    /* Auf demselben Port wieder starten (Zustand + rev bleiben erhalten). */
    async restart() {
      await new Promise((r) => server.listen(actualPort, '127.0.0.1', r));
      actualPort = server.address().port;
    },
  };
  return api;
}

/* Minimales EventSource für Node-Tests: liest den SSE-Strom über fetch. */
export class TestEventSource {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.ctrl = new AbortController();
    TestEventSource.instances.push(this);
    this.start();
  }
  async start() {
    try {
      const res = await fetch(this.url, { signal: this.ctrl.signal, headers: { accept: 'text/event-stream' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      this.readyState = 1;
      if (this.onopen) this.onopen({});
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const r = await reader.read();
        if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop();
        for (const block of parts) {
          const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
          if (data && this.onmessage) this.onmessage({ data });
        }
      }
      throw new Error('Strom beendet');
    } catch {
      if (this.readyState === 2) return;
      this.readyState = 2;
      if (this.onerror) this.onerror({});
    }
  }
  close() {
    this.readyState = 2;
    this.ctrl.abort();
  }
}
TestEventSource.instances = [];

/* Speicher-Adapter mit Zähler und Fehler-Schaltern (für Store-Tests). */
export function spyStorage(initial = {}, { failGet = () => false, legacy = {} } = {}) {
  const map = new Map(Object.entries(initial));
  const calls = { get: 0, set: 0, remove: 0, setKeys: [] };
  return {
    map,
    calls,
    async get(k) { calls.get++; if (failGet(k)) throw new Error('Lesefehler (Test)'); return map.has(k) ? map.get(k) : null; },
    async set(k, v) { calls.set++; calls.setKeys.push(k); map.set(k, v); },
    async remove(k) { calls.remove++; map.delete(k); },
    async keys() { return [...map.keys()]; },
    async getLegacy(k) { return Object.prototype.hasOwnProperty.call(legacy, k) ? legacy[k] : null; },
  };
}
