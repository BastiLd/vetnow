/* VetNow Kärnten – Praxis (Extension v3).
   Neu gegenüber v1:
   - LIVE mit dem VetNow Hub: Status, Termine und Anfragen sind dieselben wie in Web-App und Handy-App.
     Ohne Hub läuft die Extension wie bisher mit Demo-Daten (lokaler Modus).
   - Sicher: Texte von Tierhalter:innen werden nur per textContent angezeigt (vorher innerHTML → HTML-Injection).
   - Behoben: jede Antwort hat den ganzen Chat doppelt angehängt; unbekannter Status → leeres Popup;
     der Countdown hat jede Sekunde die ganze Ansicht neu gebaut (Klicks gingen verloren).
   - Status-Texte kommen aus dem gemeinsamen Kern (shared/) → überall gleich. */
import { STATUS } from './shared/constants.js';
import { effectiveStatus } from './shared/status.js';

const api = globalThis.browser ?? globalThis.chrome;
const D = window.VN_EXT_DATA;
const DAY = 24 * 60 * 60 * 1000;
const view = document.getElementById('view');

/* ---------- Speicher (chrome.storage.local, im normalen Browser-Tab localStorage) ---------- */
const store = {
  async get(keys) {
    if (api && api.storage) return api.storage.local.get(keys);
    const o = {}; for (const k of keys) { try { const v = localStorage.getItem('vn-ext:' + k); if (v != null) o[k] = JSON.parse(v); } catch { /* egal */ } } return o;
  },
  async set(obj) {
    if (api && api.storage) return api.storage.local.set(obj);
    for (const [k, v] of Object.entries(obj)) { try { localStorage.setItem('vn-ext:' + k, JSON.stringify(v)); } catch { /* egal */ } }
  },
};

/* ---------- DOM-Hilfe: niemals innerHTML mit Daten ---------- */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.setAttribute('style', v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}
const pad = (n) => String(n).padStart(2, '0');
const fmtCountdown = (ms) => { if (ms <= 0) return '00:00:00'; const s = Math.floor(ms / 1000); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60); };
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
const todayIso = () => { const d = new Date(Date.now() + S.clockOffsetMs); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const statusOf = (key) => STATUS[key] || STATUS.grey; // unbekannter Wert → grau statt Absturz

/* ---------- Zustand ---------- */
const S = {
  hub: '', online: false, practiceId: 'drautal', practice: null, clockOffsetMs: 0,
  chats: [], appts: [], view: 'status', openChat: null, openAppt: null, local: null, lastSync: 0, error: '',
};

async function hubFetch(path, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout || 5000);
  try {
    const res = await fetch(S.hub + '/api/v1' + path, { ...opts, signal: ctrl.signal, headers: { 'content-type': 'application/json', 'x-vn-client': 'extension-popup' } });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || 'HTTP ' + res.status);
    return data;
  } finally { clearTimeout(t); }
}

async function loadHub() {
  try {
    const st = await hubFetch('/state');
    S.online = true; S.error = ''; S.lastSync = Date.now();
    S.clockOffsetMs = st.clockOffsetMs || 0;
    S.practice = st.practices.find((p) => p.id === S.practiceId) || st.practices[0] || null;
    if (S.practice) S.practiceId = S.practice.id;
    S.chats = st.chats.filter((c) => c.practiceId === S.practiceId && c.kind !== 'network')
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    S.appts = st.appointments.filter((a) => a.practiceId === S.practiceId);
    await store.set({ lastSnapshot: { at: S.lastSync, practice: S.practice, chats: S.chats, appts: S.appts } });
  } catch (e) {
    S.online = false; S.error = e.message;
  }
}

/* Lokaler Demo-Modus: v1-Status (picked/expiry) weiter nutzen und in das v3-Format übersetzen. */
async function loadLocal() {
  const got = await store.get(['picked', 'expiry', 'localReplies', 'lastSnapshot']);
  const value = ['green', 'yellow', 'red'].includes(got.picked) ? got.picked : null;
  S.local = { value, expiry: got.expiry || 0, replies: got.localReplies || {} };
  S.practice = { id: 'drautal', name: 'Tierarztpraxis Drautal', status: { value, setAt: value ? got.expiry - DAY : null, expiresAt: got.expiry || null }, absence: null };
  // letzter Stand vom Hub (falls einmal verbunden) ist besser als nichts
  if (got.lastSnapshot && got.lastSnapshot.chats) { S.chats = got.lastSnapshot.chats; S.appts = got.lastSnapshot.appts || []; S.lastSync = got.lastSnapshot.at; }
  else {
    S.chats = D.CONVERSATIONS.map((c) => ({
      id: c.id, kind: 'request', ownerName: c.owner, animal: c.animal, unread: { clinic: c.unread || 0 },
      messages: c.messages.map((m, i) => ({ id: c.id + '-' + i, from: m.from || 'system', type: m.type || 'text', text: m.text, ts: 0, time: m.time })),
    }));
    S.appts = D.APPOINTMENTS.map((a, i) => ({ id: 'demo-' + i, date: todayIso(), ...a }));
  }
}

