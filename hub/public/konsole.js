/* VetNow Kontrollzentrum — Admin- & Test-Center für alle Geräte (Web, iPhone, Android, Extension).
   Läuft direkt im Hub (http://<PC>:8787/konsole/), braucht keinen Build und spricht nur die Hub-API
   /api/v1 an. Jeder Knopf zeigt sein Ergebnis direkt darunter an (Erfolg/Fehler + Dauer) und hat
   ein data-testid, damit auch automatische Tests (z. B. Claude im Browser) ihn finden.
   Texte in du-Form (Entwickler-Werkzeug). Alle Daten werden per textContent gesetzt — nie innerHTML
   mit Daten, damit eine XSS-Testnachricht hier nichts anrichten kann. */

const API = '/api/v1';
const TOKEN_KEY = 'vn3:konsole:token';
const $ = (sel, el = document) => el.querySelector(sel);

/* ---------- kleine DOM-Hilfe: h('div', {class:'x'}, 'Text', kind) ---------- */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'testid') el.dataset.testid = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}
const fmtMs = (ms) => (ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1) + ' s');
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('de-AT');
const pretty = (x) => (typeof x === 'string' ? x : JSON.stringify(x, null, 2));

function toast(text, kind = 'info') {
  const t = h('div', { class: 'toast ' + kind, role: 'status' }, text);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 4500);
}

/* ---------- API ---------- */
function token() { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
async function api(method, path, body) {
  const headers = { 'x-vn-client': clientId || 'konsole' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const tk = token();
  if (tk) headers['x-vn-admin'] = tk;
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (res.status === 401 || res.status === 403) { showLogin(); }
  if (!res.ok) { const e = new Error((data && data.error) || 'HTTP ' + res.status); e.status = res.status; e.data = data; throw e; }
  return data;
}

/* Knopf mit Ergebnis-Zeile: führt fn aus, misst die Zeit, zeigt Erfolg/Fehler. */
function action(label, testid, fn, opts = {}) {
  const out = h('div', { class: 'result', 'data-testid': testid + '-result' });
  const btn = h('button', { class: 'btn ' + (opts.kind || ''), testid, type: 'button' }, label);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const t0 = performance.now();
    try {
      const r = await fn();
      out.textContent = '✔ ' + fmtMs(performance.now() - t0) + (r === undefined ? '' : '\n' + pretty(r));
      out.className = 'result';
    } catch (e) {
      out.textContent = '✘ ' + (e.message || e) + (e.data && e.data.code ? ' (' + e.data.code + ')' : '');
      out.className = 'result err';
    } finally { btn.disabled = false; }
  });
  return opts.inline ? [btn, out] : h('div', {}, btn, out);
}

/* ---------- Live-Verbindung (SSE) ---------- */
let clientId = '';
let es = null;
const logLines = [];
const listeners = new Set();
function connectEvents() {
  if (es) es.close();
  es = new EventSource(`${API}/events?platform=admin&name=${encodeURIComponent('Kontrollzentrum')}&version=3.0.0`);
  const pill = $('#hubPill');
  es.onopen = () => { pill.textContent = 'Hub live'; pill.className = 'pill green'; };
  es.onerror = () => { pill.textContent = 'Hub nicht erreichbar'; pill.className = 'pill red'; };
  es.onmessage = (ev) => handleEvent(ev.data);
  // Der Hub sendet benannte Events (event: message usw.) — alle Typen abonnieren.
  for (const type of ['hello', 'resync', 'practice', 'chat', 'chat:deleted', 'message', 'message:update', 'typing', 'read', 'label', 'label:deleted',
    'appointment', 'appointment:deleted', 'block', 'settings', 'clock', 'broadcast', 'ping', 'clients']) {
    es.addEventListener(type, (ev) => handleEvent(ev.data, type));
  }
}
function handleEvent(raw, type) {
  let data; try { data = JSON.parse(raw); } catch { data = raw; }
  const t = type || (data && data.type) || 'event';
  const payload = data && data.data !== undefined ? data.data : data;
  if (t === 'hello' && payload && payload.clientId) clientId = payload.clientId;
  if (t === 'ping' && payload && payload.pingId && (!payload.target || payload.target === clientId || payload.target === 'all')) {
    api('POST', `/clients/${encodeURIComponent(clientId)}/pong`, { pingId: payload.pingId }).catch(() => {});
  }
  if (t === 'broadcast' && payload && payload.text) toast('📣 ' + payload.text);
  logLines.unshift({ ts: Date.now(), t, payload });
  if (logLines.length > 400) logLines.length = 400;
  for (const fn of listeners) fn(t, payload);
}
function waitForEvent(pred, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const fn = (t, p) => { if (pred(t, p)) { listeners.delete(fn); clearTimeout(tm); resolve({ t, p }); } };
    const tm = setTimeout(() => { listeners.delete(fn); reject(new Error('Kein passendes Live-Event innerhalb von ' + timeoutMs / 1000 + ' s')); }, timeoutMs);
    listeners.add(fn);
  });
}

