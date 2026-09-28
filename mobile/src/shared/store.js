// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* VetNow — der gemeinsame Store für Web, Handy und Extension (Vertrag §5 „Store").

   Warum ein Store außerhalb von React?
   In v2 lag der Zustand in drei React-Contexts (Web) bzw. zwei (Handy), mit je eigenen
   useEffect-Speicherroutinen. Folgen laut Audits: Antworten blieben unter StrictMode aus,
   Ungelesen-Zähler wuchsen nie, ein AsyncStorage-Lesefehler überschrieb alles mit dem Seed,
   Termin-Notizen kamen nie im Chat an. Hier ist die Logik EINMAL, ohne React, testbar in Node.
   React bindet ihn per useSyncExternalStore an (getState/subscribe).

   Zwei Betriebsarten:
   - LOKAL: Alles liegt im Speicher-Adapter des Geräts. Auto-Antworten (Bot/KI) laufen hier in einer
     Warteschlange pro Nachricht (idempotent, abbrechbar), mit Tipp-Anzeige.
   - HUB: Der VetNow Hub ist die Wahrheit. Aktionen werden SOFORT sichtbar (optimistisch) und per REST
     geschickt; Hub-Ereignisse werden idempotent eingespielt (nach rev/id/clientMsgId). Ist der Hub weg,
     landen Schreibaktionen in einer Outbox (auch gespeichert) und werden nach dem Reconnect gesendet.
     Auto-Antworten kommen dann NUR vom Hub (sonst antworten mehrere Geräte doppelt).

   Speicher (Adapter { get, set, remove, keys? }, alle asynchron):
     vn3:<flavor>:meta | settings | auth | hubcfg | clock          (gerätebezogen)
     vn3:<flavor>:practices | labels | appointments | blocks | chatIndex | chat:<id>   (lokale Daten)
     vn3:<flavor>:hub:…  dieselben Daten als Zwischenspeicher des Hub-Zustands (+ outbox, rev),
                         damit ein Wechsel zum Hub die lokalen Daten nicht überschreibt.
   Jeder Chat hat seinen EIGENEN Schlüssel → keine einzelne Zeile > 2 MB (Android-AsyncStorage-Limit).
   LESEFEHLER: Der betroffene Schlüssel wird für diese Sitzung gesperrt (nie überschrieben),
   lastError wird gesetzt, die App läuft im Speicher weiter. Ein Lesefehler führt NIE zum Seed-Überschreiben.

   Alte v1-Schlüssel (vn_chats_v1 …) werden beim allerersten Start über denselben Adapter gelesen:
   Konvention → storage.getLegacy(key) falls vorhanden, sonst storage.get('legacy:' + key).
   Der Web-Adapter bildet 'legacy:vn_chats_v1' auf den rohen localStorage-Schlüssel 'vn_chats_v1' ab. */
import { APP_VERSION, DATA_SCHEMA } from './version.js';
import {
  DEMO_OWNER, DEMO_PRACTICE, DEMO_PRACTICE_ID, SERVER_SETTING_KEYS, SETTABLE_STATUS_KEYS, SITUATIONS,
  ANIMAL_ICON, BOT_MODES, defaultSettings, seedLabels,
} from './constants.js';
import { now as clockNow, setClockOffset as setGlobalClockOffset, getClockOffset, HOUR } from './clock.js';
import { uid } from './ids.js';
import { buildDemoSeed, buildEmptySeed } from './seed.js';
import { mySide, otherSide, newMessage, normalizeChat, upsertMessage, visibleChats as viewChats, unreadTotal as countUnread } from './chats.js';
import { migrateV1, applyMigration, hasV1Data, V1_KEYS } from './migrate.js';
import { createAiClient } from './ai.js';
import { shouldAutoReply, generateAutoReply, replySideFor } from './autoreply.js';
import { createHubClient, normalizeHubUrl, resolveHubCandidates, probeHubs as probeHubList } from './hubclient.js';

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const DATA_KEYS = ['practices', 'labels', 'appointments', 'blocks'];
const AUTH_EMPTY = Object.freeze({ role: null, name: '' });

const microtask = typeof globalThis.queueMicrotask === 'function'
  ? (fn) => globalThis.queueMicrotask(fn)
  : (fn) => Promise.resolve().then(fn);

/* Speicher-Adapter im Arbeitsspeicher (Node, Tests, Notfall). legacy = alte v1-Werte zum Testen. */
export function createMemoryStorage(initial, legacy) {
  const m = new Map(Object.entries(initial || {}));
  const old = { ...(legacy || {}) };
  return {
    map: m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async set(k, v) { m.set(k, v); },
    async remove(k) { m.delete(k); },
    async keys() { return Array.from(m.keys()); },
    async getLegacy(k) { return Object.prototype.hasOwnProperty.call(old, k) ? old[k] : null; },
  };
}

function normalizeAuth(a, practices) {
  if (!isObj(a) || (a.role !== 'owner' && a.role !== 'clinic')) return { ...AUTH_EMPTY };
  if (a.role === 'owner') {
    return { role: 'owner', name: String(a.name || DEMO_OWNER.name), ownerId: String(a.ownerId || DEMO_OWNER.ownerId) };
  }
  const pid = String(a.practiceId || DEMO_PRACTICE_ID);
  const p = (practices || []).find((x) => x && x.id === pid);
  return { role: 'clinic', name: String(a.name || (p && p.name) || DEMO_PRACTICE.name), practiceId: pid };
}

function mergeSettings(base, patch) {
  const out = { ...defaultSettings(), ...(isObj(base) ? base : {}) };
  out.ai = { ...defaultSettings().ai, ...(isObj(base) && isObj(base.ai) ? base.ai : {}) };
  if (isObj(patch)) {
    Object.keys(patch).forEach((k) => {
      if (k === 'ai' && isObj(patch.ai)) out.ai = { ...out.ai, ...patch.ai };
      else if (k !== '__proto__' && k !== 'constructor') out[k] = patch[k];
    });
  }
  if (BOT_MODES.indexOf(out.botMode) < 0) out.botMode = 'ai-fallback';
  return out;
}

function hubErrorText(e) {
  if (!e) return 'Unbekannter Fehler beim Hub.';
  if (e.code === 'unauthorized' || e.status === 401 || e.status === 403) {
    return 'Diese Aktion braucht im Hub-Modus die Admin-Anmeldung.';
  }
  return e.message || 'Fehler beim Hub.';
}

/* createStore({ storage, platform, flavor:'demo'|'clean', fetch, EventSource?, hubUrl?, now?,
                 ai?, aiUrl?, aiLegacyUrl?, resolveImage?, origin?, hostUri?, clientName?, version?,
                 adminToken?, typingScale?, replyDelayMs?, autoConnect?, onBroadcast? }) */