/* ---------- Kopfzeile ---------- */
function renderHead() {
  const eff = S.practice ? effectiveStatus(S.practice, Date.now() + S.clockOffsetMs) : 'grey';
  const st = statusOf(eff);
  const mini = document.getElementById('statusMini');
  mini.style.setProperty('--c', st.color || '#94a39f');
  document.getElementById('statusMiniLabel').textContent = st.short || st.long;
  let live = document.getElementById('livePill');
  if (!live) { live = h('span', { id: 'livePill', class: 'live-pill' }); document.querySelector('.head').append(live); }
  live.textContent = S.online ? 'Live' : (S.lastSync ? 'Offline' : 'Lokal');
  live.className = 'live-pill' + (S.online ? ' on' : '');
  live.title = S.online ? 'Mit dem VetNow Hub verbunden: ' + S.hub : (S.lastSync ? 'Hub nicht erreichbar – letzter Stand ' + fmtTime(S.lastSync) : 'Kein Hub – Demo-Daten');
  const unread = S.chats.reduce((n, c) => n + ((c.unread && c.unread.clinic) || 0), 0);
  const b = document.getElementById('navBadge');
  b.style.display = unread ? 'grid' : 'none';
  b.textContent = String(unread);
}

/* ---------- Status ---------- */
let countdownEl = null;
function renderStatus() {
  const now = Date.now() + S.clockOffsetMs;
  const p = S.practice;
  const eff = p ? effectiveStatus(p, now) : 'grey';
  const exp = p && p.status && p.status.expiresAt;
  countdownEl = h('div', { class: 'countdown', 'aria-live': 'off' }, exp ? fmtCountdown(exp - now) : '--:--:--');
  const pick = (value) => h('button', {
    class: 'status-btn' + (p && p.status && p.status.value === value && eff === value ? ' is-on' : ''), 'aria-pressed': String(eff === value),
    onclick: () => setStatus(value),
  }, h('span', { class: 'dot', style: 'background:' + statusOf(value).color }), statusOf(value).short);
  view.replaceChildren(
    h('div', { class: 'section-title' }, p ? p.name : 'Praxis'),
    h('div', { class: 'status-now', style: '--c:' + statusOf(eff).color }, h('span', { class: 'dot' }), statusOf(eff).long),
    h('div', { class: 'status-row' }, pick('green'), pick('yellow'), pick('red')),
    h('div', { class: 'count-box' }, h('div', { class: 'muted' }, eff === 'grey' ? 'Status nicht bestätigt' : 'Gültig noch'), countdownEl),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => setStatus(p && p.status && p.status.value ? p.status.value : 'green') }, 'Status für 24 Stunden bestätigen'),
    h('p', { class: 'hint' }, S.online ? 'Änderungen erscheinen sofort in der Web-App und auf dem Handy.' : 'Lokaler Modus: Änderungen gelten nur in dieser Extension. Hub-Adresse in den Optionen einstellen.'),
    h('div', { class: 'row-2' },
      h('button', { class: 'btn btn-secondary btn-sm', onclick: openWeb }, 'Vollansicht öffnen'),
      h('button', { class: 'btn btn-secondary btn-sm', onclick: () => (api && api.runtime ? api.runtime.openOptionsPage() : null) }, 'Optionen')),
  );
}

async function setStatus(value) {
  if (S.online) {
    try { const r = await hubFetch(`/practices/${S.practiceId}/status`, { method: 'POST', body: JSON.stringify({ value, hours: 24 }) }); S.practice = r.practice || S.practice; await loadHub(); }
    catch (e) { S.error = e.message; }
  } else {
    const expiry = Date.now() + DAY;
    await store.set({ picked: value, expiry });
    S.practice = { ...S.practice, status: { value, setAt: Date.now(), expiresAt: expiry } };
  }
  if (api && api.runtime) api.runtime.sendMessage({ type: 'vn:refresh' }).catch?.(() => {});
  render();
}