/* ---------- Login (nur für Geräte im WLAN nötig) ---------- */
function showLogin() { $('#login').hidden = false; }
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await api('POST', '/admin/login', { password: $('#pw').value });
    sessionStorage.setItem(TOKEN_KEY, r.token);
    $('#login').hidden = true;
    $('#loginMsg').textContent = '';
    render();
  } catch (err) { $('#loginMsg').textContent = err.message; }
});

/* ---------- Theme ---------- */
const THEME_KEY = 'vn3:theme';
function applyTheme(v) { if (v === 'light' || v === 'dark') document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme; }
try { applyTheme(localStorage.getItem(THEME_KEY)); } catch { /* privater Modus */ }
$('#themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme;
  const next = cur === 'dark' ? 'light' : cur === 'light' ? 'auto' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* egal */ }
  toast('Design: ' + ({ dark: 'Dunkel', light: 'Hell', auto: 'Automatisch' })[next]);
});

/* ---------- Hilfen ---------- */
let stateCache = null;
async function getState(fresh) { if (!stateCache || fresh) stateCache = await api('GET', '/state'); return stateCache; }
const STATUS_TXT = { green: 'Heute erreichbar', yellow: 'Nur nach Rücksprache', grey: 'Nicht aktuell bestätigt', red: 'Heute nicht verfügbar' };
function effStatus(p, now) {
  if (p.absence && p.absence.from <= now && now <= p.absence.to) return 'red';
  if (!p.status || !p.status.value || !p.status.expiresAt || now > p.status.expiresAt) return 'grey';
  return p.status.value;
}
function select(options, value, testid) {
  const s = h('select', { testid });
  for (const [v, label] of options) s.append(h('option', { value: v }, label));
  if (value != null) s.value = value;
  return s;
}
async function practiceSelect(testid) {
  const st = await getState();
  return select([['', '– zufällig –'], ...st.practices.map((p) => [p.id, p.name])], '', testid);
}
async function chatSelect(testid) {
  const st = await getState();
  return select([['', '– zufällig –'], ...st.chats.map((c) => [c.id, (c.ownerName || c.kind) + ' ↔ ' + ((st.practices.find((p) => p.id === c.practiceId) || {}).name || c.practiceId)])], '', testid);
}
const card = (title, ...kids) => h('section', { class: 'card' }, h('h3', {}, title), ...kids);
const wide = (title, ...kids) => h('section', { class: 'card wide' }, h('h3', {}, title), ...kids);

/* =====================================================================
   TABS
   ===================================================================== */
const TABS = [
  ['uebersicht', 'Übersicht', tabOverview],
  ['geraete', 'Geräte & Sync', tabDevices],
  ['simulation', 'Simulation', tabSimulation],
  ['bot', 'Bot & KI', tabBot],
  ['zeit', 'Zeit & Status', tabTime],
  ['fehler', 'Fehler & Last', tabFaults],
  ['daten', 'Daten', tabData],
  ['vorschau', 'Vorschau', tabPreview],
  ['selbsttest', 'Selbsttest', tabSelftest],
  ['log', 'Live-Log', tabLog],
  ['hilfe', 'Hilfe', tabHelp],
];
let current = (location.hash || '').replace('#', '') || 'uebersicht';
function renderTabs() {
  const nav = $('#tabs');
  nav.replaceChildren(...TABS.map(([id, label]) => h('button', {
    class: 'tab', role: 'tab', 'aria-selected': String(id === current), testid: 'tab-' + id,
    onclick: () => { current = id; location.hash = id; render(); },
  }, label)));
}
async function render() {
  renderTabs();
  const main = $('#main');
  const tab = TABS.find((t) => t[0] === current) || TABS[0];
  main.replaceChildren(h('p', { class: 'muted' }, 'Lade …'));
  try { main.replaceChildren(await tab[2]()); } catch (e) { main.replaceChildren(card('Fehler', h('p', { class: 'err' }, e.message))); }
}
window.addEventListener('hashchange', () => { const id = location.hash.replace('#', ''); if (id && id !== current) { current = id; render(); } });

