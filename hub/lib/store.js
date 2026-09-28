/* VetNow Hub — serverseitiger Zustand (die „Wahrheit" im Hub-Modus).

   - Ein Objekt `state` mit practices, chats, labels, appointments, blocks, settings.
   - `rev` zählt JEDE Änderung/jedes Ereignis hoch. Clients merken sich die letzte rev und fragen
     per Long-Poll „alles seit rev X" ab. Deshalb liegen die letzten 1000 Ereignisse im Ringpuffer.
   - Speichern: entprellt (300 ms) und atomar (erst in eine .tmp-Datei, dann umbenennen). So ist
     state.json nie halb geschrieben — auch nicht, wenn der Strom mitten im Schreiben ausfällt.
   - Der effektive Ampel-Status (grau nach Ablauf) wird NICHT hier berechnet: Der Hub speichert den
     rohen Status, jeder Client rechnet mit seiner (ggf. simulierten) Uhr selbst. */
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { buildDemoSeed, buildEmptySeed, SETTINGS_DEFAULT, LABELS_SEED, DATA_SCHEMA } from './shared.js';
import { deepMerge, isPlainObject, clone, sleep } from './util.js';

export const RING_MAX = 1000;

/* Schreiben mit Wiederholung: Unter Windows (und im OneDrive-Ordner!) sperren Virenscanner oder
   der Sync-Client Dateien kurz. rename() schlägt dann mit EPERM/EBUSY fehl — kurz warten hilft. */
