/* Test-Hilfe: startet den ECHTEN VetNow Hub (hub/hub.js) auf einem freien Port mit eigenem
   Temp-Datenordner. So prüfen die Store-Tests das Zusammenspiel mit genau dem Server, der später
   auch im Studio/auf dem PC läuft — nicht nur mit einer Attrappe.

   Nur für node:test (Node-Module erlaubt). Der Hub bekommt ein fetch, das sofort „Verbindung
   abgelehnt" meldet: Ollama/Anthropic gibt es im Test nicht, Auto-Antworten kommen vom Bot. */
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { createHub } from '../../hub/hub.js';

export const quietLogger = { info() {}, warn() {}, error() {}, log() {} };

export const offlineFetch = async () => {
  const e = new TypeError('fetch failed');
  e.cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:11434'), { code: 'ECONNREFUSED' });
  throw e;
};

export function tempDir(prefix = 'vn-shared-hub-') {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function rmDir(dir) {
  try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* Windows sperrt evtl. kurz */ }
}

/* → { hub, url, port, dataDir, api(path, {method, body}), setSettings(patch), fault(body), restart(), close() } */
export async function startRealHub(opts = {}) {
  const dataDir = opts.dataDir || tempDir();
  const make = (port) => createHub({
    dataDir, port, host: '127.0.0.1', logger: quietLogger, env: {}, fetchImpl: offlineFetch,
    mockWordDelayMs: 0, saveDelayMs: 20, keepAliveMs: 5000, ...(opts.hubOptions || {}),
  });
  let hub = await make(opts.port || 0);
  const port = hub.port;
  const url = hub.url;

  async function api(p, { method = 'GET', body } = {}) {
    const init = { method, headers: {} };
    if (body !== undefined) { init.body = JSON.stringify(body); init.headers['content-type'] = 'application/json'; }
    const res = await fetch(url + '/api/v1' + p, init);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) { const e = new Error('HTTP ' + res.status + ' ' + p + ': ' + text); e.status = res.status; throw e; }
    return data;
  }

  let closed = false;
  const api2 = {
    get hub() { return hub; },
    url,
    port,
    dataDir,
    api,
    // Admin-Endpunkte sind von 127.0.0.1 ohne Passwort erlaubt (Vertrag §6).
    setSettings: (patch) => api('/admin/settings', { method: 'PUT', body: patch }),
    fault: (body) => api('/admin/fault', { method: 'POST', body }),
    chat: (id) => hub.state.chats.find((c) => c.id === id) || null,
    /* Hub „abstürzen" lassen (Zustand wird gespeichert) — die Clients verlieren die Verbindung. */
    async stop() { await hub.close(); },
    /* Neu starten: gleicher Port, gleicher Datenordner (wie ein Neustart des PCs/Containers). */
    async restart() {
      hub = await make(port);
      return hub;
    },
    async close() {
      if (closed) return;
      closed = true;
      try { await hub.close(); } catch { /* schon zu */ }
      if (!opts.dataDir) rmDir(dataDir);
    },
  };
  return api2;
}