/* ---------- Übersicht ---------- */
async function tabOverview() {
  const [health, ov] = await Promise.all([api('GET', '/health'), api('GET', '/admin/overview').catch((e) => ({ error: e.message }))]);
  $('#ver').textContent = 'v' + health.version;
  const now = health.serverTime;
  const st = await getState(true);
  const counts = { green: 0, yellow: 0, grey: 0, red: 0 };
  for (const p of st.practices) counts[effStatus(p, now)]++;
  const kv = (obj) => h('dl', { class: 'kv' }, ...Object.entries(obj).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v == null ? '–' : String(v))]));
  return h('div', { class: 'grid' },
    card('Hub', kv({
      Status: health.ok ? 'läuft' : 'Problem', Version: health.version, Protokoll: health.protocol, Modus: health.mode,
      'Laufzeit': Math.round(health.uptimeS / 60) + ' min', Revision: health.rev, 'Verbundene Geräte': health.clients,
      Uhr: new Date(now).toLocaleString('de-AT') + (health.clockOffsetMs ? ' (simuliert)' : ''),
    })),
    card('KI', kv({ Anbieter: health.ai && health.ai.provider, Modell: health.ai && health.ai.model, Bereit: health.ai && health.ai.ok ? 'ja' : 'nein (Bot antwortet)' }),
      action('KI-Schnelltest („Sag Apfel")', 'ov-ai-test', () => api('POST', '/ai/test', {}))),
    card('Praxen (live)',
      h('div', { class: 'row' }, ...Object.entries(counts).map(([k, n]) => h('span', { class: 'pill ' + k }, n + ' · ' + STATUS_TXT[k]))),
      h('p', { class: 'muted' }, st.chats.length + ' Chats · ' + st.appointments.length + ' Termine · ' + st.practices.length + ' Praxen')),
    card('Schnellaktionen',
      action('Selbsttest starten', 'ov-selftest', async () => { current = 'selbsttest'; location.hash = 'selbsttest'; await render(); $('[data-testid="selftest-run"]').click(); }),
      action('Demo-Daten neu laden', 'ov-reset-demo', () => api('POST', '/admin/reset', { seed: 'demo' }), { kind: 'ghost' }),
      action('Notfall-Anfrage simulieren', 'ov-sim-emergency', () => api('POST', '/admin/simulate', { action: 'emergency-request' }))),
    ov.error ? card('Admin', h('p', { class: 'err' }, ov.error)) : wide('Server-Details', h('pre', { class: 'result' }, pretty(ov))),
  );
}

/* ---------- Geräte ---------- */
async function tabDevices() {
  const list = await api('GET', '/clients');
  const rows = (Array.isArray(list) ? list : list.clients || []).map((c) => h('tr', {},
    h('td', {}, ({ web: '💻 Web', ios: '📱 iPhone', android: '🤖 Android', extension: '🧩 Extension', admin: '🛠 Konsole' })[c.platform] || c.platform || '?'),
    h('td', {}, c.name || '–'), h('td', {}, c.version || '–'), h('td', {}, c.via || '–'),
    h('td', {}, c.lastSeen ? fmtTime(c.lastSeen) : '–'), h('td', {}, c.latencyMs != null ? c.latencyMs + ' ms' : ''),
    h('td', {}, ...action('Ping', 'dev-ping-' + c.id, () => api('POST', '/admin/ping', { target: c.id }), { inline: true, kind: 'small ghost' }),
      ...action('Toast', 'dev-toast-' + c.id, () => api('POST', '/admin/broadcast', { kind: 'toast', text: 'Hallo vom Kontrollzentrum 👋', target: c.id }), { inline: true, kind: 'small ghost' })),
  ));
  const text = h('input', { value: 'Test-Nachricht an alle Geräte', size: 36, 'aria-label': 'Text' });
  const kind = select([['toast', 'Toast'], ['notify', 'Benachrichtigung'], ['reload', 'Neu laden'], ['navigate', 'Zu Route navigieren']], 'toast', 'dev-bc-kind');
  const route = h('input', { value: '#/chats', size: 12, 'aria-label': 'Route' });
  const lan = `${location.protocol}//${location.host}`;
  return h('div', { class: 'grid' },
    wide('Verbundene Geräte (' + rows.length + ')',
      rows.length ? h('table', {}, h('thead', {}, h('tr', {}, ...['Plattform', 'Name', 'Version', 'Weg', 'Zuletzt', 'Latenz', 'Test'].map((x) => h('th', {}, x)))), h('tbody', {}, rows))
        : h('p', { class: 'muted' }, 'Noch keine Geräte verbunden. Öffne die Web-App, die Handy-App oder die Extension — sie melden sich hier automatisch.'),
      action('Liste aktualisieren', 'dev-refresh', () => render(), { kind: 'ghost' })),
    card('An alle senden', h('div', { class: 'row' }, kind, text, route),
      action('Senden', 'dev-broadcast', () => api('POST', '/admin/broadcast', { kind: kind.value, text: text.value, route: route.value, target: 'all' }))),
    card('Handy verbinden',
      h('p', {}, 'Web-App am Handy (gleiches WLAN): ', h('code', {}, lan + '/vetnow/')),
      h('p', {}, 'Dieses Kontrollzentrum am Handy: ', h('code', {}, lan + '/konsole/')),
      h('p', { class: 'muted' }, 'Steht hier „localhost", nimm stattdessen die LAN-Adresse aus dem Hub-Fenster (z. B. http://192.168.x.x:8787). Expo-App: im Ordner vetnow-app „npm run mobile" starten und den QR-Code mit der Kamera (iPhone) bzw. Expo Go (Android) scannen.')),
  );
}

