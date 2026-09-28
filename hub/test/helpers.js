/* Test-Helfer für den Hub: echter HTTP-Server auf Port 0 mit temporärem Datenordner. */
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { createHub } from '../hub.js';
import { socketAddress } from '../lib/http.js';

export const quietLogger = { info() {}, warn() {}, error() {}, log() {} };

/* fetch-Ersatz, der sich wie ein nicht laufendes Ollama verhält (sofort, ohne 2-s-Wartezeit von
   Windows bei geschlossenen Ports). Der echte Offline-Fall wird in ai.test.js separat geprüft. */
export const offlineFetch = async () => {
  const e = new TypeError('fetch failed');
  e.cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:11434'), { code: 'ECONNREFUSED' });
  throw e;
};

export function tempDir(prefix = 'vnhub-') {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function rmDir(dir) {
  try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* Windows sperrt evtl. kurz */ }
}

/* Absender-Adresse im Test „fälschbar" machen: Header x-test-remote simuliert ein LAN-Gerät. */
export const testRemote = (req) => req.headers['x-test-remote'] || socketAddress(req);

export async function startHub(opts = {}) {
  const dataDir = opts.dataDir || tempDir();
  const hub = await createHub({
    dataDir, port: 0, host: '127.0.0.1', logger: quietLogger, env: { VN_ADMIN_PASSWORD: 'test-pass', ...(opts.env || {}) },
    fetchImpl: offlineFetch, mockWordDelayMs: 0, remoteAddress: testRemote, saveDelayMs: 20,
    ...opts,
  });
  const base = hub.url;
  async function api(p, { method = 'GET', body, headers = {}, raw = false } = {}) {
    const init = { method, headers: { ...headers } };
    if (body !== undefined) {
      if (raw) init.body = body;
      else { init.body = JSON.stringify(body); init.headers['content-type'] = 'application/json'; }
    }
    const res = await fetch(base + (p.startsWith('/api/') || !p.startsWith('/') || p.startsWith('/vetnow') ? p : '/api/v1' + p), init);
    const ct = res.headers.get('content-type') || '';
    let data;
    if (ct.includes('application/json')) data = await res.json();
    else if (ct.startsWith('text/') || ct.includes('javascript') || ct.includes('manifest')) data = await res.text();
    else data = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, body: data };
  }
  async function close({ keep = false } = {}) {
    await hub.close();
    if (!keep && !opts.dataDir) rmDir(dataDir);
  }
  return { hub, base, api, close, dataDir };
}

/* Roh-GET ohne URL-Normalisierung (für Pfad-Traversal-Tests: fetch würde '..' selbst auflösen). */
export function rawGet(base, rawPath, headers = {}) {
  const u = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: u.hostname, port: u.port, path: rawPath, method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

/* SSE-Client auf Basis von fetch: sammelt Ereignisse (JSON aus data:) und Kommentare. */
export async function openSse(url, headers = {}) {
  const ctrl = new AbortController();
  const res = await fetch(url, { headers: { accept: 'text/event-stream', ...headers }, signal: ctrl.signal });
  const events = [];
  const comments = [];
  let raw = '';
  const listeners = new Set();
  const done = (async () => {
    const dec = new TextDecoder();
    let buf = '';
    try {
      for await (const chunk of res.body) {
        const txt = dec.decode(chunk, { stream: true });
        raw += txt;
        buf += txt;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const data = [];
          let name = null;
          for (const line of frame.split('\n')) {
            if (line.startsWith(':')) comments.push(line);
            else if (line.startsWith('data:')) data.push(line.slice(5).trim());
            else if (line.startsWith('event:')) name = line.slice(6).trim();
          }
          if (data.length) {
            try { const ev = JSON.parse(data.join('\n')); if (name) ev.__event = name; events.push(ev); } catch { /* kein JSON */ }
          }
          for (const l of listeners) l();
        }
      }
    } catch { /* abgebrochen */ }
  })();
  async function waitFor(pred, ms = 3000) {
    const found = () => events.find(pred);
    if (found()) return found();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { listeners.delete(check); reject(new Error('SSE-Ereignis kam nicht innerhalb ' + ms + ' ms')); }, ms);
      function check() { const f = found(); if (f) { clearTimeout(t); listeners.delete(check); resolve(f); } }
      listeners.add(check);
    });
  }
  return {
    res, events, comments, waitFor, get raw() { return raw; },
    async close() { ctrl.abort(); await done; },
    ended: done,
  };
}

export async function waitUntil(fn, ms = 5000, step = 20) {
  const until = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) throw new Error('Bedingung nicht innerhalb ' + ms + ' ms erfüllt');
    await new Promise((r) => setTimeout(r, step));
  }
}

/* Einen garantiert geschlossenen Port finden (für „KI-Server offline"). */
export function closedPort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}