/* ---------- Termine ---------- */
function renderAppts() {
  const iso = todayIso();
  const list = S.appts.filter((a) => a.date === iso).sort((a, b) => a.time.localeCompare(b.time));
  if (S.openAppt) {
    const a = S.appts.find((x) => x.id === S.openAppt);
    if (a) {
      const note = h('textarea', { class: 'input', placeholder: 'Abschlussnotiz für die Tierhalter:in (optional)', 'aria-label': 'Abschlussnotiz' });
      view.replaceChildren(
        h('button', { class: 'back', onclick: () => { S.openAppt = null; render(); } }, '‹ Zurück'),
        h('div', { class: 'appt-detail' }, h('b', {}, a.time + ' · ' + a.name), h('div', { class: 'muted' }, a.reason || ''),
          h('span', { class: 'appt-tag ' + ((D.APPT_STATUS[a.status] || {}).cls || '') }, (D.APPT_STATUS[a.status] || { label: a.status }).label)),
        note,
        h('div', { class: 'row-3' },
          h('button', { class: 'btn btn-secondary btn-sm', onclick: () => apptUpdate(a, { status: 'confirmed' }) }, 'Bestätigen'),
          h('button', { class: 'btn btn-primary btn-sm', onclick: () => apptUpdate(a, { status: 'done', note: note.value.trim() || undefined }) }, 'Abschließen'),
          h('button', { class: 'btn btn-secondary btn-sm', onclick: () => apptUpdate(a, { status: 'cancelled' }) }, 'Absagen')),
      );
      return;
    }
  }
  const d = new Date(iso + 'T12:00:00');
  view.replaceChildren(
    h('div', { class: 'section-title' }, 'Heute · ' + d.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: 'short' })),
    list.length ? h('div', { class: 'appt-list' }, list.map((a) => h('button', { class: 'appt', onclick: () => { S.openAppt = a.id; render(); } },
      h('span', { class: 'appt-time' }, a.time), h('span', { class: 'appt-emoji' }, D.ANIMAL_EMOJI[a.animal] || '🐾'),
      h('span', { class: 'appt-main' }, h('b', {}, a.name), h('span', { class: 'muted' }, a.reason || '')),
      h('span', { class: 'appt-tag ' + ((D.APPT_STATUS[a.status] || {}).cls || '') }, (D.APPT_STATUS[a.status] || { label: a.status }).label))))
      : h('p', { class: 'muted' }, 'Heute keine Termine.'),
    h('button', { class: 'btn btn-secondary btn-block btn-sm', onclick: () => openWeb('dashboard') }, 'Kalender in der Web-App öffnen'),
  );
}

async function apptUpdate(a, patch) {
  if (S.online && !String(a.id).startsWith('demo-')) {
    try { await hubFetch('/appointments/' + a.id, { method: 'PATCH', body: JSON.stringify(patch) }); await loadHub(); } catch (e) { S.error = e.message; }
  } else Object.assign(a, patch);
  S.openAppt = null;
  render();
}

/* ---------- Nachrichten ---------- */
function msgBubble(m) {
  if (m.type === 'note') return h('div', { class: 'note' }, h('b', {}, 'Abschlussnotiz'), h('div', {}, m.text || ''));
  const mine = m.from === 'clinic';
  let body;
  if (m.type === 'image') {
    const ref = m.attachment && m.attachment.ref;
    const src = ref && ref.startsWith('hub:') && S.hub ? S.hub + '/api/v1/files/' + encodeURIComponent(ref.slice(4)) : (ref && ref.startsWith('data:image/') ? ref : m.src);
    body = src ? h('img', { src, alt: 'Bild', class: 'msg-img' }) : h('span', {}, '📷 Bild');
  } else body = h('span', {}, m.deleted ? 'Nachricht gelöscht' : (m.text || ''));
  const stamp = m.source === 'ai' || m.source === 'ai-vision' ? ' · KI' : m.source === 'bot' ? ' · Bot' : m.source === 'mock-ai' ? ' · Test-KI' : '';
  return h('div', { class: 'bubble-row' + (mine ? ' me' : '') }, h('div', { class: 'bubble' + (mine ? ' me' : '') }, body,
    h('div', { class: 'bubble-time' }, (m.ts ? fmtTime(m.ts) : (m.time || '')) + stamp)));
}