/* ---------- Simulation ---------- */
async function tabSimulation() {
  const pSel = await practiceSelect('sim-practice');
  const cSel = await chatSelect('sim-chat');
  const txt = h('input', { placeholder: 'eigener Text (optional)', size: 30, 'aria-label': 'Text' });
  const val = select([['green', 'grün'], ['yellow', 'gelb'], ['red', 'rot']], 'green', 'sim-status-value');
  const n = h('input', { type: 'number', value: 10, min: 1, max: 200, style: 'width:80px', 'aria-label': 'Anzahl' });
  const sim = (a, extra = {}) => () => api('POST', '/admin/simulate', { action: a, practiceId: pSel.value || undefined, chatId: cSel.value || undefined, text: txt.value || undefined, ...extra });
  return h('div', { class: 'grid' },
    wide('Ziel', h('div', { class: 'row' }, 'Praxis ', pSel, ' Chat ', cSel, txt),
      h('p', { class: 'muted' }, 'Alle Aktionen laufen über den Hub und erscheinen sofort auf allen verbundenen Geräten.')),
    card('Anfragen & Nachrichten',
      action('🚨 Notfall-Anfrage', 'sim-emergency', sim('emergency-request')),
      action('📅 Terminanfrage', 'sim-appointment', sim('appointment-request')),
      action('Tierhalter:in schreibt', 'sim-owner-msg', sim('owner-message')),
      action('Praxis schreibt', 'sim-clinic-msg', sim('clinic-message'))),
    card('Sonderfälle',
      action('🖼 Bild-Nachricht', 'sim-image', sim('image-message')),
      action('🧪 XSS-Testnachricht', 'sim-xss', sim('xss-message')),
      action('📜 Sehr lange Nachricht', 'sim-long', sim('long-message')),
      h('div', { class: 'row' }, 'Nachrichten-Burst ', n), action('Burst senden', 'sim-burst', () => api('POST', '/admin/simulate', { action: 'burst', count: Number(n.value), chatId: cSel.value || undefined }))),
    card('Praxis-Status',
      h('div', { class: 'row' }, 'Neuer Status ', val),
      action('Status setzen (gewählte Praxis)', 'sim-status', sim('status', { value: val.value })),
      action('Alle Praxen auf diesen Status', 'sim-status-all', () => api('POST', '/admin/simulate', { action: 'status-all', value: val.value })),
      action('🎲 Zufällige Stati', 'sim-status-random', sim('status-random')),
      action('Status sofort ablaufen lassen', 'sim-expire', sim('expire-status')),
      action('Abwesenheit an', 'sim-absence-on', sim('absence', { on: true })),
      action('Abwesenheit aus', 'sim-absence-off', sim('absence', { on: false }))),
  );
}

