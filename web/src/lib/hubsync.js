/* VetNow v3 — Live-Verbindung der Web-App zum VetNow Hub.

   Warum: Bisher war jedes Gerät eine Insel. Ist ein Hub erreichbar (PC mit START-VETNOW.bat,
   ZimaOS-Studio oder `npm run dev`), übernimmt die Web-App von dort LIVE den Praxis-Status
   (24-Stunden-Regel, Abwesenheit), schickt Status-Bestätigungen und Anfragen dorthin und
   reagiert auf Befehle aus dem Kontrollzentrum (Toast, Neu laden, Ping).
   Ohne Hub (z. B. GitHub Pages) passiert einfach nichts — die App läuft lokal weiter wie bisher. */
import React from 'react';
import { withLiveStatus } from '../../../shared/status.js';
import { APP_VERSION } from '../../../shared/version.js';

const API = '/api/v1';
const state = { status: 'off', practices: [], chats: [], typing: {}, rev: 0, clockOffsetMs: 0, clientId: '', devices: 0, error: '' };
const listeners = new Set();
let snapshot = { ...state };
let es = null;
let started = false;
let retryMs = 2000;
let onBroadcast = null;

function emit() { snapshot = { ...state }; listeners.forEach((fn) => fn()); }

/* Nur auf Herkünften versuchen, die überhaupt einen Hub haben können: GitHub Pages ist HTTPS
   und darf kein http-LAN ansprechen (Mixed Content) — dort bleibt die App lokal. */
function hubPossible() {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;
  return !/\.github\.io$/i.test(location.hostname) && location.protocol.startsWith('http');
}