function renderMessages() {
  if (S.openChat) {
    const c = S.chats.find((x) => x.id === S.openChat);
    if (c) {
      const input = h('input', { class: 'input', placeholder: 'Antwort schreiben …', 'aria-label': 'Antwort', maxlength: '2000' });
      const send = async (text) => {
        text = (text || '').trim(); if (!text) return;
        if (S.online && !D.CONVERSATIONS.some((x) => x.id === c.id)) {
          try { await hubFetch(`/chats/${c.id}/messages`, { method: 'POST', body: JSON.stringify({ from: 'clinic', type: 'text', text, clientMsgId: 'ext-' + Date.now() }) }); await loadHub(); }
          catch (e) { S.error = e.message; }
        } else c.messages.push({ id: 'l-' + Date.now(), from: 'clinic', type: 'text', text, ts: Date.now() });
        render();
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) send(input.value); });
      const scroll = h('div', { class: 'chat-scroll' }, c.messages.map(msgBubble));
      view.replaceChildren(
        h('button', { class: 'back', onclick: () => { S.openChat = null; render(); } }, '‹ Alle Nachrichten'),
        h('div', { class: 'section-title' }, (c.ownerName || 'Anfrage') + (c.petName ? ' · ' + c.petName : '')),
        scroll,
        h('div', { class: 'quick' }, ['Gerne, kommen Sie vorbei.', 'Bitte kurz anrufen.', 'Wir melden uns gleich.'].map((q) => h('button', { class: 'chip', onclick: () => send(q) }, q))),
        h('div', { class: 'compose' }, input, h('button', { class: 'btn btn-primary btn-sm', 'aria-label': 'Senden', onclick: () => send(input.value) }, 'Senden')),
      );
      scroll.scrollTop = scroll.scrollHeight;
      input.focus();
      if (S.online && c.unread && c.unread.clinic) hubFetch(`/chats/${c.id}/read`, { method: 'POST', body: JSON.stringify({ side: 'clinic' }) }).catch(() => {});
      return;
    }
  }
  view.replaceChildren(
    h('div', { class: 'section-title' }, 'Posteingang'),
    S.chats.length ? h('div', { class: 'msg-list' }, S.chats.map((c) => {
      const last = c.messages[c.messages.length - 1] || {};
      const unread = (c.unread && c.unread.clinic) || 0;
      return h('button', { class: 'msg-item', onclick: () => { S.openChat = c.id; render(); } },
        h('span', { class: 'appt-emoji' }, D.ANIMAL_EMOJI[c.animal] || '🐾'),
        h('span', { class: 'appt-main' }, h('b', {}, c.ownerName || 'Anfrage'), h('span', { class: 'muted ellipsis' }, last.type === 'image' ? '📷 Bild' : (last.text || ''))),
        unread ? h('span', { class: 'badge-inline' }, String(unread)) : null);
    })) : h('p', { class: 'muted' }, 'Keine Nachrichten.'),
  );
}

/* ---------- Vollansicht ---------- */
async function openWeb(screen) {
  const got = await store.get(['webUrl']);
  const base = got.webUrl || (S.online ? S.hub + '/vetnow/' : D.WEB_URL);
  const url = base + (screen === 'dashboard' || !screen || typeof screen !== 'string' ? '?screen=dashboard' : '');
  if (api && api.tabs) api.tabs.create({ url }); else window.open(url, '_blank', 'noopener');
}

/* ---------- Navigation & Takt ---------- */
function render() {
  renderHead();
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('is-on', b.dataset.view === S.view));
  if (S.view === 'appts') renderAppts(); else if (S.view === 'messages') renderMessages(); else renderStatus();
}
document.getElementById('nav').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]'); if (!b) return;
  S.view = b.dataset.view; S.openChat = null; S.openAppt = null; render();
});
// Nur den Countdown-Text jede Sekunde aktualisieren — nicht die ganze Ansicht.
setInterval(() => {
  if (!countdownEl || S.view !== 'status' || !S.practice) return;
  const exp = S.practice.status && S.practice.status.expiresAt;
  countdownEl.textContent = exp ? fmtCountdown(exp - (Date.now() + S.clockOffsetMs)) : '--:--:--';
}, 1000);

(async function init() {
  try {
    const cfg = await store.get(['hubUrl', 'practiceId']);
    S.hub = (cfg.hubUrl || 'http://localhost:8787').replace(/\/+$/, '');
    S.practiceId = cfg.practiceId || 'drautal';
    await loadHub();
    if (!S.online) await loadLocal();
    render();
    // Offenes Popup alle 5 s auffrischen (Live-Gefühl), ohne Eingaben zu zerstören.
    setInterval(async () => {
      const typing = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && document.activeElement.value;
      if (typing) return;
      const before = JSON.stringify([S.practice && S.practice.status, S.chats.map((c) => [c.id, c.messages.length, c.unread])]);
      await loadHub();
      if (!S.online && !S.local) await loadLocal();
      const after = JSON.stringify([S.practice && S.practice.status, S.chats.map((c) => [c.id, c.messages.length, c.unread])]);
      if (before !== after) render(); else renderHead();
    }, 5000);
  } catch (e) {
    view.replaceChildren(h('p', { class: 'muted' }, 'Fehler beim Laden: ' + e.message));
  }
})();