/* ---------- Bot & KI ---------- */
async function tabBot() {
  const status = await api('GET', '/ai/status').catch((e) => ({ error: e.message }));
  const settings = await api('GET', '/admin/settings').catch(() => ({}));
  const input = h('textarea', { 'aria-label': 'Testnachricht', testid: 'bot-input' }, 'Mein Hund hat Schokolade gefressen, was soll ich tun?');
  const persona = select([['clinic', 'Praxis antwortet'], ['owner', 'Tierhalter:in antwortet'], ['colleague', 'Kolleg:in (Netzwerk)']], 'clinic', 'bot-persona');
  const provs = (status.providers || []).map((p) => [p.id, p.label + (p.available && p.available.ok === false ? ' (nicht bereit)' : p.ok === false ? ' (nicht bereit)' : '')]);
  const prov = select([['auto', 'Automatisch'], ...provs.filter(([id]) => id !== 'auto')], (settings.ai && settings.ai.provider) || 'auto', 'ai-provider');
  const mode = select([['ai-fallback', 'KI, bei Ausfall Bot (Standard)'], ['ai', 'nur KI (Fehler sichtbar)'], ['bot', 'nur Bot'], ['off', 'keine Auto-Antworten']], settings.botMode || 'ai-fallback', 'bot-mode');
  const stream = h('div', { class: 'result', 'data-testid': 'ai-stream' });
  const suiteOut = h('div');
  return h('div', { class: 'grid' },
    wide('Testnachricht', input, h('div', { class: 'row' }, persona),
      h('div', { class: 'row' },
        ...action('Bot 3.0 fragen', 'bot-ask', () => api('POST', '/bot/reply', { text: input.value, persona: persona.value, practiceName: 'Tierarztpraxis Drautal' }), { inline: true }),
        ...action('KI fragen (Stream)', 'ai-ask', () => aiStream(input.value, persona.value, stream), { inline: true, kind: 'ghost' })),
      stream),
    card('KI-Einstellungen',
      h('div', { class: 'row' }, 'Anbieter ', prov), h('div', { class: 'row' }, 'Antwort-Modus ', mode),
      action('Speichern', 'ai-save', () => api('PUT', '/admin/settings', { botMode: mode.value, ai: { ...(settings.ai || {}), provider: prov.value } })),
      action('Verbindung testen', 'ai-test', () => api('POST', '/ai/test', { provider: prov.value === 'auto' ? undefined : prov.value })),
      h('pre', { class: 'result' }, pretty(status))),
    card('Bot-Regressionstest', h('p', { class: 'muted' }, 'Über 380 deutsche Fälle: Notfälle, Gifte, Dialekt, Tippfehler, Termine, Personas.'),
      action('Regressionstest starten', 'bot-suite', async () => {
        const r = await api('POST', '/bot/suite', {});
        const failed = (r.results || []).filter((x) => !x.ok);
        suiteOut.replaceChildren(failed.length ? h('table', {}, h('tbody', {}, failed.slice(0, 50).map((f) => h('tr', {}, h('td', {}, f.id), h('td', {}, (f.problems || []).join('; ')))))) : h('p', { class: 'ok' }, 'Alle Fälle bestanden.'));
        return { bestanden: r.passed, fehlgeschlagen: r.failed, gesamt: r.total };
      }), suiteOut),
  );
}
async function aiStream(text, persona, out) {
  out.textContent = '';
  const t0 = performance.now();
  const res = await fetch(API + '/ai/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: text }], persona, stream: true }) });
  if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'HTTP ' + res.status); }
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; let done = null;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const d = JSON.parse(line.slice(5));
      if (d.delta) out.textContent += d.delta;
      if (d.done) done = d;
      if (d.error) throw new Error(d.error);
    }
  }
  return done ? { anbieter: done.provider, modell: done.model, dauer: fmtMs(performance.now() - t0) } : undefined;
}

/* ---------- Zeit & Status ---------- */
async function tabTime() {
  const st = await getState(true);
  const health = await api('GET', '/health');
  const now = health.serverTime;
  const dt = h('input', { type: 'datetime-local', 'aria-label': 'Datum und Uhrzeit' });
  const clock = (body) => async () => { const r = await api('POST', '/admin/clock', body); stateCache = null; setTimeout(render, 300); return r; };
  const rows = st.practices.map((p) => {
    const e = effStatus(p, now);
    const left = p.status && p.status.expiresAt ? p.status.expiresAt - now : null;
    return h('tr', {}, h('td', {}, p.name), h('td', {}, h('span', { class: 'pill ' + e }, STATUS_TXT[e])),
      h('td', {}, left == null ? '–' : left > 0 ? 'läuft ab in ' + Math.floor(left / 3600000) + ' h ' + Math.floor((left % 3600000) / 60000) + ' min' : 'abgelaufen'),
      h('td', {}, ...['green', 'yellow', 'red'].flatMap((v) => action(v === 'green' ? 'grün' : v === 'yellow' ? 'gelb' : 'rot', `st-${p.id}-${v}`,
        async () => { const r = await api('POST', `/practices/${p.id}/status`, { value: v, hours: 24 }); stateCache = null; return r.practice ? 'gesetzt' : r; }, { inline: true, kind: 'small ghost' }))));
  });
  return h('div', { class: 'grid' },
    card('Uhr simulieren', h('p', {}, 'Hub-Zeit: ', h('b', {}, new Date(now).toLocaleString('de-AT')), health.clockOffsetMs ? ' (verschoben um ' + Math.round(health.clockOffsetMs / 60000) + ' min)' : ''),
      h('div', { class: 'row' }, dt, ...action('Setzen', 'clock-set', clock({ iso: dt.value ? new Date(dt.value).toISOString() : undefined }), { inline: true })),
      h('div', { class: 'row' }, ...action('+1 h', 'clock-1h', clock({ addMs: 3600000 }), { inline: true, kind: 'ghost' }),
        ...action('+24 h', 'clock-24h', clock({ addMs: 86400000 }), { inline: true, kind: 'ghost' }),
        ...action('+25 h (Status wird grau)', 'clock-25h', clock({ addMs: 90000000 }), { inline: true, kind: 'ghost' }),
        ...action('Echte Zeit', 'clock-reset', clock({ reset: true }), { inline: true, kind: 'warn' }))),
    wide('Praxis-Status (live, 24-Stunden-Regel)', h('table', {}, h('tbody', {}, rows))),
  );
}

