/* VetNow v3 — Live-Verbindung der Handy-App zum VetNow Hub (iPhone + Android).

   React Native kennt kein EventSource. Deshalb nutzt die App den Long-Poll-Endpunkt des Hubs
   (/api/v1/changes): Die Anfrage bleibt bis zu 25 s offen und kommt sofort zurück, sobald sich
   etwas ändert — so sieht das Handy Status-Änderungen aus Extension/PC praktisch live.
   Hub-Adresse (erste erreichbare gewinnt):
     1. EXPO_PUBLIC_HUB_URL (Studio/`npm run mobile` setzt sie)
     2. PC, von dem Expo Go die App lädt (Constants.expoConfig.hostUri) → Port 8787, dann 3000 (Studio)
     3. ZimaOS-Studio http://192.168.68.10:3000
   Kein Hub → die App läuft wie bisher lokal weiter. */
import React from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { withLiveStatus } from '../shared/status.js';
import { APP_VERSION } from '../shared/version.js';

const state = { status: 'off', url: '', practices: [], rev: 0, clockOffsetMs: 0, clientId: 'mobile-' + Math.random().toString(36).slice(2, 10), error: '' };
let snapshot = { ...state };
const listeners = new Set();
let started = false;
let paused = false;
let onBroadcast = null;

function emit() { snapshot = { ...state }; listeners.forEach((fn) => fn()); }

function withTimeout(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(t) };
}

async function getJson(base, path, opts = {}, ms = 8000) {
  const to = withTimeout(ms);
  try {
    const res = await fetch(base + '/api/v1' + path, {
      ...opts, signal: to.signal,
      headers: { 'content-type': 'application/json', 'x-vn-client': state.clientId || 'mobile', ...(opts.headers || {}) },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || 'HTTP ' + res.status);
    return data;
  } finally { to.done(); }
}

export function hubCandidates() {
  const out = [];
  const env = (process.env.EXPO_PUBLIC_HUB_URL || '').trim().replace(/\/+$/, '');
  if (env) out.push(env);
  const hostUri = (Constants.expoConfig && Constants.expoConfig.hostUri) || '';
  const host = String(hostUri).split(':')[0];
  if (host && !/exp\.direct|ngrok/.test(host)) out.push(`http://${host}:8787`, `http://${host}:3000`);
  out.push('http://192.168.68.10:3000');
  return [...new Set(out)];
}

async function findHub() {
  for (const base of hubCandidates()) {
    try {
      const h = await getJson(base, '/health', {}, 2500);
      if (h && h.name === 'VetNow Hub') return { base, health: h };
    } catch { /* nächsten Kandidaten probieren */ }
  }
  return null;
}

async function loop() {
  while (started) {
    if (paused) { await sleep(1000); continue; }
    if (!state.url) {
      state.status = 'connecting'; emit();
      const found = await findHub();
      if (!found) { state.status = 'off'; emit(); await sleep(30000); continue; }
      state.url = found.base;
      state.clockOffsetMs = found.health.clockOffsetMs || 0;
      try {
        const s = await getJson(state.url, '/state', {}, 10000);
        state.practices = s.practices || []; state.rev = s.rev || 0; state.status = 'online'; emit();
      } catch (e) { state.url = ''; state.error = e.message; continue; }
    }
    try {
      const name = encodeURIComponent('Handy-App · ' + (Platform.OS === 'ios' ? 'iPhone' : 'Android'));
      const r = await getJson(state.url, `/changes?since=${state.rev}&timeout=25000&client=${encodeURIComponent(state.clientId || '')}&platform=${Platform.OS}&name=${name}&version=${APP_VERSION}`, {}, 32000);
      if (state.status !== 'online') { state.status = 'online'; emit(); }
      if (r.clientId) state.clientId = r.clientId;
      if (r.resync) {
        const s = await getJson(state.url, '/state', {}, 10000);
        state.practices = s.practices || []; state.rev = s.rev || 0; state.clockOffsetMs = s.clockOffsetMs || 0; emit();
        continue;
      }
      for (const ev of r.events || []) handle(ev);
      if (r.rev) state.rev = r.rev;
      emit();
    } catch (e) {
      state.status = 'offline'; state.error = e.message; emit();
      await sleep(5000);
      // Nach mehreren Fehlschlägen neu suchen (z. B. anderes WLAN)
      try { await getJson(state.url, '/health', {}, 2500); } catch { state.url = ''; }
    }
  }
}

function handle(ev) {
  if (ev.type === 'practice' && ev.practice) {
    const i = state.practices.findIndex((p) => p.id === ev.practice.id);
    if (i >= 0) state.practices[i] = ev.practice; else state.practices.push(ev.practice);
    state.practices = state.practices.slice();
  } else if (ev.type === 'clock') {
    state.clockOffsetMs = ev.offsetMs || 0;
  } else if (ev.type === 'broadcast') {
    if (ev.target && ev.target !== 'all' && ev.target !== state.clientId) return;
    if (onBroadcast && ev.text) onBroadcast(ev.text);
  } else if (ev.type === 'ping' && (!ev.target || ev.target === 'all' || ev.target === state.clientId)) {
    getJson(state.url, `/clients/${encodeURIComponent(state.clientId)}/pong`, { method: 'POST', body: JSON.stringify({ pingId: ev.pingId }) }).catch(() => {});
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function startHubSync(opts = {}) {
  if (opts.onBroadcast) onBroadcast = opts.onBroadcast;
  if (started) return;
  started = true;
  // Im Hintergrund nicht pollen (Akku), beim Zurückkehren sofort weitermachen.
  AppState.addEventListener('change', (s) => { paused = s !== 'active'; });
  loop();
}

export function hubNow() { return Date.now() + (snapshot.clockOffsetMs || 0); }

export function useHub() {
  return React.useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => snapshot, () => snapshot);
}

export function overlayPractices(practices, hubPractices, now) {
  if (!hubPractices || !hubPractices.length) return practices;
  const live = new Map(withLiveStatus(hubPractices, now).map((p) => [p.id, p]));
  return practices.map((p) => {
    const h = live.get(p.id);
    return h ? { ...p, status: h.status, confirmedAt: h.confirmedAt, live: true } : p;
  });
}

export function hubConfirmStatus(practiceId, value, hours = 24) {
  if (snapshot.status !== 'online' || !practiceId) return Promise.resolve(null);
  return getJson(snapshot.url, `/practices/${encodeURIComponent(practiceId)}/status`, { method: 'POST', body: JSON.stringify({ value, hours }) }).catch(() => null);
}

export function hubSendRequest(data) {
  if (snapshot.status !== 'online' || !data || !data.practiceId) return Promise.resolve(null);
  return getJson(snapshot.url, '/requests', { method: 'POST', body: JSON.stringify(data) }).catch(() => null);
}

/* KI-Adresse: der Hub bietet die alte Studio-KI-Schnittstelle unter /api/ai weiter an. */
export function hubAiBase() { return snapshot.status === 'online' && snapshot.url ? snapshot.url + '/api/ai' : ''; }