async function renameRetry(from, to) {
  for (let i = 0; ; i++) {
    try { await fsp.rename(from, to); return; } catch (e) {
      if (i >= 9 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      await sleep(25 * (i + 1));
    }
  }
}

export async function atomicWrite(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.tmp`;
  const fh = await fsp.open(tmp, 'w');
  try {
    await fh.writeFile(data);
    await fh.sync(); // wirklich auf die Platte, bevor umbenannt wird
  } finally {
    await fh.close();
  }
  try {
    await renameRetry(tmp, file);
  } catch (e) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}

/* Fehlende Felder ergänzen, falsche Typen reparieren — damit ein alter oder von Hand bearbeiteter
   Speicherstand den Hub nicht zum Absturz bringt. */
export function normalizeState(input, now = Date.now()) {
  const s = isPlainObject(input) ? input : {};
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => isPlainObject(x)) : []);
  const chats = arr(s.chats).map((c) => ({
    labels: [], pinned: {}, unread: { owner: 0, clinic: 0 }, autoReply: false, isTestData: false,
    createdAt: now, updatedAt: now, ...c,
    messages: arr(c.messages),
  })).map((c) => ({
    ...c,
    labels: Array.isArray(c.labels) ? c.labels.filter((x) => typeof x === 'string') : [],
    pinned: isPlainObject(c.pinned) ? c.pinned : {},
    unread: { owner: Number(c.unread && c.unread.owner) || 0, clinic: Number(c.unread && c.unread.clinic) || 0 },
  }));
  return {
    schema: DATA_SCHEMA || 3,
    rev: Number.isFinite(s.rev) ? s.rev : 0,
    mode: s.mode === 'empty' ? 'empty' : 'demo',
    clockOffsetMs: Number.isFinite(s.clockOffsetMs) ? s.clockOffsetMs : 0,
    practices: arr(s.practices).map((p) => ({ absence: null, ...p, status: isPlainObject(p.status) ? p.status : { value: null, setAt: null, expiresAt: null } })),
    chats,
    labels: s.labels === undefined ? clone(LABELS_SEED) : arr(s.labels),
    appointments: arr(s.appointments),
    blocks: arr(s.blocks),
    settings: deepMerge(SETTINGS_DEFAULT, isPlainObject(s.settings) ? s.settings : {}),
  };
}

export function buildSeedState(kind, now) {
  const seed = kind === 'empty' ? buildEmptySeed(now) : buildDemoSeed(now);
  return normalizeState({ ...seed, mode: kind === 'empty' ? 'empty' : 'demo', rev: 0 }, now);
}

export function createStateStore({ dataDir, logger = console, seedMode = 'demo', saveDelayMs = 300 } = {}) {
  const file = path.join(dataDir, 'state.json');
  const bak = path.join(dataDir, 'state.bak.json');
  let state = normalizeState({});
  const ring = [];
  const listeners = new Set();
  let timer = null;
  let chain = Promise.resolve();
  let pending = null;
  let lastBakAt = 0;
  let closed = false;
  let lastSaveError = null;
  let loadedFrom = 'seed';

  const now = () => Date.now() + (state.clockOffsetMs || 0);

  async function readJsonFile(f) {
    let txt;
    try { txt = await fsp.readFile(f, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return { missing: true }; throw e; }
    try { return { data: JSON.parse(txt.replace(/^﻿/, '')) }; } catch (e) { return { corrupt: true, error: e }; }
  }

  async function load() {
    await fsp.mkdir(dataDir, { recursive: true });
    const main = await readJsonFile(file);
    if (main.data) { state = normalizeState(main.data); loadedFrom = 'state.json'; return; }
    if (main.corrupt) {
      // NIE einfach mit dem Seed überschreiben: kaputte Datei zur Diagnose aufheben.
      const keep = path.join(dataDir, `state.corrupt-${Date.now()}.json`);
      await renameRetry(file, keep).catch(() => {});
      logger.error(`[store] state.json war beschädigt (${main.error.message}) — gesichert als ${path.basename(keep)}`);
    }
    const backup = await readJsonFile(bak);
    if (backup.data) {
      state = normalizeState(backup.data);
      loadedFrom = 'state.bak.json';
      logger.warn('[store] Zustand aus state.bak.json wiederhergestellt.');
      scheduleSave();
      return;
    }
    state = buildSeedState(seedMode, Date.now());
    loadedFrom = 'seed';
    logger.info(`[store] Erster Start: ${seedMode === 'empty' ? 'leerer' : 'Demo-'}Datenbestand angelegt.`);
    await flush();
  }

  function snapshot() {
    return { ...state, schema: DATA_SCHEMA || 3, savedAt: Date.now() };
  }

  async function saveNow() {
    const json = JSON.stringify(snapshot());
    await atomicWrite(file, json);
    // Eine Sicherungskopie höchstens einmal pro Minute — reicht als Rettungsanker, kostet kaum IO.
    if (Date.now() - lastBakAt > 60e3) {
      lastBakAt = Date.now();
      await atomicWrite(bak, json).catch((e) => logger.warn('[store] Sicherungskopie fehlgeschlagen: ' + e.message));
    }
  }

  /* Speichervorgänge laufen strikt nacheinander (Kette). Ist schon einer eingereiht, aber noch
     nicht gestartet, reicht dieser — er nimmt beim Start ohnehin den neuesten Zustand mit. */
  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (pending) return pending;
    const p = chain.then(async () => {
      pending = null; // ab jetzt brauchen neue Änderungen einen eigenen Speichervorgang
      try {
        await saveNow();
        lastSaveError = null;
      } catch (e) {
        lastSaveError = e;
        logger.error('[store] Speichern fehlgeschlagen: ' + e.message);
      }
    });
    pending = p;
    chain = p;
    return p;
  }

  function scheduleSave() {
    if (closed || timer) return;
    timer = setTimeout(() => { timer = null; flush(); }, saveDelayMs);
    if (timer.unref) timer.unref();
  }

  /* Ereignis auslösen: rev hochzählen, in den Ringpuffer, an alle Abonnenten (SSE, Long-Poll,
     Auto-Antwort). `persist:false` für flüchtige Ereignisse (typing, ping, clients …). */
  function emit(type, payload = {}, { persist = true } = {}) {
    state.rev += 1;
    const ev = { ...payload, type, rev: state.rev, ts: Date.now() };
    ring.push(ev);
    if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
    for (const fn of listeners) {
      try { fn(ev); } catch (e) { logger.error('[store] Listener-Fehler: ' + (e && e.stack || e)); }
    }
    if (persist) scheduleSave();
    return ev;
  }

  /* Alles nach `since`. resync, wenn die Lücke nicht mehr im Ringpuffer liegt oder der Client
     eine rev kennt, die es hier nie gab (z. B. nach einem Neustart mit älterem Speicherstand). */
  function eventsSince(since) {
    if (!Number.isFinite(since) || since < 0 || since > state.rev) return { resync: true, rev: state.rev };
    if (since === state.rev) return { rev: state.rev, events: [] };
    const first = ring.length ? ring[0].rev : state.rev + 1;
    if (since < first - 1) return { resync: true, rev: state.rev };
    return { rev: state.rev, events: ring.filter((e) => e.rev > since) };
  }

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  /* Kompletten Zustand ersetzen (Reset/Import). rev bleibt monoton, damit kein Client
     glaubt, er sei „voraus". Danach bekommen alle ein resync. */
  function replaceState(next, { mode } = {}) {
    const n = normalizeState(next);
    n.rev = state.rev;
    if (mode) n.mode = mode;
    state = n;
    ring.length = 0;
    const ev = emit('resync', { reason: 'replace' });
    return ev;
  }

  const findIn = (list, id) => list.find((x) => x.id === id) || null;

  return {
    get state() { return state; },
    get rev() { return state.rev; },
    get file() { return file; },
    get loadedFrom() { return loadedFrom; },
    get lastSaveError() { return lastSaveError; },
    get ringSize() { return ring.length; },
    now,
    load,
    emit,
    eventsSince,
    subscribe,
    replaceState,
    scheduleSave,
    flush,
    practice: (id) => findIn(state.practices, id),
    chat: (id) => findIn(state.chats, id),
    label: (id) => findIn(state.labels, id),
    appointment: (id) => findIn(state.appointments, id),
    async close() {
      await flush();
      closed = true;
      listeners.clear();
    },
  };
}

/* Chat ohne Nachrichten (für das Ereignis `chat`, laut Vertrag „ohne messages"). */
export function chatMeta(chat) {
  if (!chat) return null;
  const { messages, ...meta } = chat;
  return { ...clone(meta), messageCount: Array.isArray(messages) ? messages.length : 0 };
}