/* ---------- Fehler & Last ---------- */
async function tabFaults() {
  const dur = select([['15000', '15 Sekunden'], ['60000', '1 Minute'], ['300000', '5 Minuten']], '15000', 'fault-duration');
  const fault = (kind) => () => api('POST', '/admin/fault', { kind, durationMs: Number(dur.value) });
  return h('div', { class: 'grid' },
    card('Fehler-Injektion (Hub)', h('div', { class: 'row' }, 'Dauer ', dur),
      h('p', { class: 'muted' }, 'Damit prüfst du, ob die Apps sauber reagieren: „Offline" → Apps zeigen „Lokal/Offline" und puffern; „KI offline" → der Bot springt ein.'),
      action('Hub „offline"', 'fault-offline', fault('offline'), { kind: 'warn' }),
      action('Langsam (+2 s)', 'fault-slow', fault('slow')),
      action('KI offline', 'fault-ai-offline', fault('ai-offline')),
      action('Zufällige 500-Fehler', 'fault-error500', fault('error500')),
      action('Alle Fehler beenden', 'fault-clear', () => api('POST', '/admin/fault', { clear: true }), { kind: 'ghost' })),
    card('Last', action('100 Nachrichten in einen Chat', 'load-burst', () => api('POST', '/admin/simulate', { action: 'burst', count: 100 })),
      action('Toast an alle', 'load-toast', () => api('POST', '/admin/broadcast', { kind: 'toast', text: 'Lasttest läuft', target: 'all' }))),
  );
}

/* ---------- Daten ---------- */
async function tabData() {
  const file = h('input', { type: 'file', accept: 'application/json', 'aria-label': 'JSON-Datei' });
  return h('div', { class: 'grid' },
    card('Zurücksetzen',
      action('Demo-Daten laden (18 Praxen, Chats, Termine)', 'data-reset-demo', () => api('POST', '/admin/reset', { seed: 'demo' })),
      action('Leer starten (saubere Version)', 'data-reset-empty', () => api('POST', '/admin/reset', { seed: 'empty' }), { kind: 'warn' })),
    card('Export / Import',
      action('Zustand als JSON herunterladen', 'data-export', async () => {
        const data = await api('GET', '/admin/export');
        const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: 'vetnow-hub-export.json' });
        a.click(); return 'Download gestartet';
      }),
      h('div', { class: 'row' }, file),
      action('JSON importieren', 'data-import', async () => {
        if (!file.files[0]) throw new Error('Bitte zuerst eine Datei wählen.');
        return api('POST', '/admin/import', JSON.parse(await file.files[0].text()));
      })),
    wide('Rohdaten (Auszug)', action('Zustand anzeigen', 'data-show', async () => {
      const s = await getState(true);
      return { rev: s.rev, praxen: s.practices.length, chats: s.chats.map((c) => ({ id: c.id, art: c.kind, nachrichten: c.messages.length })), termine: s.appointments.length };
    })),
  );
}

/* ---------- Vorschau ---------- */
async function tabPreview() {
  const route = select([['', 'Start'], ['#/suche', 'Notfall-Suche'], ['#/chats', 'Chats'], ['?screen=results', 'Ergebnisse'], ['?screen=dashboard', 'Praxis-Dashboard'], ['?screen=extension', 'Extension-Vorschau']], '', 'prev-route');
  const box = h('div', { class: 'frames' });
  const DEV = [['iPhone', 390, 844], ['Android', 412, 915], ['Tablet', 768, 1024], ['Desktop', 1280, 800]];
  const draw = () => box.replaceChildren(...DEV.map(([name, w, hh]) => {
    const scale = Math.min(1, 380 / hh);
    return h('div', {}, h('div', { class: 'frame', style: `width:${w * scale + 20}px;height:${hh * scale + 20}px` },
      h('iframe', { src: '/vetnow/' + route.value, title: name, style: `width:${w}px;height:${hh}px;transform:scale(${scale});transform-origin:0 0` })),
      h('div', { class: 'frame-label' }, `${name} · ${w}×${hh}`));
  }));
  route.addEventListener('change', draw);
  draw();
  return h('div', { class: 'grid' }, wide('Geräte-Vorschau', h('div', { class: 'row' }, 'Seite ', route), box));
}

