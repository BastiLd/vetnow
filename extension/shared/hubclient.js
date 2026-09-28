// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* VetNow — Client für den VetNow Hub (Vertrag §6/§7).

   Läuft überall: Browser/PWA, React Native (Hermes), Extension (Seite + Service Worker), Node.
   Deshalb wird nichts Plattform-Spezifisches vorausgesetzt:
   - fetch, EventSource und Timer werden übergeben oder vorsichtig aus globalThis genommen.
   - Echtzeit: SSE, wenn eine EventSource-Implementierung da ist (Browser), sonst Long-Poll über
     GET /changes (React Native und der Extension-Service-Worker haben kein verlässliches EventSource).
   - Reißt die Verbindung ab, wird mit wachsender Pause neu verbunden (1 s, 2 s, 4 s … max. 15 s),
     damit ein ausgefallener Hub nicht mit Anfragen überschüttet wird.
   - Jedes Ereignis trägt `rev`. Der Client merkt sich die höchste rev und fragt beim Wiederverbinden
     „alles seit rev X" — so geht nichts verloren. Ist die Lücke zu groß, schickt der Hub `resync`
     und der Store lädt den ganzen Zustand neu. */
import { APP_VERSION, PROTOCOL } from './version.js';
import { uid } from './ids.js';
import { HUB_PORT, STUDIO_PORT, ZIMA_STUDIO_URL } from './constants.js';

export const HUB_PROBE_TIMEOUT_MS = 2500;
export const HUB_REQUEST_TIMEOUT_MS = 15000;
export const HUB_POLL_TIMEOUT_MS = 25000;
export const BACKOFF_MIN_MS = 1000;
export const BACKOFF_MAX_MS = 15000;

const num = (v) => typeof v === 'number' && Number.isFinite(v);

/* Fehler vom Hub: deutsche Meldung + code ('offline', 'timeout', 'unauthorized', … oder der
   code aus der Hub-Antwort) + HTTP-Status. */
export function hubError(message, code, status, body) {
  const e = new Error(message || 'Hub-Fehler');
  e.name = 'HubError';
  e.code = code || 'error';
  if (status) e.status = status;
  if (body !== undefined) e.body = body;
  return e;
}

function abortError() {
  const e = new Error('Abgebrochen');
  e.name = 'AbortError';
  e.code = 'aborted';
  return e;
}

/* '192.168.1.5:8787/' → 'http://192.168.1.5:8787';  'https://x.y/api/v1' → 'https://x.y'. */
export function normalizeHubUrl(url) {
  let s = String(url == null ? '' : url).trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'http://' + s;
  s = s.replace(/\/+$/, '').replace(/\/api\/v1$/, '').replace(/\/+$/, '');
  return s;
}

/* Hostname ohne URL-Klasse (Reacts Natives URL-Polyfill kennt .hostname nicht). */
function hostnameOf(url) {
  const m = /^[a-z][a-z0-9+.-]*:\/\/(\[[^\]]+\]|[^:/?#]+)/i.exec(String(url || ''));
  return m ? m[1].toLowerCase() : '';
}

/* Expo hostUri: '192.168.1.5:8081', 'exp://192.168.1.5:8081/--/…', '[fe80::1]:8081' → Host. */
export function hostFromHostUri(hostUri) {
  let s = String(hostUri || '').trim();
  if (!s) return '';
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const v6 = /^(\[[^\]]+\])/.exec(s);
  if (v6) return v6[1];
  const m = /^([^:/?#]+)/.exec(s);
  return m ? m[1] : '';
}

function qs(params) {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k])))
    .join('&');
}

/* Kandidaten-Adressen für den Hub in der Reihenfolge laut Vertrag §7:
   1. gespeicherte Einstellung, 2. envUrl (EXPO_PUBLIC_HUB_URL / VITE_HUB_URL),
   3. je Plattform:
      web       gleiche Herkunft (Studio hängt den Hub unter /api/v1 ein; Vite-Dev leitet /api per
                Proxy weiter) — AUSSER *.github.io: Die Seite ist HTTPS, ein Hub im LAN wäre http →
                der Browser blockiert das als Mixed Content. Läuft die Seite selbst auf localhost,
                zusätzlich http://localhost:8787 (Vite ohne Proxy).
      ios/android/mobile/native  Host aus Expo-hostUri mit Port 8787, dann 3000 (Studio),
                dann die bekannte ZimaOS-Adresse.
      extension http://localhost:8787, http://127.0.0.1:8787
      sonst     http://127.0.0.1:8787
   4. extra[] (z. B. aus einer Liste im Admin-Center). Doppelte werden entfernt. */