export function createStore(options) {
  const o = options || {};
  const storage = o.storage || createMemoryStorage();
  const platform = o.platform || 'web';
  const flavor = o.flavor === 'clean' ? 'clean' : 'demo';
  const fetchFn = typeof o.fetch === 'function' ? o.fetch : (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
  const EventSourceImpl = o.EventSource;
  const typingScale = num(o.typingScale) && o.typingScale >= 0 ? o.typingScale : 1;
  const replyDelayMs = num(o.replyDelayMs) && o.replyDelayMs >= 0 ? o.replyDelayMs : 350;
  const baseNow = typeof o.now === 'function' ? o.now : (num(o.now) ? () => o.now : null);
  const now = () => (baseNow ? baseNow() + getClockOffset() : clockNow());

  const BASE = 'vn3:' + flavor + ':';
  const dataPrefix = (mode) => (mode === 'hub' ? BASE + 'hub:' : BASE);

  const listeners = new Set();
  let notifyScheduled = false;
  let destroyed = false;

  let state = {
    ready: false,
    flavor,
    platform,
    mode: 'local',
    hub: { status: 'off', url: '', clientId: '', latencyMs: null, lastSyncAt: null, error: null, serverVersion: null, protocol: null, clients: null, outbox: 0, candidates: [] },
    auth: { ...AUTH_EMPTY },
    settings: defaultSettings(),
    practices: [],
    chats: [],
    labels: [],
    appointments: [],
    blocks: [],
    typing: {},
    clockOffsetMs: getClockOffset(),
    lastError: null,
    broadcast: null,
    migration: null,
    version: APP_VERSION,
  };

  function notify() {
    if (notifyScheduled || destroyed) return;
    notifyScheduled = true;
    // Gebündelt: 20 Änderungen in einer Aktion → EIN Render statt 20 (keine Render-Stürme).
    microtask(() => {
      notifyScheduled = false;
      listeners.forEach((fn) => { try { fn(state); } catch { /* Listener-Fehler isolieren */ } });
    });
  }
  function set(patch) {
    state = { ...state, ...patch };
    notify();
  }
  function setHub(patch) {
    set({ hub: { ...state.hub, ...patch } });
  }
  function setError(msg) {
    set({ lastError: msg ? { message: String(msg), at: now() } : null });
  }

  /* ------------------------------------------------------------------ Persistenz */
  let persistBlocked = false; // Meta nicht lesbar oder neueres Schema → gar nichts schreiben
  const blocked = new Set(); // einzelne Schlüssel, deren Lesen fehlschlug
  const unreadableChatIds = new Set(); // Chats, die nicht gelesen werden konnten — bleiben im Index
  const dirty = new Set();
  const dirtyChats = new Set();
  const removedChats = new Set();
  let flushTimer = null;
  let flushing = Promise.resolve();

  function markDirty(key) { dirty.add(key); scheduleFlush(); }
  function markChat(id) { dirtyChats.add(id); dirty.add('chatIndex'); scheduleFlush(); }
  function markRemoved(id) { removedChats.add(id); dirtyChats.delete(id); dirty.add('chatIndex'); scheduleFlush(); }
  function markAllData() {
    DATA_KEYS.forEach((k) => dirty.add(k));
    state.chats.forEach((c) => dirtyChats.add(c.id));
    dirty.add('chatIndex');
    scheduleFlush();
  }
  function scheduleFlush() {
    if (flushTimer || destroyed) return;
    flushTimer = globalThis.setTimeout(() => { flushTimer = null; doFlush(); }, 30);
  }

  async function writeKey(full, value) {
    if (persistBlocked || blocked.has(full)) return;
    try {
      await storage.set(full, JSON.stringify(value));
    } catch (e) {
      // Speicher voll o. Ä.: SICHTBAR machen (v2 hat solche Fehler verschluckt → Daten weg nach Reload).
      setError('Speichern fehlgeschlagen (' + ((e && e.message) || 'Speicher voll?') + '). Bitte große Anhänge löschen.');
    }
  }
  async function removeKey(full) {
    if (persistBlocked || blocked.has(full)) return;
    try { await storage.remove(full); } catch { /* nicht schlimm */ }
  }

  function doFlush() {
    const keys = Array.from(dirty);
    const chatIds = Array.from(dirtyChats);
    const removed = Array.from(removedChats);
    dirty.clear();
    dirtyChats.clear();
    removedChats.clear();
    const p = dataPrefix(state.mode);
    const jobs = [];
    keys.forEach((k) => {
      if (k === 'settings' || k === 'auth' || k === 'hubcfg' || k === 'clock' || k === 'meta') {
        const v = k === 'settings' ? state.settings : k === 'auth' ? state.auth : k === 'hubcfg' ? hubCfg : k === 'clock' ? { offsetMs: state.clockOffsetMs } : meta;
        jobs.push(writeKey(BASE + k, v));
      } else if (k === 'chatIndex') {
        const ids = state.chats.map((c) => c.id);
        unreadableChatIds.forEach((id) => { if (ids.indexOf(id) < 0) ids.push(id); });
        jobs.push(writeKey(p + 'chatIndex', ids));
      } else if (k === 'outbox') {
        // Outbox und rev gehören IMMER zum Hub-Zwischenspeicher — auch wenn sie erst nach dem Trennen
        // (Modus schon 'local') gespeichert werden. Früher landeten sie dann unter dem lokalen Präfix.
        jobs.push(writeKey(dataPrefix('hub') + 'outbox', outbox));
      } else if (k === 'rev') {
        jobs.push(writeKey(dataPrefix('hub') + 'rev', lastAppliedRev));
      } else if (DATA_KEYS.indexOf(k) >= 0) {
        jobs.push(writeKey(p + k, state[k]));
      }
    });
    chatIds.forEach((id) => {
      const c = state.chats.find((x) => x.id === id);
      if (c) jobs.push(writeKey(p + 'chat:' + id, c));
    });
    removed.forEach((id) => jobs.push(removeKey(p + 'chat:' + id)));
    flushing = flushing.then(() => Promise.all(jobs)).catch(() => {});
    return flushing;
  }

  async function flush() {
    if (flushTimer) { globalThis.clearTimeout(flushTimer); flushTimer = null; }
    doFlush();
    await flushing;
  }

  async function readKey(full) {
    try {
      const raw = await storage.get(full);
      if (raw == null) return { ok: true, value: null };
      if (typeof raw === 'string') {
        try { return { ok: true, value: JSON.parse(raw) }; } catch (e) { return { ok: false, error: e, corrupt: true }; }
      }
      return { ok: true, value: raw };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  const readErrors = [];
  function noteReadError(full, r) {
    blocked.add(full);
    readErrors.push(full.replace(BASE, '') + (r.corrupt ? ' (beschädigt)' : ''));
  }

  async function readLegacy() {
    const out = {};
    const map = { vn_chats_v1: 'chats', vn_labels_v1: 'labels', vn_chat_settings_v2: 'settings', vn_chat_settings_v1: 'settingsV1', vn_auth: 'auth', vn_hide_testdata: 'hideTestData' };
    await Promise.all(V1_KEYS.map(async (k) => {
      try {
        const v = typeof storage.getLegacy === 'function' ? await storage.getLegacy(k) : await storage.get('legacy:' + k);
        if (v != null) out[map[k]] = v;
      } catch { /* Altdaten sind freiwillig */ }
    }));
    return out;
  }

  /* ------------------------------------------------------------------ Laden */
  let meta = null;
  let hubCfg = { url: '', enabled: false };

  function seedFor(kind) {
    const n = now();
    return kind === 'empty' || (kind == null && flavor === 'clean') ? buildEmptySeed(n) : buildDemoSeed(n);
  }

  async function loadData(mode) {
    const p = dataPrefix(mode);
    const fallback = mode === 'hub' ? { practices: [], labels: seedLabels(), appointments: [], blocks: [] } : seedFor(null);
    const patch = {};
    for (const k of DATA_KEYS) {
      const r = await readKey(p + k);
      if (!r.ok) { noteReadError(p + k, r); patch[k] = clone(fallback[k]) || []; } else if (Array.isArray(r.value)) patch[k] = r.value;
      else patch[k] = clone(fallback[k]) || [];
    }
    let ids = [];
    const idx = await readKey(p + 'chatIndex');
    if (!idx.ok) noteReadError(p + 'chatIndex', idx);
    // Doppelte IDs (z. B. ein halb geschriebener/kaputter Index) würden denselben Chat zweimal laden.
    if (idx.ok && Array.isArray(idx.value)) ids = Array.from(new Set(idx.value.filter((x) => typeof x === 'string' && x)));
    else if (typeof storage.keys === 'function') {
      // Index fehlt/kaputt → Chats über die Schlüsselnamen wiederfinden, statt sie zu verlieren.
      try {
        const all = await storage.keys();
        ids = (all || []).filter((k) => k.indexOf(p + 'chat:') === 0).map((k) => k.slice((p + 'chat:').length));
      } catch { ids = []; }
    }
    const chats = [];
    const seenIds = new Set();
    const results = await Promise.all(ids.map((id) => readKey(p + 'chat:' + id)));
    results.forEach((r, i) => {
      if (!r.ok) { noteReadError(p + 'chat:' + ids[i], r); unreadableChatIds.add(ids[i]); return; }
      if (!isObj(r.value)) return;
      // Fehlt die id im Datensatz, gilt die aus dem Schlüssel — sonst bekäme der Chat bei JEDEM Start
      // eine neue Zufalls-ID und der alte Schlüssel bliebe als Leiche liegen.
      const c = normalizeChat(r.value.id ? r.value : { ...r.value, id: ids[i] }, now());
      if (seenIds.has(c.id)) return;
      seenIds.add(c.id);
      chats.push(c);
    });
    patch.chats = chats;
    if (mode === 'hub') {
      const ob = await readKey(p + 'outbox');
      outbox = ob.ok && Array.isArray(ob.value) ? ob.value : [];
      if (!ob.ok) noteReadError(p + 'outbox', ob);
      const rv = await readKey(p + 'rev');
      lastAppliedRev = rv.ok && num(rv.value) ? rv.value : null;
    }
    return patch;
  }

  async function init() {
    const m = await readKey(BASE + 'meta');
    if (!m.ok) {
      // Speicher kaputt/gesperrt: NICHTS schreiben, im Speicher mit Seed weiterlaufen.
      persistBlocked = true;
      const seed = seedFor(null);
      set({
        practices: seed.practices, chats: seed.chats.map((c) => normalizeChat(c, now())), labels: seed.labels,
        appointments: seed.appointments, blocks: seed.blocks,
        lastError: { message: 'Gespeicherte Daten konnten nicht gelesen werden — die App läuft vorübergehend nur im Arbeitsspeicher, es wird nichts überschrieben.', at: now() },
      });
      return;
    }
    if (!m.value) {
      // Fehlt nur die Meta-Zeile, aber es gibt schon Daten (z. B. Absturz beim ersten Speichern),
      // wird NICHT neu geseedet — sonst wären vorhandene Chats weg. Stattdessen normal laden.
      const [pr, ix] = await Promise.all([readKey(BASE + 'practices'), readKey(BASE + 'chatIndex')]);
      if ((pr.ok && pr.value == null) && (ix.ok && ix.value == null)) {
        await firstStart();
        return;
      }
      m.value = { schema: DATA_SCHEMA, createdAt: now(), flavor, appVersion: APP_VERSION, recovered: true };
      dirty.add('meta');
    }
    meta = m.value;
    if (num(meta.schema) && meta.schema > DATA_SCHEMA) {
      persistBlocked = true;
      readErrors.push('Schema ' + meta.schema + ' ist neuer als diese App (' + DATA_SCHEMA + ')');
    }
    const [s, a, h, c] = await Promise.all(['settings', 'auth', 'hubcfg', 'clock'].map((k) => readKey(BASE + k)));
    if (!s.ok) noteReadError(BASE + 'settings', s);
    if (!a.ok) noteReadError(BASE + 'auth', a);
    if (!h.ok) noteReadError(BASE + 'hubcfg', h);
    if (!c.ok) noteReadError(BASE + 'clock', c);
    const settings = mergeSettings(s.ok ? s.value : null);
    if (h.ok && isObj(h.value)) hubCfg = { url: '', enabled: false, ...h.value };
    if (c.ok && isObj(c.value) && num(c.value.offsetMs)) setGlobalClockOffset(c.value.offsetMs);
    const useHub = !!(hubCfg.enabled && hubCfg.url);
    const data = await loadData(useHub ? 'hub' : 'local');
    set({
      ...data,
      mode: useHub ? 'hub' : 'local',
      settings,
      auth: normalizeAuth(a.ok ? a.value : null, data.practices),
      clockOffsetMs: getClockOffset(),
      hub: { ...state.hub, url: hubCfg.url || '', clientId: hubCfg.clientId || '', outbox: outbox.length },
    });
    if (readErrors.length) {
      setError('Einige gespeicherte Daten konnten nicht gelesen werden (' + readErrors.join(', ') + '). Sie werden in dieser Sitzung nicht überschrieben.');
    }
  }

  async function firstStart() {
    const seed = seedFor(null);
    let parts = seed;
    let report = null;
    const legacy = await readLegacy();
    if (hasV1Data(legacy)) {
      const mig = migrateV1(legacy, now(), { practices: seed.practices });
      parts = applyMigration(seed, mig);
      report = mig.report;
    }
    meta = { schema: DATA_SCHEMA, createdAt: now(), flavor, appVersion: APP_VERSION, migratedV1: !!report };
    set({
      practices: parts.practices,
      chats: parts.chats.map((c) => normalizeChat(c, now())),
      labels: parts.labels,
      appointments: parts.appointments,
      blocks: parts.blocks,
      settings: mergeSettings(parts.settings),
      auth: normalizeAuth(parts.auth, parts.practices),
      migration: report,
    });
    ['meta', 'settings', 'auth'].forEach((k) => dirty.add(k));
    markAllData();
    await flush();
  }

  /* ------------------------------------------------------------------ Hilfen für Chats */
  const idAlias = new Map(); // lokale (optimistische) ID → Server-ID
  const resolveId = (id) => (idAlias.has(id) ? idAlias.get(id) : id);
  const getChat = (id) => state.chats.find((c) => c.id === resolveId(id)) || null;

  function putChat(chat, { front = false } = {}) {
    const i = state.chats.findIndex((c) => c.id === chat.id);
    let chats;
    if (i >= 0) { chats = state.chats.slice(); chats[i] = chat; } else chats = front ? [chat].concat(state.chats) : state.chats.concat([chat]);
    set({ chats });
    markChat(chat.id);
    return chat;
  }
  function patchChat(id, fn) {
    const c = getChat(id);
    if (!c) return null;
    const next = fn(c);
    if (!next || next === c) return c;
    return putChat(next);
  }
  function removeChatLocal(id) {
    const rid = resolveId(id);
    if (!state.chats.some((c) => c.id === rid)) return false;
    set({ chats: state.chats.filter((c) => c.id !== rid), typing: { ...state.typing, [rid]: null } });
    markRemoved(rid);
    return true;
  }
  /* Eine Nachricht ändern. Rückgabe: der geänderte Chat — oder null, wenn es den Chat/die Nachricht
     nicht gibt ODER fn nichts geändert hat (gleiches Objekt zurück). Früher kam auch bei unbekannter
     Nachrichten-ID der Chat zurück: Die Aktion meldete „Erfolg" und schickte im Hub-Modus ein PATCH,
     das mit 404 scheiterte (→ Fehlermeldung + kompletter Neuabgleich). */
  function patchMessage(chatId, messageId, fn) {
    const c = getChat(chatId);
    if (!c || messageId == null || messageId === '') return null;
    const i = c.messages.findIndex((m) => m && (m.id === messageId || m.clientMsgId === messageId));
    if (i < 0) return null;
    const next = fn(c.messages[i]);
    if (!next || next === c.messages[i]) return null;
    const messages = c.messages.slice();
    messages[i] = next;
    return putChat({ ...c, messages });
  }
  /* Server-ID einer Nachricht (für PATCH-Pfade): Wer noch die lokale clientMsgId in der Hand hat,
     trifft so trotzdem die richtige Nachricht beim Hub. */
  function serverMsgId(chat, messageId) {
    const m = chat && chat.messages.find((x) => x && (x.id === messageId || x.clientMsgId === messageId));
    return m ? m.id : messageId;
  }
  function appendMessage(chatId, msg, { bumpUnreadFor } = {}) {
    return patchChat(chatId, (c) => {
      const r = upsertMessage(c.messages, msg);
      const unread = { ...c.unread };
      if (r.added && (bumpUnreadFor === 'owner' || bumpUnreadFor === 'clinic')) unread[bumpUnreadFor] = (unread[bumpUnreadFor] || 0) + 1;
      return { ...c, messages: r.messages, unread, updatedAt: Math.max(c.updatedAt || 0, num(msg.ts) ? msg.ts : 0) };
    });
  }
  function sideOf(chat) {
    return mySide(chat, state.auth) || (state.auth.role === 'clinic' ? 'clinic' : 'owner');
  }
  function upsertBy(listKey, item, keyFn) {
    const k = keyFn || ((x) => x.id);
    const list = state[listKey];
    const i = list.findIndex((x) => k(x) === k(item));
    const next = list.slice();
    if (i >= 0) next[i] = { ...list[i], ...item }; else next.push(item);
    set({ [listKey]: next });
    markDirty(listKey);
  }
  function removeBy(listKey, id) {
    const next = state[listKey].filter((x) => x.id !== id);
    if (next.length === state[listKey].length) return false;
    set({ [listKey]: next });
    markDirty(listKey);
    return true;
  }
  function patchById(listKey, id, patch) {
    const list = state[listKey];
    const i = list.findIndex((x) => x.id === resolveId(id));
    if (i < 0) return null;
    const next = list.slice();
    next[i] = { ...list[i], ...patch };
    set({ [listKey]: next });
    markDirty(listKey);
    return next[i];
  }

  /* ------------------------------------------------------------------ Auto-Antwort (lokal) */
  const jobs = new Map(); // Schlüssel (messageId) → Auftrag
  const jobByChat = new Map();
  const aiCache = { key: '', client: null };

  function localAi() {
    if (o.ai) return typeof o.ai === 'function' ? o.ai() : o.ai;
    const legacyUrl = (state.settings.aiLegacyUrl || o.aiLegacyUrl || '').trim();
    const key = legacyUrl ? 'legacy|' + legacyUrl : (o.aiUrl ? 'hub|' + o.aiUrl : '');
    if (!key) return null;
    if (aiCache.key !== key) {
      aiCache.key = key;
      aiCache.client = legacyUrl
        ? createAiClient({ baseUrl: legacyUrl, legacy: true, fetch: fetchFn })
        : createAiClient({ baseUrl: o.aiUrl, fetch: fetchFn });
    }
    return aiCache.client;
  }

  /* Abbrechbares Warten: cancelJob weckt alle Wartenden, damit kein Auftrag ewig hängt. */
  function sleep(ms, job) {
    return new Promise((resolve) => {
      if (!(ms > 0) || job.cancelled) { resolve(); return; }
      const wake = () => { globalThis.clearTimeout(t); job.timers.delete(t); job.wakers.delete(wake); resolve(); };
      const t = globalThis.setTimeout(wake, ms);
      job.timers.add(t);
      job.wakers.add(wake);
    });
  }
  function setTyping(chatId, side) {
    if ((state.typing[chatId] || null) === (side || null)) return;
    set({ typing: { ...state.typing, [chatId]: side || null } });
  }
  function cancelJob(key) {
    const job = jobs.get(key);
    if (!job) return;
    job.cancelled = true;
    Array.from(job.wakers).forEach((w) => w());
    job.timers.forEach((t) => globalThis.clearTimeout(t));
    job.timers.clear();
    if (job.ctrl) { try { job.ctrl.abort(); } catch { /* egal */ } }
    jobs.delete(key);
    if (jobByChat.get(job.chatId) === key) jobByChat.delete(job.chatId);
    setTyping(job.chatId, null);
  }
  function cancelAllJobs() {
    Array.from(jobs.keys()).forEach(cancelJob);
  }
  const alreadyAnswered = (chat, key) => chat.messages.some((m) => m && m.meta && m.meta.replyTo === key);

  /* Plant eine Antwort. Idempotent: gleicher Schlüssel zweimal (React StrictMode, doppelter Klick)
     → nur EIN Auftrag. Neue Nachricht im selben Chat → alter Auftrag wird abgebrochen, der neue sieht
     den ganzen Verlauf (so antwortet die Gegenseite einmal auf drei schnelle Nachrichten). */
  function scheduleReply(chatId, key, opts) {
    const op = opts || {};
    if (state.mode !== 'local' || destroyed) return false;
    const chat = getChat(chatId);
    if (!chat || jobs.has(key) || alreadyAnswered(chat, key)) return false;
    const prev = jobByChat.get(chat.id);
    if (prev) cancelJob(prev);
    const AC = globalThis.AbortController;
    const job = { key, chatId: chat.id, cancelled: false, timers: new Set(), wakers: new Set(), ctrl: typeof AC === 'function' ? new AC() : null };
    jobs.set(key, job);
    jobByChat.set(chat.id, key);
    runJob(job, op);
    return true;
  }

  async function runJob(job, op) {
    try {
      await sleep(replyDelayMs * typingScale, job);
      if (job.cancelled) return;
      let chat = getChat(job.chatId);
      if (!chat) return;
      const alive = chat.messages.filter((m) => m && !m.deleted);
      const side = op.side || replySideFor(chat, alive[alive.length - 1]);
      const settings = op.settings || state.settings;
      if (settings.typing !== false) setTyping(chat.id, side);
      let result;
      try {
        result = await generateAutoReply({
          chat, practices: state.practices, settings, ai: localAi(), now: now(),
          signal: job.ctrl ? job.ctrl.signal : undefined, side, resolveImage: o.resolveImage,
        });
      } catch (e) {
        if (job.cancelled || (e && (e.name === 'AbortError' || e.code === 'aborted'))) return;
        result = { messages: [{ text: 'Die automatische Antwort ist fehlgeschlagen: ' + ((e && e.message) || 'Fehler'), source: 'error' }], typingMs: [0] };
      }
      for (let i = 0; i < result.messages.length; i++) {
        if (job.cancelled) return;
        const wait = (result.typingMs[i] || 0) * typingScale;
        if (wait > 0) { setTyping(job.chatId, side); await sleep(wait, job); }
        if (job.cancelled) return;
        chat = getChat(job.chatId);
        if (!chat) return;
        const r = result.messages[i];
        const msg = newMessage({ from: side, type: 'text', text: r.text, source: r.source, meta: { ...(r.meta || {}), replyTo: job.key }, now: now() });
        appendMessage(chat.id, msg, { bumpUnreadFor: otherSide(side) });
      }
    } finally {
      if (jobs.get(job.key) === job) {
        jobs.delete(job.key);
        if (jobByChat.get(job.chatId) === job.key) jobByChat.delete(job.chatId);
        setTyping(job.chatId, null);
      }
    }
  }

  /* Die simulierte Seite ist immer die Gegenseite der angemeldeten Person (abgemeldet: die
     Gegenseite der Nachricht). Schreibt jemand ALS simulierte Seite (Admin/Test), antwortet niemand. */
  function maybeAutoReply(chatId, msg) {
    const chat = getChat(chatId);
    if (!chat || state.mode !== 'local') return false;
    const userSide = state.auth.role ? sideOf(chat) : msg.from;
    const simulated = otherSide(userSide);
    if (!shouldAutoReply(chat, msg, state.settings, { simulatedSide: simulated })) return false;
    return scheduleReply(chat.id, msg.id, { side: simulated });
  }

  /* ------------------------------------------------------------------ Hub-Modus */
  let hub = null; // createHubClient
  let stopSub = null;
  let outbox = [];
  let lastAppliedRev = null;
  let resyncing = null;
  let buffered = [];
  let flushingOutbox = false;
  const serverChatUpdated = new Map(); // chatId → updatedAt laut letztem chat-Event
  const typingTimers = new Map();
  let adminToken = o.adminToken || '';

  function persistOutbox() {
    setHub({ outbox: outbox.length });
    markDirty('outbox');
  }
  function enqueue(op) {
    outbox.push(op);
    persistOutbox();
  }

  /* Vorübergehender Fehler = später nochmal versuchen (Outbox), statt die Änderung zu verwerfen:
     Netz weg, Zeitüberschreitung, 503 (Hub simuliert offline) und alle 5xx (z. B. Fehler-Injektion
     error500). Der Hub ist für Wiederholungen gebaut: clientMsgId/IDs machen sie idempotent. */
  const isTransient = (e) => !!e && (e.code === 'offline' || e.code === 'timeout' || (num(e.status) && e.status >= 500));
  const MAX_OP_ATTEMPTS = 8;

  /* Wiederanlauf der Outbox, wenn die ECHTZEIT-Verbindung gesund ist, aber eine einzelne Anfrage
     scheiterte (Zeitüberschreitung, 5xx). Ohne diesen Timer bliebe die Outbox dann hängen: Der
     Hub-Client meldet nur STATUSWECHSEL, und sein Status war ja die ganze Zeit „online".
     Ist die Echtzeit-Verbindung selbst weg, übernimmt deren Reconnect (onHubStatus → flushOutbox). */
  let recoverTimer = null;
  let recoverAttempt = 0;
  function scheduleRecovery() {
    if (recoverTimer || !hub || destroyed) return;
    const client = hub;
    const min = num(o.backoffMinMs) && o.backoffMinMs > 0 ? o.backoffMinMs : 1000;
    const max = num(o.backoffMaxMs) && o.backoffMaxMs > 0 ? o.backoffMaxMs : 15000;
    const delay = Math.min(max, min * Math.pow(2, recoverAttempt));
    recoverAttempt++;
    recoverTimer = globalThis.setTimeout(async () => {
      recoverTimer = null;
      if (hub !== client || destroyed || client.status !== 'online') return;
      try {
        await client.health();
      } catch {
        if (hub === client) scheduleRecovery();
        return;
      }
      if (hub !== client) return;
      recoverAttempt = 0;
      if (state.hub.status !== 'online') setHub({ status: 'online', error: null, latencyMs: client.latencyMs });
      flushOutbox();
    }, delay);
  }
  function stopRecovery() {
    if (recoverTimer) globalThis.clearTimeout(recoverTimer);
    recoverTimer = null;
    recoverAttempt = 0;
  }
  function aliasPath(path) {
    // /chats/<lokaleId>/… → /chats/<ServerId>/…, falls der Hub eine andere ID vergeben hat.
    return String(path).split('/').map((seg) => (idAlias.has(seg) ? idAlias.get(seg) : seg)).join('/');
  }

  function renameLocal(listKey, fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    idAlias.set(fromId, toId);
    if (listKey === 'chats') {
      const c = state.chats.find((x) => x.id === fromId);
      if (!c) return;
      const exists = state.chats.some((x) => x.id === toId);
      set({ chats: exists ? state.chats.filter((x) => x.id !== fromId) : state.chats.map((x) => (x.id === fromId ? { ...x, id: toId } : x)) });
      markRemoved(fromId);
      markChat(toId);
      set({ appointments: state.appointments.map((a) => (a.chatId === fromId ? { ...a, chatId: toId } : a)) });
    } else {
      set({ [listKey]: state[listKey].map((x) => (x.id === fromId ? { ...x, id: toId } : x)) });
      markDirty(listKey);
    }
  }

  function onOpResult(op, res) {
    if (!res || !op) return;
    if ((op.kind === 'chat-create' || op.kind === 'request') && isObj(res.chat)) {
      renameLocal('chats', op.localId, res.chat.id);
      const withMsgs = Array.isArray(res.chat.messages) && res.chat.messages.length > 0;
      applyServerChat(res.chat, { replaceMessages: op.kind === 'request' && withMsgs });
      if (op.kind === 'request' && !withMsgs && op.body && op.body.clientMsgId) {
        // Server-Chat ohne Nachrichten: Die erste Nachricht kommt per Ereignis → die optimistische
        // Kopie nur behalten, wenn sie noch nicht bestätigt wurde (sonst stünde sie doppelt da).
        patchChat(res.chat.id, (c) => {
          const confirmed = c.messages.some((m) => !m.pending && m.from === 'owner' && m.text === op.body.message);
          return confirmed ? { ...c, messages: c.messages.filter((m) => !(m.pending && m.clientMsgId === op.body.clientMsgId)) } : c;
        });
      }
    } else if (op.kind === 'message' && isObj(res.message)) {
      applyMessage(op.chatId, res.message, { fromServer: true });
    } else if (op.kind === 'label-create' && isObj(res.label)) {
      renameLocal('labels', op.localId, res.label.id);
      upsertBy('labels', res.label);
    } else if (op.kind === 'appointment-create' && isObj(res.appointment)) {
      renameLocal('appointments', op.localId, res.appointment.id);
      upsertBy('appointments', res.appointment);
    }
  }

  /* Schreibaktion an den Hub. Offline → Outbox. Andere Fehler → lastError + Neuabgleich, damit die
     optimistische Änderung durch den echten Serverstand ersetzt wird. */
  /* Vom Hub endgültig abgelehnte Nachricht sichtbar als „nicht gesendet" markieren (statt sie
     still verschwinden zu lassen oder ewig als „wird gesendet" stehen zu lassen). */
  function markFailed(op) {
    if (op && op.kind === 'message' && op.chatId && op.body && op.body.clientMsgId) {
      patchMessage(op.chatId, op.body.clientMsgId, (m) => ({ ...m, pending: false, failed: true }));
    }
  }

  /* Gehört eine Antwort noch zur AKTUELLEN Verbindung? Nach disconnectHub() oder dem Wechsel zu einem
     anderen Hub dürfen späte Antworten/Ereignisse NICHT mehr eingespielt werden: Demo-Seed und Hub
     haben dieselben Chat-IDs — die Hub-Nachricht landete sonst im LOKALEN Chat (und wurde gespeichert).
     Eine neue Verbindung zum SELBEN Hub (Reconnect) zählt dagegen weiter. */
  function sameHub(client) {
    return !!client && !!hub && state.mode === 'hub' && hub.baseUrl === client.baseUrl;
  }

  function hubSend(method, path, body, extra) {
    const op = { opId: uid('op'), method, path, body, ts: now(), attempts: 0, ...(extra || {}) };
    if (!hub || state.hub.status !== 'online' || outbox.length) {
      // Reihenfolge wahren: solange noch etwas in der Outbox wartet, wird hinten angestellt.
      if (op.queue !== false) enqueue(op);
      else setError('Der Hub ist nicht erreichbar — diese Admin-Aktion wurde nicht ausgeführt. Bitte später erneut versuchen.');
      if (hub && state.hub.status === 'online') flushOutbox();
      return Promise.resolve(null);
    }
    const client = hub;
    return client.request(method, aliasPath(path), body, { admin: !!op.admin }).then((res) => {
      if (sameHub(client)) onOpResult(op, res);
      return res;
    }, (e) => {
      if (!sameHub(client)) return null; // Verbindung inzwischen getrennt/gewechselt → nichts mehr anfassen
      if (isTransient(e)) {
        if (op.queue !== false) {
          op.attempts = 1;
          enqueue(op);
        } else {
          setError('Der Hub ist nicht erreichbar — diese Admin-Aktion wurde nicht ausgeführt. Bitte später erneut versuchen.');
        }
        // 5xx heißt „Hub erreichbar, aber gestört" → Status bleibt; Netz/Zeitüberschreitung → offline.
        if (!(num(e.status) && e.status >= 500 && e.status !== 503)) setHub({ status: 'offline', error: e.message });
        scheduleRecovery();
        return null;
      }
      setError(hubErrorText(e));
      markFailed(op);
      fetchState();
      return null;
    });
  }

  async function flushOutbox() {
    if (flushingOutbox || !hub) return;
    const client = hub;
    flushingOutbox = true;
    let sent = 0;
    let stalled = false;
    try {
      while (outbox.length && hub === client && state.hub.status === 'online') {
        const op = outbox[0];
        try {
          const res = await client.request(op.method, aliasPath(op.path), op.body, { admin: !!op.admin });
          // Angekommen ist angekommen → aus der Outbox nehmen (außer sie wurde inzwischen geleert,
          // z. B. beim Wechsel zu einem anderen Hub). Eingespielt wird nur bei derselben Verbindung.
          if (outbox[0] === op) { outbox.shift(); persistOutbox(); }
          sent++;
          if (sameHub(client)) onOpResult(op, res);
        } catch (e) {
          if (hub !== client) break; // Verbindung gewechselt: Auftrag bleibt für die neue Verbindung liegen
          if (isTransient(e)) {
            op.attempts = (op.attempts || 0) + 1;
            if (op.attempts < MAX_OP_ATTEMPTS) { persistOutbox(); stalled = true; break; }
            // Nach vielen vergeblichen Versuchen aufgeben — eine Dauerstörung soll nicht alles blockieren.
          }
          // Vom Hub abgelehnt (z. B. Chat inzwischen gelöscht) → verwerfen, sonst hängt die Outbox ewig.
          outbox.shift();
          persistOutbox();
          markFailed(op);
          setError('Eine gespeicherte Änderung wurde vom Hub abgelehnt: ' + hubErrorText(e));
        }
      }
    } finally {
      flushingOutbox = false;
    }
    if (hub !== client) {
      // Während des Sendens wurde neu verbunden: Die neue Verbindung wollte evtl. schon senden, kam
      // aber wegen der laufenden Runde nicht dran → jetzt nachholen, sonst hinge die Outbox.
      if (hub && state.hub.status === 'online' && outbox.length) flushOutbox();
      return;
    }
    if (stalled) scheduleRecovery();
    if (sent && !outbox.length) fetchState();
  }

  function applyClock(offsetMs) {
    if (!num(offsetMs)) return;
    setGlobalClockOffset(offsetMs);
    set({ clockOffsetMs: getClockOffset() });
  }

  function applyServerSettings(s) {
    if (!isObj(s)) return;
    const patch = {};
    SERVER_SETTING_KEYS.forEach((k) => { if (s[k] !== undefined) patch[k] = s[k]; });
    set({ settings: mergeSettings(state.settings, patch) });
    markDirty('settings');
  }

  /* Server-Nachrichten + die lokal noch unbestätigten (pending) bzw. abgelehnten (failed).
     Kennt der Hub eine Nachricht schon (gleiche id/clientMsgId), gewinnt SEINE Fassung — sonst würde
     die lokale ID die Server-ID überschreiben und spätere PATCHs (Bearbeiten, Löschen) liefen ins Leere. */
  function keepUnconfirmed(serverMsgs, localMsgs) {
    let out = serverMsgs;
    (localMsgs || []).forEach((m) => {
      if (!m || !(m.pending || m.failed)) return;
      const known = out.some((x) => x && (x.id === m.id || (m.clientMsgId && (x.clientMsgId === m.clientMsgId || x.id === m.clientMsgId))));
      if (!known) out = upsertMessage(out, m).messages;
    });
    return out;
  }

  function applyServerChat(chat, { replaceMessages = false } = {}) {
    if (!isObj(chat) || !chat.id) return;
    const existing = state.chats.find((c) => c.id === chat.id);
    if (num(chat.updatedAt)) serverChatUpdated.set(chat.id, chat.updatedAt);
    let messages;
    if (Array.isArray(chat.messages)) {
      messages = chat.messages.slice();
      if (existing && !replaceMessages) {
        // Optimistische, noch nicht bestätigte Nachrichten behalten.
        messages = keepUnconfirmed(messages, existing.messages);
      }
    } else {
      messages = existing ? existing.messages : [];
    }
    putChat(normalizeChat({ ...(existing || {}), ...chat, messages }, now()));
  }

  function applyMessage(chatId, message, { fromServer = false } = {}) {
    if (!isObj(message)) return;
    const chat = getChat(chatId);
    if (!chat) { if (fromServer || state.mode === 'hub') fetchState(); return; }
    const had = chat.messages.some((m) => m.id === message.id || (message.clientMsgId && (m.clientMsgId === message.clientMsgId || m.id === message.clientMsgId)));
    // Ungelesen der Empfängerseite hochzählen — außer ein chat-Event hat diese Nachricht schon
    // mitgezählt (dessen updatedAt ist dann ≥ ts) oder es ist eine bekannte/eigene Nachricht.
    const counted = num(serverChatUpdated.get(chat.id)) && num(message.ts) && serverChatUpdated.get(chat.id) >= message.ts;
    const bump = !had && !counted && (message.from === 'owner' || message.from === 'clinic') ? otherSide(message.from) : null;
    appendMessage(chat.id, { ...message }, { bumpUnreadFor: bump });
    if (message.from && typingTimers.has(chat.id) && state.typing[chat.id] === message.from) {
      // Die Nachricht der tippenden Seite ist da → Tipp-Anzeige aus.
      setTyping(chat.id, null);
    }
  }

  function applyEvent(ev) {
    if (!ev || typeof ev.type !== 'string') return;
    if (num(ev.rev) && lastAppliedRev != null && ev.rev <= lastAppliedRev && ev.type !== 'hello' && ev.type !== 'resync') return;
    switch (ev.type) {
      case 'hello':
        if (num(ev.clockOffsetMs)) applyClock(ev.clockOffsetMs);
        if (ev.clientId) setHub({ clientId: ev.clientId });
        if (lastAppliedRev == null || (num(ev.rev) && ev.rev < lastAppliedRev)) fetchState();
        break;
      case 'resync':
        fetchState();
        break;
      case 'practice':
        if (isObj(ev.practice)) upsertBy('practices', ev.practice);
        break;
      case 'practice:deleted':
        removeBy('practices', ev.id);
        break;
      case 'chat':
        applyServerChat(ev.chat);
        break;
      case 'chat:deleted':
        removeChatLocal(ev.id);
        break;
      case 'message':
        applyMessage(ev.chatId, ev.message, { fromServer: true });
        break;
      case 'message:update':
        if (isObj(ev.message) && getChat(ev.chatId)) patchChat(ev.chatId, (c) => ({ ...c, messages: upsertMessage(c.messages, ev.message).messages }));
        break;
      case 'typing': {
        const on = !!ev.on;
        setTyping(ev.chatId, on ? ev.from : null);
        if (typingTimers.has(ev.chatId)) globalThis.clearTimeout(typingTimers.get(ev.chatId));
        typingTimers.delete(ev.chatId);
        if (on) {
          // Sicherheitsnetz: geht das „aus"-Ereignis verloren, hört die Anzeige nach 30 s auf.
          typingTimers.set(ev.chatId, globalThis.setTimeout(() => { typingTimers.delete(ev.chatId); setTyping(ev.chatId, null); }, 30000));
        }
        break;
      }
      case 'read':
        if (ev.side === 'owner' || ev.side === 'clinic') patchChat(ev.chatId, (c) => (c.unread[ev.side] ? { ...c, unread: { ...c.unread, [ev.side]: 0 } } : c));
        break;
      case 'label':
        if (isObj(ev.label)) upsertBy('labels', ev.label);
        break;
      case 'label:deleted':
        removeBy('labels', ev.id);
        break;
      case 'appointment':
        if (isObj(ev.appointment)) upsertBy('appointments', ev.appointment);
        break;
      case 'appointment:deleted':
        removeBy('appointments', ev.id);
        break;
      case 'block':
        if (isObj(ev.block)) upsertBy('blocks', ev.block, (b) => b.id || (b.practiceId + '|' + b.weekday + '|' + b.time));
        break;
      case 'block:deleted':
        removeBy('blocks', ev.id);
        break;
      case 'settings':
        applyServerSettings(ev.settings);
        break;
      case 'clock':
        applyClock(ev.offsetMs);
        break;
      case 'broadcast':
        set({ broadcast: { ...ev, receivedAt: now() } });
        if (typeof o.onBroadcast === 'function') { try { o.onBroadcast(ev); } catch { /* egal */ } }
        break;
      case 'ping':
        if (hub && (!ev.target || ev.target === 'all' || ev.target === hub.clientId)) {
          hub.request('POST', '/clients/' + encodeURIComponent(hub.clientId) + '/pong', { pingId: ev.pingId }).catch(() => {});
        }
        break;
      case 'clients':
        setHub({ clients: num(ev.count) ? ev.count : null });
        break;
      default:
        break; // unbekannte Ereignisse (neuere Hubs) ignorieren
    }
    if (num(ev.rev) && ev.type !== 'hello') {
      lastAppliedRev = lastAppliedRev == null ? ev.rev : Math.max(lastAppliedRev, ev.rev);
      markDirty('rev');
    }
    setHub({ lastSyncAt: now() });
  }

  function onHubEvent(ev) {
    // Während der komplette Zustand geladen wird, Ereignisse zwischenspeichern und danach
    // nur die NEUEREN einspielen — sonst würde der ältere Schnappschuss sie überschreiben.
    if (resyncing && ev && ev.type !== 'resync' && ev.type !== 'hello') { buffered.push(ev); return; }
    applyEvent(ev);
  }

  function replaceFromServer(s) {
    const pendingChatIds = new Set(outbox.filter((op) => op.kind === 'chat-create' || op.kind === 'request').map((op) => op.localId));
    const serverChats = (Array.isArray(s.chats) ? s.chats : []).filter(isObj).map((c) => {
      if (num(c.updatedAt)) serverChatUpdated.set(c.id, c.updatedAt);
      const local = state.chats.find((x) => x.id === c.id);
      let messages = Array.isArray(c.messages) ? c.messages.slice() : [];
      if (local) messages = keepUnconfirmed(messages, local.messages);
      return normalizeChat({ ...c, messages }, now());
    });
    const ids = new Set(serverChats.map((c) => c.id));
    const keepLocal = state.chats.filter((c) => pendingChatIds.has(c.id) && !ids.has(c.id));
    const removed = state.chats.filter((c) => !ids.has(c.id) && !pendingChatIds.has(c.id)).map((c) => c.id);
    set({
      practices: Array.isArray(s.practices) ? s.practices : state.practices,
      chats: keepLocal.concat(serverChats),
      labels: Array.isArray(s.labels) ? s.labels : state.labels,
      appointments: Array.isArray(s.appointments) ? s.appointments : state.appointments,
      blocks: Array.isArray(s.blocks) ? s.blocks : state.blocks,
    });
    if (isObj(s.settings)) applyServerSettings(s.settings);
    if (num(s.clockOffsetMs)) applyClock(s.clockOffsetMs);
    removed.forEach((id) => markRemoved(id));
    markAllData();
  }

  /* Kompletten Zustand vom Hub laden. Läuft schon ein Abgleich für DIESE Verbindung, wird er geteilt.
     Ein noch laufender Abgleich einer ALTEN Verbindung (vor Trennen/Neuverbinden) zählt nicht: Früher
     bekam connectHub dann dessen Ergebnis (false) zurück, und die gepufferten Ereignisse des alten Hubs
     wurden nach dem Trennen in die lokalen Daten eingespielt. */
  let resyncClient = null;
  function fetchState() {
    if (!hub) return Promise.resolve(false);
    if (resyncing && resyncClient === hub) return resyncing;
    const client = hub;
    let job = null;
    job = (async () => {
      // Erst nach dieser Pause weiterlaufen: So ist `job` sicher zugewiesen, bevor finally ihn vergleicht.
      await null;
      let ok = false;
      try {
        const s = await client.state();
        if (client !== hub || !sameHub(client)) return false;
        replaceFromServer(s || {});
        if (s && num(s.rev)) { lastAppliedRev = s.rev; client.setRev(s.rev); markDirty('rev'); }
        setHub({ lastSyncAt: now(), error: null });
        ok = true;
      } catch (e) {
        if (client !== hub) return false;
        if (e && (e.code === 'offline' || e.code === 'timeout')) setHub({ status: 'offline', error: e.message });
        else setError(hubErrorText(e));
      } finally {
        if (resyncing === job) {
          const evs = buffered;
          buffered = [];
          resyncing = null;
          resyncClient = null;
          // Nur Ereignisse der noch aktuellen Verbindung einspielen — alles andere verwerfen.
          if (client === hub && sameHub(client)) evs.forEach(applyEvent);
        }
      }
      return ok;
    })();
    resyncing = job;
    resyncClient = client;
    return job;
  }

  function onHubStatus(status, info) {
    const wasOnline = state.hub.status === 'online';
    setHub({ status, error: status === 'offline' ? ((info && info.error) || 'Hub nicht erreichbar') : null, latencyMs: hub ? hub.latencyMs : null });
    if (status === 'online') recoverAttempt = 0;
    if (status === 'online' && !wasOnline) {
      if (lastAppliedRev == null) fetchState().then(() => flushOutbox());
      else flushOutbox();
    }
  }

  function stopHubClient() {
    if (stopSub) { try { stopSub(); } catch { /* egal */ } }
    stopSub = null;
    hub = null;
    stopRecovery();
    typingTimers.forEach((t) => globalThis.clearTimeout(t));
    typingTimers.clear();
  }

  async function connectHub(url) {
    const target = normalizeHubUrl(url || hubCfg.url || o.hubUrl);
    if (!target) { setError('Keine Hub-Adresse angegeben.'); return false; }
    if (!fetchFn) { setError('In dieser Umgebung gibt es kein fetch() — Hub-Modus nicht möglich.'); return false; }
    stopHubClient();
    cancelAllJobs();
    await flush(); // lokale Änderungen sichern, BEVOR auf den Hub-Zwischenspeicher umgeschaltet wird
    if (state.mode !== 'hub') {
      const cached = await loadData('hub');
      set({ ...cached, mode: 'hub', typing: {} });
    }
    if (hubCfg.url && hubCfg.url !== target) {
      // Anderer Hub → der alte Zwischenspeicher gilt nicht mehr (lokale Daten bleiben unberührt).
      state.chats.forEach((c) => markRemoved(c.id));
      outbox = [];
      lastAppliedRev = null;
      persistOutbox();
      markDirty('rev');
      set({ practices: [], chats: [], labels: seedLabels(), appointments: [], blocks: [] });
      markAllData();
    }
    hubCfg = { ...hubCfg, url: target, enabled: true, clientId: hubCfg.clientId || uid('c') };
    markDirty('hubcfg');
    const client = createHubClient({
      baseUrl: target, fetch: fetchFn, EventSource: EventSourceImpl, platform, clientName: o.clientName,
      version: o.version || APP_VERSION, clientId: hubCfg.clientId, adminToken, rev: lastAppliedRev,
      pollTimeoutMs: o.pollTimeoutMs, backoffMinMs: o.backoffMinMs, backoffMaxMs: o.backoffMaxMs,
    });
    hub = client;
    set({ mode: 'hub', hub: { ...state.hub, status: 'connecting', url: target, clientId: client.clientId, error: null, outbox: outbox.length } });
    let ok = false;
    try {
      const h = await client.health();
      if (hub !== client) return false;
      setHub({ serverVersion: h && h.version ? h.version : null, protocol: h && num(h.protocol) ? h.protocol : null, latencyMs: client.latencyMs, clients: h && num(h.clients) ? h.clients : state.hub.clients });
      if (h && num(h.clockOffsetMs)) applyClock(h.clockOffsetMs);
      ok = await fetchState();
    } catch (e) {
      if (hub !== client) return false;
      setHub({ status: 'offline', error: e.message });
    }
    if (hub !== client) return false;
    stopSub = client.subscribe(onHubEvent, onHubStatus);
    return ok;
  }

  async function disconnectHub() {
    stopHubClient();
    await flush();
    hubCfg = { ...hubCfg, enabled: false };
    markDirty('hubcfg');
    const local = await loadData('local');
    set({ ...local, mode: 'local', typing: {}, hub: { ...state.hub, status: 'off', error: null } });
  }

  /* ------------------------------------------------------------------ Aktionen */
  const inHub = () => state.mode === 'hub';

  const actions = {
    /* ---- Anmeldung ---- */
    login(auth) {
      const a = normalizeAuth(auth, state.practices);
      set({ auth: a });
      markDirty('auth');
      return a;
    },
    logout() {
      set({ auth: { ...AUTH_EMPTY } });
      markDirty('auth');
    },

    /* ---- Einstellungen ---- */
    setSetting(key, value) {
      if (!key || key === 'ai') return;
      set({ settings: mergeSettings(state.settings, { [key]: value }) });
      markDirty('settings');
      if (inHub() && SERVER_SETTING_KEYS.indexOf(key) >= 0) hubSend('PUT', '/admin/settings', { [key]: value }, { admin: true, queue: false });
    },
    setAiSetting(key, value) {
      if (!key) return;
      const ai = { ...state.settings.ai, [key]: value };
      set({ settings: mergeSettings(state.settings, { ai }) });
      markDirty('settings');
      if (inHub()) hubSend('PUT', '/admin/settings', { ai }, { admin: true, queue: false });
    },

    /* ---- Praxis-Status ---- */
    confirmStatus(practiceId, value, hours, note) {
      if (SETTABLE_STATUS_KEYS.indexOf(value) < 0) { setError('Unbekannter Status: ' + value); return null; }
      const h = num(hours) && hours > 0 ? hours : 24;
      const t = now();
      const status = { value, setAt: t, expiresAt: t + h * HOUR };
      if (note) status.note = String(note);
      const p = patchById('practices', practiceId, { status });
      if (inHub()) hubSend('POST', '/practices/' + practiceId + '/status', { value, hours: h, ...(note ? { note: String(note) } : {}) });
      return p;
    },
    expireStatus(practiceId) {
      const p = state.practices.find((x) => x.id === practiceId);
      if (!p) return null;
      const st = isObj(p.status) ? p.status : { value: null, setAt: null };
      const out = patchById('practices', practiceId, { status: { ...st, expiresAt: now() - 1 } });
      if (inHub()) hubSend('POST', '/practices/' + practiceId + '/status', { expire: true });
      return out;
    },
    setAbsence(practiceId, absence) {
      let a = null;
      if (isObj(absence)) {
        a = { from: num(absence.from) ? absence.from : now(), to: num(absence.to) ? absence.to : null };
        if (absence.vertretung) a.vertretung = String(absence.vertretung);
      }
      const out = patchById('practices', practiceId, { absence: a });
      if (inHub()) hubSend('POST', '/practices/' + practiceId + '/absence', a);
      return out;
    },
    updatePractice(id, patch) {
      if (!isObj(patch)) return null;
      const cur = state.practices.find((x) => x.id === id);
      if (!cur) return null;
      const safe = { ...patch };
      delete safe.id;
      if (isObj(safe.profile)) safe.profile = { ...(cur.profile || {}), ...safe.profile };
      const out = patchById('practices', id, safe);
      if (inHub()) hubSend('PATCH', '/practices/' + id, patch);
      return out;
    },

    /* ---- Chats ---- */
    createChat(data) {
      const d = isObj(data) ? data : {};
      const a = state.auth;
      const base = {
        kind: d.kind || 'direct',
        autoReply: d.autoReply !== undefined ? !!d.autoReply : flavor === 'demo',
        labels: Array.isArray(d.labels) ? d.labels : [d.kind === 'network' ? 'netzwerk' : (a.role === 'clinic' ? 'posteingang' : 'tiere')],
      };
      if (a.role === 'owner') { base.ownerId = a.ownerId; base.ownerName = a.name; }
      if (a.role === 'clinic') base.practiceId = a.practiceId;
      const t = now();
      const chat = normalizeChat({ ...base, ...d, id: d.id || uid('ch'), createdAt: t, updatedAt: t, messages: Array.isArray(d.messages) ? d.messages.map((m) => newMessage({ ...m, now: t })) : [] }, t);
      putChat(chat, { front: true });
      if (inHub()) hubSend('POST', '/chats', chat, { kind: 'chat-create', localId: chat.id });
      else if (chat.autoReply && !chat.messages.length && state.settings.greeting !== false && state.settings.botMode !== 'off') {
        scheduleReply(chat.id, 'greet-' + chat.id, { side: otherSide(sideOf(chat)) });
      }
      return chat.id;
    },
    updateChat(id, patch) {
      if (!isObj(patch)) return null;
      const safe = { ...patch };
      delete safe.id;
      delete safe.messages;
      const out = patchChat(id, (c) => normalizeChat({
        ...c, ...safe,
        pinned: isObj(safe.pinned) ? { ...c.pinned, ...safe.pinned } : c.pinned,
        unread: isObj(safe.unread) ? { ...c.unread, ...safe.unread } : c.unread,
        messages: c.messages,
      }, now()));
      if (out && inHub()) hubSend('PATCH', '/chats/' + out.id, safe);
      return out;
    },
    deleteChat(id) {
      const rid = resolveId(id);
      const key = jobByChat.get(rid);
      if (key) cancelJob(key);
      const ok = removeChatLocal(rid);
      if (ok && inHub()) hubSend('DELETE', '/chats/' + rid);
      return ok;
    },
    togglePin(id) {
      const c = getChat(id);
      if (!c) return null;
      const side = sideOf(c);
      const pinned = { ...c.pinned, [side]: !c.pinned[side] };
      putChat({ ...c, pinned });
      if (inHub()) hubSend('PATCH', '/chats/' + c.id, { pinned });
      return pinned[side];
    },
    markRead(id) {
      const c = getChat(id);
      if (!c) return;
      const side = sideOf(c);
      if (!c.unread[side]) return; // nichts zu tun → kein Speichern, kein Render
      putChat({ ...c, unread: { ...c.unread, [side]: 0 } });
      if (inHub()) hubSend('POST', '/chats/' + c.id + '/read', { side });
    },

    /* ---- Nachrichten ---- */
    sendMessage(chatId, input) {
      const c = getChat(chatId);
      if (!c) { setError('Chat nicht gefunden.'); return null; }
      const inp = isObj(input) ? input : { text: input };
      const type = inp.type || (inp.attachment ? (inp.attachment.kind === 'file' ? 'file' : 'image') : 'text');
      const text = inp.text == null ? '' : String(inp.text);
      if (!text.trim() && !inp.attachment && type !== 'note') return null;
      const from = inp.from === 'owner' || inp.from === 'clinic' ? inp.from : sideOf(c);
      const msg = newMessage({ from, type, text, attachment: inp.attachment, meta: inp.meta, now: now() });
      msg.clientMsgId = msg.id;
      if (inHub()) {
        appendMessage(c.id, { ...msg, pending: true }, { bumpUnreadFor: otherSide(from) });
        // Die eigene ID mitschicken: Der Hub übernimmt sie → Bearbeiten/Löschen einer Nachricht, die
        // noch in der Outbox wartet, trifft danach dieselbe ID (statt 404 „Nachricht nicht gefunden").
        const body = { id: msg.id, from, type, text, clientMsgId: msg.clientMsgId };
        if (msg.attachment) body.attachment = msg.attachment;
        if (msg.meta) body.meta = msg.meta;
        hubSend('POST', '/chats/' + c.id + '/messages', body, { kind: 'message', chatId: c.id });
        return { ...msg, pending: true };
      }
      appendMessage(c.id, msg, { bumpUnreadFor: otherSide(from) });
      maybeAutoReply(c.id, msg);
      return msg;
    },
    /* Gelöschte Nachrichten und „leer bearbeiten" (ohne Anhang) werden abgelehnt (null) — genau wie
       der Hub (409/400). Sonst sähe man lokal eine leere Blase, und im Hub-Modus käme ein Fehler zurück. */
    editMessage(chatId, messageId, text) {
      const t = String(text == null ? '' : text);
      const out = patchMessage(chatId, messageId, (m) => {
        if (m.deleted || (!t.trim() && !m.attachment) || m.text === t) return m;
        return { ...m, text: t, editedAt: now() };
      });
      if (out && inHub()) hubSend('PATCH', '/chats/' + out.id + '/messages/' + serverMsgId(out, messageId), { text: t });
      return out;
    },
    deleteMessage(chatId, messageId) {
      const c0 = getChat(chatId);
      const m0 = c0 && c0.messages.find((m) => m.id === messageId || m.clientMsgId === messageId);
      if (c0 && m0 && m0.failed) {
        // Nie beim Hub angekommen (abgelehnt) → nur hier entfernen, der Hub kennt sie nicht.
        return putChat({ ...c0, messages: c0.messages.filter((m) => m !== m0) });
      }
      // Inhalt WIRKLICH leeren — sonst bleibt ein gelöschtes Bild als Datenmüll im Speicher.
      // Schon gelöscht → nichts tun (kein zweites PATCH an den Hub).
      const out = patchMessage(chatId, messageId, (m) => {
        if (m.deleted) return m;
        const n = { ...m, deleted: true, deletedAt: now(), text: '' };
        delete n.attachment;
        delete n.reactions;
        return n;
      });
      if (out && inHub()) hubSend('PATCH', '/chats/' + out.id + '/messages/' + serverMsgId(out, messageId), { deleted: true });
      return out;
    },
    /* Rückgabe: das Emoji dieser Seite nach dem Umschalten, oder null (entfernt bzw. Nachricht unbekannt). */
    toggleReaction(chatId, messageId, emoji) {
      const c = getChat(chatId);
      if (!c) return null;
      const side = sideOf(c);
      let result = null;
      const out = patchMessage(c.id, messageId, (m) => {
        if (m.deleted) return m; // auf Gelöschtes wird nicht reagiert
        const r = { ...(m.reactions || {}) };
        if (r[side] === emoji || !emoji) delete r[side]; else r[side] = emoji;
        result = r[side] || null;
        return { ...m, reactions: r };
      });
      if (!out) return null;
      if (inHub()) hubSend('PATCH', '/chats/' + out.id + '/messages/' + serverMsgId(out, messageId), { reaction: { side, emoji: result } });
      return result;
    },
    rateChat(chatId, messageId, stars) {
      const n = Math.max(1, Math.min(5, Math.round(Number(stars) || 0)));
      const out = patchMessage(chatId, messageId, (m) => (m.rating === n ? m : { ...m, rating: n }));
      if (out && inHub()) hubSend('PATCH', '/chats/' + out.id + '/messages/' + serverMsgId(out, messageId), { rating: n });
      if (out) return n;
      // Gleiche Bewertung nochmal = keine Änderung, aber trotzdem „gültig bewertet".
      const c = getChat(chatId);
      const m = c && c.messages.find((x) => x && (x.id === messageId || x.clientMsgId === messageId));
      return m && m.rating === n ? n : null;
    },

    /* ---- Notfall-/Terminanfrage → neuer Chat im Posteingang der Praxis (für BEIDE Seiten sichtbar) ---- */
    sendRequest(req) {
      const r = isObj(req) ? req : {};
      if (!r.practiceId) { setError('Bitte eine Praxis auswählen.'); return null; }
      const a = state.auth;
      const ownerId = a.role === 'owner' ? a.ownerId : DEMO_OWNER.ownerId; // abgemeldet: nach Demo-Login sichtbar
      const ownerName = String(r.ownerName || (a.role === 'owner' ? a.name : '') || DEMO_OWNER.name);
      const sit = SITUATIONS.find((s) => s.key === r.situation);
      const emergency = r.situation === 'emergency';
      const labels = ['tiere', 'posteingang'];
      if (emergency) labels.push('notfall');
      if (r.situation === 'regular') labels.push('termin');
      const t = now();
      const text = String(r.message || '').trim() || (sit ? 'Guten Tag, ich habe eine Anfrage: ' + sit.label + '.' : 'Guten Tag, ich hätte gern einen Termin.');
      const first = newMessage({
        from: 'owner', text, now: t,
        meta: { request: { situation: r.situation || '', district: r.district || '', phone: r.phone || '', animal: r.animal || '', petName: r.petName || '' } },
      });
      first.clientMsgId = first.id;
      const chat = normalizeChat({
        id: uid('ch'), kind: 'request', practiceId: r.practiceId, ownerId, ownerName,
        petName: r.petName || '', animal: r.animal || 'other', topic: sit ? sit.label : 'Anfrage',
        phone: r.phone || '', district: r.district || '',
        color: emergency ? '#dc2626' : '#0f9b8e', icon: emergency ? 'siren' : (ANIMAL_ICON[r.animal] || 'chat'),
        labels, pinned: { owner: false, clinic: false }, unread: { owner: 0, clinic: 1 },
        autoReply: flavor === 'demo', isTestData: false, createdAt: t, updatedAt: t,
        messages: [inHub() ? { ...first, pending: true } : first],
      }, t);
      putChat(chat, { front: true });
      if (inHub()) {
        hubSend('POST', '/requests', {
          id: chat.id, practiceId: r.practiceId, ownerId, ownerName, phone: r.phone || '', animal: r.animal || '',
          petName: r.petName || '', situation: r.situation || '', district: r.district || '', message: text, clientMsgId: first.clientMsgId,
          // autoReply ausdrücklich mitschicken: Der Hub nimmt sonst „true" an — dann bekäme auch die
          // saubere Version (flavor 'clean', echte Menschen auf beiden Seiten) Bot-Antworten vom Hub.
          autoReply: chat.autoReply,
        }, { kind: 'request', localId: chat.id });
      } else {
        maybeAutoReply(chat.id, first);
      }
      return chat.id;
    },

    /* ---- Labels ---- */
    createLabel(data) {
      const d = isObj(data) ? data : {};
      const label = {
        id: d.id || uid('lb'), name: String(d.name || 'Label'), color: d.color || '#0f9b8e', icon: d.icon || 'tag',
        roles: Array.isArray(d.roles) && d.roles.length ? d.roles.slice() : (state.auth.role ? [state.auth.role] : ['owner', 'clinic']),
        seed: false,
      };
      upsertBy('labels', label);
      if (inHub()) hubSend('POST', '/labels', label, { kind: 'label-create', localId: label.id });
      return label.id;
    },
    updateLabel(id, patch) {
      if (!isObj(patch)) return null;
      const safe = { ...patch };
      delete safe.id;
      const out = patchById('labels', id, safe);
      if (out && inHub()) hubSend('PATCH', '/labels/' + out.id, safe);
      return out;
    },
    deleteLabel(id) {
      const rid = resolveId(id);
      const ok = removeBy('labels', rid);
      // Label auch aus allen Chats entfernen (sonst bleiben tote IDs stehen).
      state.chats.forEach((c) => { if (c.labels.indexOf(rid) >= 0) putChat({ ...c, labels: c.labels.filter((x) => x !== rid) }); });
      if (ok && inHub()) hubSend('DELETE', '/labels/' + rid);
      return ok;
    },

    /* ---- Termine & Blockzeiten ---- */
    addAppointment(data) {
      const d = isObj(data) ? data : {};
      const ap = {
        id: d.id || uid('ap'),
        practiceId: d.practiceId || state.auth.practiceId || DEMO_PRACTICE_ID,
        date: d.date, time: d.time || '09:00', durationMin: num(d.durationMin) ? d.durationMin : 30,
        name: String(d.name || ''), animal: d.animal || 'other', status: d.status || 'open', reason: String(d.reason || ''),
        note: d.note || '', isTestData: !!d.isTestData,
      };
      if (d.chatId) ap.chatId = d.chatId;
      upsertBy('appointments', ap);
      if (inHub()) hubSend('POST', '/appointments', ap, { kind: 'appointment-create', localId: ap.id });
      return ap.id;
    },
    updateAppointment(id, patch) {
      if (!isObj(patch)) return null;
      const safe = { ...patch };
      delete safe.id;
      const out = patchById('appointments', id, safe);
      if (out && inHub()) hubSend('PATCH', '/appointments/' + out.id, safe);
      return out;
    },
    /* Abschließen mit Notiz: Die Notiz landet als 'note'-Nachricht im verknüpften Chat.
       (In v2 zeigte convoId 'c1' auf eine ID, die es nie gab — die Notiz kam nie an.) */
    completeAppointment(id, note) {
      const n = String(note == null ? '' : note).trim();
      const out = patchById('appointments', id, { status: 'done', note: n });
      if (!out) return null;
      if (inHub()) {
        hubSend('PATCH', '/appointments/' + out.id, { status: 'done', note: n });
      } else if (out.chatId && getChat(out.chatId)) {
        const msg = newMessage({ from: 'clinic', type: 'note', text: n || 'Behandlung abgeschlossen.', now: now(), meta: { appointmentId: out.id } });
        appendMessage(out.chatId, msg, { bumpUnreadFor: 'owner' });
        patchChat(out.chatId, (c) => (c.labels.indexOf('erledigt') >= 0 ? c : { ...c, labels: c.labels.concat(['erledigt']) }));
      }
      return out;
    },
    cancelAppointment(id) {
      const out = patchById('appointments', id, { status: 'cancelled' });
      if (out && inHub()) hubSend('PATCH', '/appointments/' + out.id, { status: 'cancelled' });
      return out;
    },
    deleteAppointment(id) {
      const rid = resolveId(id);
      const ok = removeBy('appointments', rid);
      if (ok && inHub()) hubSend('DELETE', '/appointments/' + rid);
      return ok;
    },
    addBlock(data) {
      const d = isObj(data) ? data : {};
      const block = {
        id: d.id || uid('bl'), practiceId: d.practiceId || state.auth.practiceId || DEMO_PRACTICE_ID,
        weekday: num(d.weekday) ? d.weekday : 0, time: d.time || '12:00', end: d.end || '13:00', label: String(d.label || 'Blockzeit'),
      };
      if (d.date) block.date = d.date;
      upsertBy('blocks', block);
      if (inHub()) hubSend('POST', '/blocks', block);
      return block.id;
    },

    /* ---- Daten zurücksetzen / Import / Export ---- */
    resetDemo() { return resetTo('demo'); },
    resetEmpty() { return resetTo('empty'); },
    /* Alle Chats löschen (wie „Alle Chats löschen" in v2). Praxen, Termine, Labels bleiben. */
    clearAll() {
      cancelAllJobs();
      const ids = state.chats.map((c) => c.id);
      set({ chats: [], typing: {} });
      ids.forEach((id) => markRemoved(id));
      unreadableChatIds.forEach((id) => { blocked.delete(dataPrefix(state.mode) + 'chat:' + id); markRemoved(id); });
      unreadableChatIds.clear();
      blocked.delete(dataPrefix(state.mode) + 'chatIndex');
      if (inHub()) ids.forEach((id) => hubSend('DELETE', '/chats/' + id));
    },
    exportJSON() {
      return clone({
        app: 'VetNow', kind: 'vetnow-export', schema: DATA_SCHEMA, version: APP_VERSION, flavor, mode: state.mode,
        exportedAt: now(), settings: state.settings, auth: state.auth, practices: state.practices, chats: state.chats,
        labels: state.labels, appointments: state.appointments, blocks: state.blocks, clockOffsetMs: state.clockOffsetMs,
      });
    },
    importJSON(input) {
      let obj = input;
      if (typeof obj === 'string') {
        try { obj = JSON.parse(obj); } catch { const e = new Error('Die Datei ist kein gültiges JSON.'); setError(e.message); throw e; }
      }
      if (!isObj(obj)) { const e = new Error('Unbekanntes Format.'); setError(e.message); throw e; }
      let parts;
      if (Array.isArray(obj.chats) || Array.isArray(obj.practices)) {
        if (num(obj.schema) && obj.schema > DATA_SCHEMA) { const e = new Error('Die Datei stammt aus einer neueren VetNow-Version.'); setError(e.message); throw e; }
        parts = obj;
      } else if (hasV1Data({ chats: obj.vn_chats_v1, labels: obj.vn_labels_v1, settings: obj.vn_chat_settings_v2, auth: obj.vn_auth, hideTestData: obj.vn_hide_testdata })) {
        const mig = migrateV1({ chats: obj.vn_chats_v1, labels: obj.vn_labels_v1, settings: obj.vn_chat_settings_v2, settingsV1: obj.vn_chat_settings_v1, auth: obj.vn_auth, hideTestData: obj.vn_hide_testdata }, now(), { practices: state.practices });
        parts = applyMigration({ practices: state.practices, chats: [], labels: state.labels, appointments: state.appointments, blocks: state.blocks, settings: state.settings }, mig);
      } else {
        const e = new Error('Die Datei enthält keine VetNow-Daten.');
        setError(e.message);
        throw e;
      }
      if (inHub()) {
        hubSend('POST', '/admin/import', obj, { admin: true, queue: false });
        return { chats: (parts.chats || []).length, practices: (parts.practices || []).length, via: 'hub' };
      }
      cancelAllJobs();
      replaceLocalData({
        practices: Array.isArray(parts.practices) ? parts.practices : state.practices,
        chats: (Array.isArray(parts.chats) ? parts.chats : []).filter(isObj).map((c) => normalizeChat(c, now())),
        labels: Array.isArray(parts.labels) ? parts.labels : state.labels,
        appointments: Array.isArray(parts.appointments) ? parts.appointments : state.appointments,
        blocks: Array.isArray(parts.blocks) ? parts.blocks : state.blocks,
      });
      if (isObj(parts.settings)) { set({ settings: mergeSettings(state.settings, parts.settings) }); markDirty('settings'); }
      return { chats: state.chats.length, practices: state.practices.length, via: 'local' };
    },

    /* ---- Hub ---- */
    connectHub(url) { return connectHub(url); },
    disconnectHub() { return disconnectHub(); },
    async probeHubs(candidates) {
      const list = Array.isArray(candidates) && candidates.length ? candidates : resolveHubCandidates({
        platform, origin: o.origin, hostUri: o.hostUri, envUrl: o.hubUrl, saved: hubCfg.url,
      });
      const results = await probeHubList(list, { fetch: fetchFn });
      setHub({ candidates: results });
      return results;
    },
    async hubAdminLogin(password) {
      if (!hub) { setError('Nicht mit einem Hub verbunden.'); return false; }
      try {
        const r = await hub.adminLogin(password);
        adminToken = (r && r.token) || '';
        return !!adminToken;
      } catch (e) {
        setError(hubErrorText(e));
        return false;
      }
    },
    setAdminToken(token) {
      adminToken = token || '';
      if (hub) hub.setAdminToken(adminToken);
    },
    /* Anhang für den Hub hochladen → attachment { kind, name, mime, size, ref:'hub:<id>' }.
       Lokal: null (dann bleibt die App bei data:/idb:/file://). */
    async uploadAttachment(data, name, mime) {
      if (!inHub() || !hub) return null;
      const r = await hub.uploadFile(data, name, mime);
      const m = (r && r.mime) || mime || '';
      return { kind: m.indexOf('image/') === 0 ? 'image' : 'file', name: String(name || 'Anhang'), mime: m, size: (r && r.size) || 0, ref: (r && r.ref) || ('hub:' + (r && r.id)) };
    },

    /* ---- Test-Hilfen ---- */
    /* Nachricht der GEGENSEITE simulieren (ohne Auto-Antwort) — z. B. „Tierhalter:in schreibt". */
    injectIncoming(chatId, text, from) {
      const c = getChat(chatId);
      if (!c) { setError('Chat nicht gefunden.'); return null; }
      const side = from === 'owner' || from === 'clinic' ? from : otherSide(sideOf(c));
      const msg = newMessage({ from: side, text: String(text == null ? '' : text), now: now(), meta: { injected: true } });
      msg.clientMsgId = msg.id;
      if (inHub()) {
        appendMessage(c.id, { ...msg, pending: true }, { bumpUnreadFor: otherSide(side) });
        hubSend('POST', '/chats/' + c.id + '/messages', { id: msg.id, from: side, type: 'text', text: msg.text, clientMsgId: msg.clientMsgId, meta: msg.meta }, { kind: 'message', chatId: c.id });
      } else {
        appendMessage(c.id, msg, { bumpUnreadFor: otherSide(side) });
      }
      return msg;
    },
    /* Antwort der Gegenseite sofort erzwingen (auch wenn autoReply aus ist). Nur lokal —
       im Hub-Modus antwortet ausschließlich der Hub. */
    forceAutoReply(chatId) {
      const c = getChat(chatId);
      if (!c) return false;
      if (inHub()) { setError('Im Hub-Modus antwortet der Hub selbst — dafür im Admin-Center „Simulation" nutzen.'); return false; }
      const side = state.auth.role ? otherSide(sideOf(c)) : replySideFor(c, c.messages[c.messages.length - 1]);
      const settings = state.settings.botMode === 'off' ? { ...state.settings, botMode: 'bot' } : state.settings;
      return scheduleReply(c.id, 'force-' + uid('r'), { side, settings });
    },
    setClockOffset(ms) {
      const v = num(Number(ms)) ? Math.round(Number(ms)) : 0;
      applyClock(v);
      markDirty('clock');
      if (inHub()) hubSend('POST', '/admin/clock', { offsetMs: v }, { admin: true, queue: false });
      return v;
    },
  };

  function replaceLocalData(parts) {
    // Ausdrücklicher Wunsch der Nutzer:in (Reset/Import) → gesperrte Schlüssel dürfen jetzt überschrieben werden.
    const p = dataPrefix(state.mode);
    DATA_KEYS.forEach((k) => blocked.delete(p + k));
    blocked.delete(p + 'chatIndex');
    unreadableChatIds.forEach((id) => { blocked.delete(p + 'chat:' + id); removedChats.add(id); });
    unreadableChatIds.clear();
    const oldIds = state.chats.map((c) => c.id);
    set({ ...parts, typing: {} });
    const newIds = new Set(state.chats.map((c) => c.id));
    oldIds.forEach((id) => { if (!newIds.has(id)) markRemoved(id); });
    markAllData();
  }

  function resetTo(kind) {
    if (inHub()) {
      hubSend('POST', '/admin/reset', { seed: kind === 'empty' ? 'empty' : 'demo' }, { admin: true, queue: false });
      return true;
    }
    cancelAllJobs();
    const seed = kind === 'empty' ? buildEmptySeed(now()) : buildDemoSeed(now());
    replaceLocalData({
      practices: seed.practices, chats: seed.chats.map((c) => normalizeChat(c, now())), labels: seed.labels,
      appointments: seed.appointments, blocks: seed.blocks,
    });
    return true;
  }

  /* ------------------------------------------------------------------ Start */
  const ready = (async () => {
    try {
      await init();
    } catch (e) {
      setError('Start fehlgeschlagen: ' + ((e && e.message) || e));
    }
    set({ ready: true });
    if (!destroyed && o.autoConnect !== false && ((hubCfg.enabled && hubCfg.url) || (o.hubUrl && o.autoConnect === true))) {
      connectHub(hubCfg.enabled && hubCfg.url ? hubCfg.url : o.hubUrl);
    }
    return true;
  })();

  return {
    getState: () => state,
    subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    actions,
    ready,
    flush,
    /* Hilfen für die Oberflächen */
    getChat,
    resolveId,
    getVisibleChats: () => viewChats(state),
    getUnreadTotal: () => countUnread(state),
    hubClient: () => hub,
    aiClient: () => (state.mode === 'local' ? localAi() : null),
    pendingReplies: () => Array.from(jobs.keys()),
    async destroy() {
      destroyed = true;
      cancelAllJobs();
      stopHubClient();
      await flush();
      listeners.clear();
    },
  };
}