/* ---------- Selbsttest ---------- */
async function tabSelftest() {
  const out = h('div', { 'data-testid': 'selftest-out' });
  const run = async () => {
    const results = [];
    const check = async (name, fn) => {
      const t0 = performance.now();
      try { const d = await fn(); results.push({ name, ok: true, ms: performance.now() - t0, detail: d || '' }); } catch (e) { results.push({ name, ok: false, ms: performance.now() - t0, detail: e.message }); }
      draw();
    };
    const draw = () => out.replaceChildren(h('table', {}, h('tbody', {}, results.map((r) => h('tr', {},
      h('td', { class: r.ok ? 'ok' : 'bad' }, r.ok ? '✔' : '✘'), h('td', {}, r.name), h('td', {}, fmtMs(r.ms)), h('td', { class: 'muted' }, typeof r.detail === 'string' ? r.detail : pretty(r.detail)))))));
    window.__vnSelftest = { done: false, results };
    await check('Hub erreichbar (/health)', async () => { const x = await api('GET', '/health'); if (!x.ok) throw new Error('nicht ok'); return 'v' + x.version; });
    const server = await api('GET', '/admin/selftest').catch((e) => [{ name: 'Server-Selbsttest', ok: false, detail: e.message }]);
    for (const s of (Array.isArray(server) ? server : server.results || [])) results.push({ name: 'Hub: ' + s.name, ok: !!s.ok, ms: s.ms || 0, detail: s.detail || '' });
    draw();
    await check('Live-Events (SSE) kommen an', async () => {
      const p = waitForEvent((t) => t === 'message', 8000);
      await api('POST', '/admin/simulate', { action: 'owner-message', text: 'Selbsttest ' + new Date().toLocaleTimeString('de-AT') });
      await p; return 'message-Event empfangen';
    });
    await check('Status-Änderung wird live verteilt', async () => {
      const st = await getState(true); const p0 = st.practices[0];
      const wait = waitForEvent((t, d) => t === 'practice' && d && d.practice && d.practice.id === p0.id, 8000);
      await api('POST', `/practices/${p0.id}/status`, { value: 'green', hours: 24 }); await wait; return p0.name + ' → grün';
    });
    await check('Anfrage landet im Praxis-Posteingang', async () => {
      const r = await api('POST', '/requests', { practiceId: 'drautal', ownerName: 'Selbsttest', animal: 'dog', petName: 'Testi', situation: 'regular', message: 'Selbsttest-Anfrage' });
      const st = await getState(true); if (!st.chats.some((c) => c.id === r.chat.id && c.practiceId === 'drautal')) throw new Error('Chat fehlt'); return r.chat.id;
    });
    await check('Bot 3.0 erkennt Vergiftung', async () => { const r = await api('POST', '/bot/reply', { text: 'Hund hat Rattengift gefressen', persona: 'clinic' }); if (!/sofort|anrufen/i.test((r.texts || []).join(' '))) throw new Error('keine Sofort-Anweisung'); return r.triage && r.triage.level; });
    await check('Bot-Regressionstest', async () => { const r = await api('POST', '/bot/suite', {}); if (r.failed) throw new Error(r.failed + ' Fälle rot'); return r.passed + '/' + r.total; });
    await check('KI antwortet (oder Bot-Fallback)', async () => { const r = await api('POST', '/ai/test', {}).catch((e) => ({ ok: false, error: e.message })); return r.ok ? (r.provider + ': ' + r.text) : 'keine KI verbunden → Bot übernimmt (' + (r.error || r.code || 'offline') + ')'; });
    await check('Datei-Upload & Download', async () => {
      const body = new Blob(['VetNow Selbsttest'], { type: 'text/plain' });
      const up = await fetch(API + '/files', { method: 'POST', headers: { 'content-type': 'text/plain', 'x-filename': 'selbsttest.txt' }, body }).then((r) => r.json());
      const txt = await fetch(API + '/files/' + up.id).then((r) => r.text()); if (txt !== 'VetNow Selbsttest') throw new Error('Inhalt falsch'); return up.id;
    });
    await check('XSS-Nachricht bleibt Text', async () => { await api('POST', '/admin/simulate', { action: 'xss-message' }); if (document.querySelector('img[src="x"]')) throw new Error('HTML wurde ausgeführt'); return 'sicher'; });
    const failed = results.filter((r) => !r.ok).length;
    window.__vnSelftest = { done: true, passed: results.length - failed, failed, results };
    return (results.length - failed) + ' von ' + results.length + ' grün';
  };
  const copy = action('Bericht kopieren (Markdown)', 'selftest-copy', async () => {
    const r = (window.__vnSelftest && window.__vnSelftest.results) || [];
    const md = '| | Test | Dauer | Details |\n|---|---|---|---|\n' + r.map((x) => `| ${x.ok ? '✔' : '✘'} | ${x.name} | ${fmtMs(x.ms)} | ${String(typeof x.detail === 'string' ? x.detail : JSON.stringify(x.detail)).replace(/\|/g, '/')} |`).join('\n');
    await navigator.clipboard.writeText(md); return 'kopiert';
  }, { kind: 'ghost' });
  return h('div', { class: 'grid' }, wide('Selbsttest (Hub + Live-Sync + Bot + KI)', action('Selbsttest starten', 'selftest-run', run), copy, out));
}