export function resolveHubCandidates(input) {
  const o = input || {};
  const out = [];
  const add = (u) => {
    const n = normalizeHubUrl(u);
    if (n && out.indexOf(n) < 0) out.push(n);
  };
  if (o.saved) add(o.saved);
  if (o.envUrl) add(o.envUrl);
  const p = String(o.platform || '').toLowerCase();
  if (p === 'web' || p === 'pwa' || p === 'browser') {
    const origin = String(o.origin || '');
    if (/^https?:\/\//i.test(origin)) {
      const host = hostnameOf(origin);
      if (!/(^|\.)github\.io$/.test(host)) add(origin);
      if (/^http:/i.test(origin) && (host === 'localhost' || host === '127.0.0.1' || host === '[::1]')) add('http://localhost:' + HUB_PORT);
    }
  } else if (p === 'ios' || p === 'android' || p === 'mobile' || p === 'native' || p === 'expo') {
    const host = hostFromHostUri(o.hostUri);
    if (host) {
      add('http://' + host + ':' + HUB_PORT);
      add('http://' + host + ':' + STUDIO_PORT);
    }
    add(ZIMA_STUDIO_URL);
  } else if (p === 'extension') {
    add('http://localhost:' + HUB_PORT);
    add('http://127.0.0.1:' + HUB_PORT);
  } else {
    add('http://127.0.0.1:' + HUB_PORT);
  }
  (Array.isArray(o.extra) ? o.extra : []).forEach(add);
  return out;
}

function getFetch(f) {
  if (typeof f === 'function') return f;
  return typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;
}

/* Timeout + Abbruch durch den Aufrufer. Ohne AbortController gibt es nur den Timeout-Wettlauf. */
async function fetchWithTimeout(f, url, init, timeoutMs, outerSignal) {
  const AC = globalThis.AbortController;
  const ctrl = typeof AC === 'function' ? new AC() : null;
  let timedOut = false;
  let aborted = false;
  let timer = null;
  const onOuter = () => { aborted = true; if (ctrl) ctrl.abort(); };
  if (outerSignal) {
    if (outerSignal.aborted) throw abortError();
    if (typeof outerSignal.addEventListener === 'function') outerSignal.addEventListener('abort', onOuter);
  }
  const cleanup = () => {
    if (timer) globalThis.clearTimeout(timer);
    if (outerSignal && typeof outerSignal.removeEventListener === 'function') outerSignal.removeEventListener('abort', onOuter);
  };
  try {
    const p = f(url, { ...init, signal: ctrl ? ctrl.signal : undefined });
    const race = new Promise((_, reject) => {
      timer = globalThis.setTimeout(() => {
        timedOut = true;
        if (ctrl) ctrl.abort();
        reject(hubError('Zeitüberschreitung — der Hub antwortet nicht.', 'timeout'));
      }, timeoutMs);
    });
    const res = await Promise.race([p, race]);
    const text = await Promise.race([res.text(), race]);
    return { res, text };
  } catch (e) {
    if (aborted) throw abortError();
    if (timedOut) throw hubError('Zeitüberschreitung — der Hub antwortet nicht.', 'timeout');
    if (e && e.name === 'HubError') throw e;
    throw hubError('Hub nicht erreichbar (' + ((e && e.message) || 'Netzwerkfehler') + ').', 'offline');
  } finally {
    cleanup();
  }
}