async function getJson(path, opts) {
  const res = await fetch(API + path, { ...opts, headers: { 'content-type': 'application/json', 'x-vn-client': state.clientId || 'web', ...(opts && opts.headers) } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || 'HTTP ' + res.status);
  return data;
}

async function loadState() {
  const s = await getJson('/state');
  state.practices = s.practices || [];
  state.chats = s.chats || [];
  state.rev = s.rev || 0;
  state.clockOffsetMs = s.clockOffsetMs || 0;
  emit();
}

function connect() {
  if (!hubPossible()) return;
  state.status = 'connecting';
  emit();
  fetch(API + '/health', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then((h) => {
      if (!h || h.name !== 'VetNow Hub') throw new Error('kein VetNow Hub');
      state.clockOffsetMs = h.clockOffsetMs || 0;
      return loadState();
    })
    .then(() => {
      const name = /iPhone|iPad/.test(navigator.userAgent) ? 'Safari (iPhone)' : /Android/.test(navigator.userAgent) ? 'Chrome (Android)' : 'Browser';
      es = new EventSource(`${API}/events?platform=web&name=${encodeURIComponent('Web-App · ' + name)}&version=${APP_VERSION}`);
      es.onopen = () => { state.status = 'online'; state.error = ''; retryMs = 2000; emit(); };
      es.onmessage = (ev) => { try { handle(JSON.parse(ev.data)); } catch { /* kaputtes Event ignorieren */ } };
      es.onerror = () => {
        state.status = 'offline';
        emit();
        if (es) { es.close(); es = null; }
        setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 30000);
      };
    })
    .catch((e) => {
      // Kein Hub da → still lokal bleiben, aber gelegentlich erneut versuchen (Hub wird evtl. später gestartet).
      state.status = 'off';
      state.error = e.message;
      emit();
      setTimeout(connect, 30000);
    });
}

function handle(ev) {
  switch (ev.type) {
    case 'hello':
      state.clientId = ev.clientId || '';
      state.clockOffsetMs = ev.clockOffsetMs || 0;
      break;
    case 'practice':
      if (ev.practice) {
        const i = state.practices.findIndex((p) => p.id === ev.practice.id);
        if (i >= 0) state.practices[i] = ev.practice; else state.practices.push(ev.practice);
        state.practices = state.practices.slice();
      }
      break;
    case 'chat':
      if (ev.chat) {
        // Chat-Events kommen ohne Nachrichten → vorhandene Nachrichten behalten.
        const i = state.chats.findIndex((c) => c.id === ev.chat.id);
        const prev = i >= 0 ? state.chats[i] : null;
        const next = { ...(prev || {}), ...ev.chat, messages: ev.chat.messages || (prev ? prev.messages : []) };
        state.chats = i >= 0 ? state.chats.map((c, k) => (k === i ? next : c)) : [next, ...state.chats];
      }
      break;
    case 'chat:deleted':
      state.chats = state.chats.filter((c) => c.id !== ev.id);
      break;
    case 'message':
    case 'message:update':
      if (ev.chatId && ev.message) {
        state.chats = state.chats.map((c) => {
          if (c.id !== ev.chatId) return c;
          const msgs = c.messages || [];
          const j = msgs.findIndex((m) => m.id === ev.message.id || (ev.message.clientMsgId && m.clientMsgId === ev.message.clientMsgId));
          const list = j >= 0 ? msgs.map((m, k) => (k === j ? ev.message : m)) : [...msgs, ev.message];
          return { ...c, messages: list, updatedAt: Math.max(c.updatedAt || 0, ev.message.ts || 0) };
        });
        if (ev.type === 'message') state.typing = { ...state.typing, [ev.chatId]: null };
      }
      break;
    case 'read':
      state.chats = state.chats.map((c) => (c.id === ev.chatId ? { ...c, unread: { ...(c.unread || {}), [ev.side]: 0 } } : c));
      break;
    case 'typing':
      state.typing = { ...state.typing, [ev.chatId]: ev.on ? ev.from : null };
      break;
    case 'resync':
      loadState().catch(() => {});
      return;
    case 'clock':
      state.clockOffsetMs = ev.offsetMs || 0;
      break;
    case 'clients':
      state.devices = ev.count || 0;
      break;
    case 'ping':
      if (!ev.target || ev.target === 'all' || ev.target === state.clientId) {
        getJson(`/clients/${encodeURIComponent(state.clientId)}/pong`, { method: 'POST', body: JSON.stringify({ pingId: ev.pingId }) }).catch(() => {});
      }
      return;
    case 'broadcast':
      if (ev.target && ev.target !== 'all' && ev.target !== state.clientId) return;
      if (ev.kind === 'reload') { location.reload(); return; }
      if (ev.kind === 'navigate' && ev.route) { location.hash = ev.route.replace(/^#/, ''); }
      if (ev.kind === 'notify' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try { new Notification('VetNow', { body: ev.text || '' }); } catch { /* manche Browser nur per Service Worker */ }
      }
      if (onBroadcast && ev.text) onBroadcast(ev.text, ev.level || 'info');
      return;
    default:
      return;
  }
  if (ev.rev) state.rev = ev.rev;
  emit();
}

export function startHubSync(opts = {}) {
  if (opts.onBroadcast) onBroadcast = opts.onBroadcast;
  if (started) return;
  started = true;
  connect();
}

export function hubNow() { return Date.now() + (snapshot.clockOffsetMs || 0); }

/* React-Hook: { status, practices, rev, devices, clockOffsetMs } */
export function useHub() {
  return React.useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => snapshot,
    () => snapshot,
  );
}

/* Live-Status aus dem Hub über die Demo-Praxen legen (gleiche IDs). Die übrigen Felder
   (Texte, Öffnungszeiten) bleiben aus data.js, damit die Oberfläche unverändert funktioniert. */
export function overlayPractices(practices, hubPractices, now) {
  if (!hubPractices || !hubPractices.length) return practices;
  const live = new Map(withLiveStatus(hubPractices, now).map((p) => [p.id, p]));
  return practices.map((p) => {
    const h = live.get(p.id);
    if (!h) return p;
    return { ...p, status: h.status, confirmedAt: h.confirmedAt, absent: h.status === 'red' && !!h.absence, live: true };
  });
}

/* Schreibaktionen — scheitern still, wenn kein Hub da ist (lokaler Modus bleibt gültig). */
export function hubConfirmStatus(practiceId, value, hours = 24) {
  if (snapshot.status !== 'online' || !practiceId) return Promise.resolve(null);
  return getJson(`/practices/${encodeURIComponent(practiceId)}/status`, { method: 'POST', body: JSON.stringify({ value, hours }) }).catch(() => null);
}

export function hubSendRequest(data) {
  if (snapshot.status !== 'online' || !data || !data.practiceId) return Promise.resolve(null);
  return getJson('/requests', { method: 'POST', body: JSON.stringify(data) }).catch(() => null);
}

/* ---------- Chats über den Hub (Web und Handy sehen dieselben Unterhaltungen) ---------- */
export function hubOnline() { return snapshot.status === 'online'; }

export function hubChat(method, path, body) {
  return getJson(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

/* Bilder aus dem Browser (data:-URL) als Datei zum Hub hochladen → Verweis 'hub:<id>'. */
export async function hubUploadDataUrl(dataUrl, name) {
  const blob = await (await fetch(dataUrl)).blob();
  const res = await fetch(API + '/files', { method: 'POST', headers: { 'content-type': blob.type || 'application/octet-stream', 'x-filename': encodeURIComponent(name || 'bild.jpg'), 'x-vn-client': state.clientId || 'web' }, body: blob });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || 'Upload fehlgeschlagen');
  return { kind: 'image', ref: 'hub:' + data.id, mime: blob.type, size: blob.size, name: name || 'bild.jpg' };
}

export function hubFileUrl(ref) {
  if (!ref) return '';
  if (ref.startsWith('hub:')) return API + '/files/' + encodeURIComponent(ref.slice(4));
  return ref;
}