/* ---------- Live-Log ---------- */
async function tabLog() {
  const box = h('div', { class: 'log', 'data-testid': 'log' });
  let paused = false;
  const draw = () => { if (!paused) box.replaceChildren(...logLines.slice(0, 200).map((l) => h('div', {}, fmtTime(l.ts) + '  ' + l.t + '  ' + JSON.stringify(l.payload).slice(0, 220)))); };
  const fn = () => draw();
  listeners.add(fn);
  const srv = h('div', { class: 'log' });
  draw();
  return h('div', { class: 'grid' },
    wide('Live-Events', h('div', { class: 'row' },
      h('button', { class: 'btn ghost', testid: 'log-pause', onclick: (e) => { paused = !paused; e.target.textContent = paused ? 'Fortsetzen' : 'Pause'; } }, 'Pause'),
      h('button', { class: 'btn ghost', testid: 'log-clear', onclick: () => { logLines.length = 0; draw(); } }, 'Leeren')), box),
    wide('Server-Log (Anfragen)', action('Laden', 'log-server', async () => {
      const r = await api('GET', '/admin/log');
      const items = Array.isArray(r) ? r : r.entries || r.items || [];
      srv.replaceChildren(...items.slice(-150).reverse().map((e) => h('div', {}, (e.ts ? fmtTime(e.ts) + '  ' : '') + [e.method, e.path, e.status, e.ms != null ? e.ms + ' ms' : '', e.client || '', e.msg || e.message || e.type || ''].filter(Boolean).join('  '))));
      return items.length + ' Einträge';
    }), srv),
  );
}

/* ---------- Hilfe ---------- */
async function tabHelp() {
  const lan = `${location.protocol}//${location.host}`;
  const li = (...x) => h('li', {}, ...x);
  return h('div', { class: 'grid' },
    card('PC', h('ol', {}, li('Doppelklick auf ', h('code', {}, 'START-VETNOW.bat'), ' im Ordner 00_NEU.'), li('Web-App: ', h('code', {}, lan + '/vetnow/')), li('Kontrollzentrum: ', h('code', {}, lan + '/konsole/')))),
    card('iPhone', h('ol', {}, li('Gleiches WLAN wie der PC.'), li('Safari: ', h('code', {}, 'http://<PC-IP>:8787/vetnow/'), ' → Teilen → „Zum Home-Bildschirm".'), li('Oder native App: „npm run mobile" starten, QR-Code mit der Kamera scannen (Expo Go, SDK 57).'))),
    card('Android', h('ol', {}, li('Chrome: ', h('code', {}, 'http://<PC-IP>:8787/vetnow/'), ' → „App installieren".'), li('Oder Expo Go (SDK 57) → QR-Code scannen.'))),
    card('Extension', h('ol', {}, li('Chrome/Edge: chrome://extensions → Entwicklermodus → „Entpackte Erweiterung laden" → Ordner ', h('code', {}, 'vetnow-app/extension'), '.'), li('Firefox: im Ordner vetnow-app „npm run build:firefox", dann about:debugging → „Temporäres Add-on laden" → dist/extension-firefox/manifest.json.'), li('In den Optionen der Extension die Hub-Adresse prüfen (Standard http://localhost:8787).'))),
    card('Testen mit Claude', h('p', {}, 'Jeder Knopf hat ein ', h('code', {}, 'data-testid'), '. Nach dem Selbsttest steht das Ergebnis in ', h('code', {}, 'window.__vnSelftest'), '.')),
  );
}

/* ---------- Start ---------- */
connectEvents();
render();