function parseBody(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

/* Ist unter url ein VetNow Hub? → { url, ok, compatible, ms, info, error } (wirft nie). */
export async function probeHub(url, timeoutMs, opts) {
  const base = normalizeHubUrl(url);
  const t0 = Date.now();
  const f = getFetch(opts && opts.fetch);
  if (!base || !f) return { url: base, ok: false, compatible: false, ms: 0, info: null, error: 'keine Adresse' };
  try {
    const { res, text } = await fetchWithTimeout(f, base + '/api/v1/health', { method: 'GET', headers: { accept: 'application/json' } }, timeoutMs > 0 ? timeoutMs : HUB_PROBE_TIMEOUT_MS);
    const j = parseBody(text);
    const isHub = !!(res.ok && j && (j.name === 'VetNow Hub' || (j.ok === true && num(j.protocol))));
    return {
      url: base,
      ok: isHub,
      compatible: isHub && (!num(j.protocol) || j.protocol === PROTOCOL),
      ms: Date.now() - t0,
      info: isHub ? j : null,
      error: isHub ? null : (res.ok ? 'Antwort ist kein VetNow Hub' : 'HTTP ' + res.status),
    };
  } catch (e) {
    return { url: base, ok: false, compatible: false, ms: Date.now() - t0, info: null, error: e.message };
  }
}

/* Alle Kandidaten parallel prüfen (Reihenfolge der Ergebnisse = Reihenfolge der Kandidaten). */
export function probeHubs(candidates, opts) {
  const o = opts || {};
  return Promise.all((Array.isArray(candidates) ? candidates : []).map((u) => probeHub(u, o.timeoutMs, o)));
}

/* Erster erreichbarer UND kompatibler Hub in Prioritätsreihenfolge (nicht der schnellste). */
export async function findHub(candidates, opts) {
  const results = await probeHubs(candidates, opts);
  const hit = results.find((r) => r.ok && r.compatible);
  return { url: hit ? hit.url : null, results };
}

/* data:-URL → Uint8Array (für uploadFile). atob gibt es in Browsern, Node und Hermes (RN ≥ 0.74). */
function dataUrlToBytes(src) {
  const i = src.indexOf(',');
  const meta = src.slice(5, i);
  const payload = src.slice(i + 1);
  if (meta.indexOf(';base64') < 0) {
    const s = decodeURIComponent(payload);
    const out = new Uint8Array(s.length);
    for (let k = 0; k < s.length; k++) out[k] = s.charCodeAt(k) & 255;
    return { bytes: out, mime: meta.split(';')[0] };
  }
  if (typeof globalThis.atob !== 'function') throw hubError('Diese Umgebung kann Base64 nicht dekodieren.', 'bad-request');
  const bin = globalThis.atob(payload);
  const out = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
  return { bytes: out, mime: meta.split(';')[0] };
}

/* createHubClient({ baseUrl, fetch, EventSource, platform, clientName, version, adminToken, clientId,
                     timeoutMs, pollTimeoutMs, backoffMinMs, backoffMaxMs, rev })
   EventSource: undefined → aus globalThis (Browser), null → IMMER Long-Poll. */
export function createHubClient(opts) {
  const o = opts || {};
  const base = normalizeHubUrl(o.baseUrl);
  const api = base + '/api/v1';
  const f = getFetch(o.fetch);
  const ES = o.EventSource !== undefined ? o.EventSource : (typeof globalThis.EventSource === 'function' ? globalThis.EventSource : null);
  const platform = o.platform || 'unknown';
  const clientName = o.clientName || ('VetNow ' + platform);
  const version = o.version || APP_VERSION;
  const timeoutMs = o.timeoutMs > 0 ? o.timeoutMs : HUB_REQUEST_TIMEOUT_MS;
  const pollTimeoutMs = o.pollTimeoutMs >= 0 && o.pollTimeoutMs !== undefined ? o.pollTimeoutMs : HUB_POLL_TIMEOUT_MS;
  let clientId = o.clientId || uid('c');
  let adminToken = o.adminToken || '';
  let rev = num(o.rev) ? o.rev : null;
  let latencyMs = null;
  let status = 'off';
  // Wartezeiten für die Wiederverbindung (Tests verkürzen sie; Standard 1 s … 15 s).
  const backoffMin = o.backoffMinMs > 0 ? o.backoffMinMs : BACKOFF_MIN_MS;
  const backoffMax = o.backoffMaxMs > 0 ? o.backoffMaxMs : BACKOFF_MAX_MS;

  async function request(method, path, body, ropts) {
    const r = ropts || {};
    if (!f) throw hubError('In dieser Umgebung gibt es kein fetch().', 'offline');
    const headers = { accept: 'application/json', 'x-vn-client': clientId };
    let payload;
    if (r.rawBody !== undefined) {
      payload = r.rawBody;
      if (r.contentType) headers['content-type'] = r.contentType;
    } else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    if (r.headers) Object.keys(r.headers).forEach((k) => { headers[k] = r.headers[k]; });
    if (r.admin && adminToken) headers['x-vn-admin'] = adminToken;
    const { res, text } = await fetchWithTimeout(f, api + path, { method: method || 'GET', headers, body: payload }, r.timeoutMs > 0 ? r.timeoutMs : timeoutMs, r.signal);
    const j = parseBody(text);
    if (!res.ok) {
      const msg = (j && typeof j.error === 'string' && j.error) || ('Der Hub meldet HTTP ' + res.status + '.');
      let code = (j && j.code) || ('http-' + res.status);
      if (res.status === 401 || res.status === 403) code = (j && j.code) || 'unauthorized';
      // 503 mit code 'offline' = Hub (simuliert) offline → wie Netzwerkausfall behandeln.
      throw hubError(msg, code, res.status, j);
    }
    return j;
  }

  async function health() {
    const t0 = Date.now();
    const j = await request('GET', '/health', undefined, { timeoutMs: 5000 });
    latencyMs = Date.now() - t0;
    return j;
  }

  async function state() {
    const j = await request('GET', '/state');
    if (j && num(j.rev)) rev = j.rev;
    return j;
  }

  /* Anhang hochladen: Blob, ArrayBuffer, Uint8Array oder data:-URL. → { id, ref:'hub:<id>', url, size, mime } */
  async function uploadFile(data, name, mime) {
    let raw = data;
    let type = mime || (data && data.type) || '';
    if (typeof data === 'string') {
      if (data.indexOf('data:') !== 0) throw hubError('Nur data:-URLs können als Text hochgeladen werden.', 'bad-request');
      const d = dataUrlToBytes(data);
      raw = d.bytes;
      type = type || d.mime;
    }
    return request('POST', '/files', undefined, {
      rawBody: raw,
      contentType: type || 'application/octet-stream',
      headers: { 'x-filename': encodeURIComponent(String(name || 'datei')) },
      timeoutMs: 120000,
    });
  }

  /* 'hub:<id>' oder '<id>' → vollständige Download-Adresse. */
  function fileUrl(refOrId) {
    const id = String(refOrId || '').replace(/^hub:/, '');
    return api + '/files/' + encodeURIComponent(id);
  }

  async function adminLogin(password) {
    const j = await request('POST', '/admin/login', { password });
    if (j && j.token) adminToken = j.token;
    return j;
  }

  /* Echtzeit-Abo. onEvent(ev) für jedes Ereignis (inkl. hello/resync), onStatus(status, info).
     Rückgabe: stop(). */
  function subscribe(onEvent, onStatus) {
    let stopped = false;
    let attempt = 0;
    let es = null;
    let timer = null;
    let pollCtrl = null;
    const useSse = typeof ES === 'function';

    const setStatus = (s, info) => {
      if (stopped) return;
      const changed = s !== status;
      status = s;
      if (typeof onStatus === 'function' && (changed || s === 'offline')) {
        try { onStatus(s, { via: useSse ? 'sse' : 'poll', ...(info || {}) }); } catch { /* Listener-Fehler nicht hochreichen */ }
      }
    };
    const deliver = (ev) => {
      // Nach stop() nichts mehr ausliefern: Ein Chunk mit mehreren Ereignissen oder eine Long-Poll-
      // Antwort kann noch „unterwegs" sein — sonst landen Hub-Ereignisse nach dem Trennen im lokalen Zustand.
      if (stopped) return;
      if (!ev || typeof ev !== 'object' || typeof ev.type !== 'string') return;
      if (num(ev.rev)) {
        if (ev.type === 'resync') rev = ev.rev;
        else if (ev.type !== 'hello') rev = rev == null ? ev.rev : Math.max(rev, ev.rev);
      }
      if (ev.type === 'hello' && ev.clientId && !o.clientId) clientId = ev.clientId;
      try { onEvent(ev); } catch { /* ein kaputter Listener darf die Verbindung nicht beenden */ }
    };
    const retry = (err) => {
      if (stopped) return;
      const delay = Math.min(backoffMax, backoffMin * Math.pow(2, attempt));
      attempt++;
      setStatus('offline', { error: err ? err.message : '', code: err && err.code, retryInMs: delay, attempt });
      timer = globalThis.setTimeout(() => { timer = null; connect(); }, delay);
    };

    function openSse() {
      const url = api + '/events?' + qs({ client: clientId, platform, name: clientName, version, since: rev == null ? '' : rev });
      let source;
      try { source = new ES(url); } catch (e) { retry(e); return; }
      es = source;
      source.onopen = () => { attempt = 0; setStatus('online'); };
      source.onmessage = (e) => {
        let ev;
        try { ev = JSON.parse(e.data); } catch { return; }
        if (status !== 'online') { attempt = 0; setStatus('online'); }
        deliver(ev);
      };
      source.onerror = () => {
        if (stopped || es !== source) return;
        // Eigene Wiederverbindung statt der des Browsers: nur so gibt es Backoff + Status + since=rev.
        try { source.close(); } catch { /* egal */ }
        es = null;
        retry(hubError('Echtzeit-Verbindung zum Hub unterbrochen.', 'offline'));
      };
    }

    async function poll() {
      const AC = globalThis.AbortController;
      // Die ERSTE Anfrage fragt mit timeout=0: Der Hub antwortet sofort, und der Status steht nach
      // Millisekunden auf 'online' statt erst nach bis zu 25 s (so lange hält der Hub sonst offen).
      let first = true;
      while (!stopped) {
        pollCtrl = typeof AC === 'function' ? new AC() : null;
        const t0 = Date.now();
        const wait = first ? 0 : pollTimeoutMs;
        let res;
        try {
          res = await request('GET', '/changes?' + qs({ since: rev == null ? '' : rev, timeout: wait, client: clientId, platform, name: clientName, version }), undefined, {
            timeoutMs: wait + 10000,
            signal: pollCtrl ? pollCtrl.signal : undefined,
          });
        } catch (e) {
          if (stopped || (e && e.name === 'AbortError')) return;
          retry(e);
          return;
        }
        if (stopped) return;
        if (status !== 'online') { attempt = 0; setStatus('online'); }
        const evs = res && Array.isArray(res.events) ? res.events : [];
        if (res && res.resync) {
          deliver({ type: 'resync', rev: num(res.rev) ? res.rev : 0, reason: 'poll' });
        } else {
          evs.forEach(deliver);
          if (res && num(res.rev)) rev = rev == null ? res.rev : Math.max(rev, res.rev);
        }
        // Schutz gegen eine Endlosschleife, falls ein Server sofort leer antwortet.
        const wasFirst = first;
        first = false;
        if (!wasFirst && !evs.length && !(res && res.resync) && Date.now() - t0 < 250) {
          await new Promise((r) => { timer = globalThis.setTimeout(r, 1000); });
          timer = null;
        }
      }
    }

    function connect() {
      if (stopped) return;
      if (status !== 'online') setStatus('connecting');
      if (useSse) openSse(); else poll();
    }

    status = 'off';
    connect();
    return function stop() {
      if (stopped) return;
      stopped = true;
      status = 'off';
      if (timer) globalThis.clearTimeout(timer);
      timer = null;
      if (es) { try { es.close(); } catch { /* egal */ } es = null; }
      if (pollCtrl) { try { pollCtrl.abort(); } catch { /* egal */ } }
    };
  }

  return {
    get baseUrl() { return base; },
    get clientId() { return clientId; },
    get rev() { return rev; },
    get latencyMs() { return latencyMs; },
    get status() { return status; },
    get adminToken() { return adminToken; },
    setRev(n) { if (num(n)) rev = n; },
    setAdminToken(t) { adminToken = t || ''; },
    request,
    health,
    state,
    uploadFile,
    fileUrl,
    adminLogin,
    subscribe,
  };
}
