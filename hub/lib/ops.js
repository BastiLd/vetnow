/* VetNow Hub — alle Zustandsänderungen an EINER Stelle.

   Warum eine eigene Schicht zwischen HTTP und Speicher?
   Dieselben Änderungen werden von drei Seiten ausgelöst: von der REST-API (Clients), vom
   Admin-Simulator (/admin/simulate) und von der Auto-Antwort (Bot/KI). Lägen Prüfungen und
   Ereignisse in den Routen, gäbe es drei leicht unterschiedliche Kopien — genau die Art Drift,
   die v3 abschaffen soll. Hier gilt für jeden Weg: prüfen → ändern → Ereignis senden → speichern.

   Regeln:
   - Eingaben werden geprüft; Fehler sind HttpError mit deutscher Meldung (→ 400/404/409).
   - Texte werden WORTGETREU gespeichert (auch <script>): Escapen ist Aufgabe der Clients.
     Verdächtiges Markup wird aber im Admin-Protokoll vermerkt.
   - Unbekannte Felder (v. a. `meta` an Nachrichten) werden unverändert durchgereicht (Vertrag §4).
   - Zeitstempel kommen von der Hub-Uhr inkl. simulierter Zeitverschiebung (store.now()). */
import { HttpError, badRequest, notFound } from './http.js';
import { isId, isPlainObject, clone, deepMerge, clamp, ISO_DATE_RX, TIME_RX, looksLikeMarkup } from './util.js';
import { chatMeta, buildSeedState, normalizeState } from './store.js';
import { FILE_ID_RX, referencedFileIds } from './files.js';
import { uid, newMessage, migrateV1, SITUATIONS, ANIMAL_LABEL, DEMO_OWNER } from './shared.js';

export const CHAT_KINDS = ['request', 'direct', 'network'];
export const FROM_SIDES = ['owner', 'clinic', 'system'];
export const MSG_TYPES = ['text', 'image', 'file', 'note'];
export const SOURCES = ['ai', 'ai-vision', 'bot', 'mock-ai', 'error'];
export const STATUS_VALUES = ['green', 'yellow', 'red', 'grey'];
export const APPT_STATUSES = ['open', 'confirmed', 'done', 'cancelled'];
export const BOT_MODES = ['ai-fallback', 'ai', 'bot', 'off'];
export const AI_PROVIDERS = ['auto', 'mock', 'ollama', 'anthropic', 'openai'];
export const MAX_TEXT = 20000;

const ANIMALS = () => Object.keys(ANIMAL_LABEL || {});
const SITUATION_LABEL = () => Object.fromEntries((SITUATIONS || []).map((s) => [s.key, s.label]));
const ANIMAL_ICON = { cat: 'cat', dog: 'dog', small: 'rabbit', horse: 'horse', bird: 'bird', exotic: 'turtle', other: 'paw' };
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const optStr = (v, max = 200) => (v === undefined || v === null ? undefined : String(v).slice(0, max));
const bool = (v) => v === true || v === 'true' || v === 1;

/* Felder, die der Hub selbst verwaltet — ein Client darf sie nicht „durchreichen". */
const MSG_RESERVED = new Set(['id', 'ts', 'editedAt', 'deleted', 'deletedAt', 'reactions', 'rating', 'from', 'type', 'text', 'attachment', 'source', 'clientMsgId']);
const CHAT_RESERVED = new Set(['id', 'kind', 'practiceId', 'peerPracticeId', 'messages', 'createdAt', 'updatedAt', 'labels', 'pinned', 'unread', 'autoReply', 'isTestData']);
const PRACTICE_RESERVED = new Set(['id', 'status', 'absence']);

function passthrough(src, reserved) {
  const out = {};
  if (!isPlainObject(src)) return out;
  for (const [k, v] of Object.entries(src)) {
    if (reserved.has(k) || k === '__proto__' || k === 'constructor' || k === 'prototype' || v === undefined) continue;
    out[k] = clone(v);
  }
  return out;
}

export function createOps({ store, files = null, log = null, random = Math.random } = {}) {
  let messageHook = null; // (chat, message) → Auto-Antwort einplanen
  let chatDeletedHook = null;
  const now = () => store.now();
  const S = () => store.state;

  const requirePractice = (id) => {
    if (!isId(id)) throw badRequest('Ungültige Praxis-ID.', 'bad-id');
    const p = store.practice(id);
    if (!p) throw notFound('Praxis nicht gefunden.');
    return p;
  };
  const requireChat = (id) => {
    if (!isId(id)) throw badRequest('Ungültige Chat-ID.', 'bad-id');
    const c = store.chat(id);
    if (!c) throw notFound('Chat nicht gefunden.');
    return c;
  };
  const emitPractice = (p) => store.emit('practice', { practice: clone(p) });
  const emitChat = (c) => store.emit('chat', { chat: chatMeta(c) });

  /* ------------------------------------------------------------ Praxen */
  function updatePractice(id, patch) {
    const p = requirePractice(id);
    if (!isPlainObject(patch)) throw badRequest('Erwartet ein Objekt mit den zu ändernden Feldern.');
    const clean = passthrough(patch, PRACTICE_RESERVED);
    for (const [k, v] of Object.entries(clean)) {
      p[k] = isPlainObject(v) && isPlainObject(p[k]) ? deepMerge(p[k], v) : v;
    }
    // Nur die Notiz am Status darf per PATCH geändert werden — Wert und Ablauf laufen über /status.
    if (isPlainObject(patch.status) && 'note' in patch.status) {
      p.status = { ...(p.status || {}), note: optStr(patch.status.note, 500) || '' };
    }
    emitPractice(p);
    return p;
  }

  /* { value, hours=24, note? } bestätigt · { expire:true } lässt sofort ablaufen ·
     { expiresInMs } (Simulator) lässt in X ms ablaufen. 'grey' = „nicht bestätigt" (value null). */
  function setStatus(id, body = {}) {
    const p = requirePractice(id);
    if (!isPlainObject(body)) throw badRequest('Erwartet { value, hours } oder { expire:true }.');
    const t = now();
    const cur = isPlainObject(p.status) ? p.status : {};
    if (body.expire === true || body.expiresInMs !== undefined) {
      const inMs = Number(body.expiresInMs) || 0;
      // Beim sofortigen Ablauf eine Sekunde in die Vergangenheit: Clients mit minimal
      // nachgehender Uhr sollen den Status trotzdem schon grau sehen.
      p.status = { ...cur, expiresAt: inMs > 0 ? t + inMs : t - 1000 };
      emitPractice(p);
      return p;
    }
    if (!STATUS_VALUES.includes(body.value)) throw badRequest('Ungültiger Status (erlaubt: green, yellow, red, grey).', 'bad-status');
    if (body.value === 'grey') {
      p.status = { value: null, setAt: null, expiresAt: null, ...(body.note ? { note: str(body.note, 500) } : {}) };
    } else {
      const hours = body.hours === undefined ? 24 : Number(body.hours);
      if (!Number.isFinite(hours) || hours <= 0) throw badRequest('„hours" muss eine positive Zahl sein.', 'bad-hours');
      const h = clamp(hours, 1 / 3600, 24 * 14);
      p.status = { value: body.value, setAt: t, expiresAt: Math.round(t + h * 3600e3) };
      if (body.note !== undefined && body.note !== null && body.note !== '') p.status.note = str(body.note, 500);
    }
    emitPractice(p);
    return p;
  }

  const toTs = (v) => (typeof v === 'number' ? v : (typeof v === 'string' ? Date.parse(v) : NaN));

  function setAbsence(id, body) {
    const p = requirePractice(id);
    const a = isPlainObject(body) && 'absence' in body && !('from' in body) ? body.absence : body;
    if (a === null || a === undefined || (isPlainObject(a) && Object.keys(a).length === 0)) {
      p.absence = null;
    } else {
      if (!isPlainObject(a)) throw badRequest('Erwartet { from, to, vertretung } oder null.');
      const from = toTs(a.from);
      const to = toTs(a.to);
      if (!Number.isFinite(from) || !Number.isFinite(to)) throw badRequest('„from" und „to" müssen Zeitstempel (ms) oder ISO-Daten sein.', 'bad-absence');
      if (to <= from) throw badRequest('Das Ende der Abwesenheit muss nach dem Beginn liegen.', 'bad-absence');
      p.absence = { from, to, ...(a.vertretung ? { vertretung: str(a.vertretung, 200) } : {}) };
    }
    emitPractice(p);
    return p;
  }

  /* ------------------------------------------------------------ Nachrichten */
  function buildMessage(data, { keepTs = false } = {}) {
    if (!isPlainObject(data)) throw badRequest('Nachricht muss ein Objekt sein.');
    const from = data.from;
    if (!FROM_SIDES.includes(from)) throw badRequest('„from" muss owner, clinic oder system sein.', 'bad-from');
    let attachment;
    if (data.attachment !== undefined && data.attachment !== null) {
      const a = data.attachment;
      if (!isPlainObject(a)) throw badRequest('Ungültiger Anhang.', 'bad-attachment');
      const ref = str(a.ref, 16 * 1024 * 1024);
      if (!ref) throw badRequest('Anhang ohne „ref".', 'bad-attachment');
      if (ref.startsWith('hub:') && !FILE_ID_RX.test(ref.slice(4))) throw badRequest('Ungültiger Hub-Dateiverweis.', 'bad-attachment');
      attachment = {
        ...passthrough(a, new Set(['kind', 'name', 'mime', 'size', 'ref'])),
        kind: a.kind === 'image' ? 'image' : 'file',
        name: str(a.name, 200) || 'anhang',
        mime: str(a.mime, 120) || 'application/octet-stream',
        size: Number.isFinite(Number(a.size)) ? Number(a.size) : 0,
        ref,
      };
    }
    const type = data.type === undefined ? (attachment ? (attachment.kind === 'image' ? 'image' : 'file') : 'text') : data.type;
    if (!MSG_TYPES.includes(type)) throw badRequest('Ungültiger Nachrichtentyp.', 'bad-type');
    if (data.text !== undefined && data.text !== null && typeof data.text !== 'string') throw badRequest('„text" muss Text sein.', 'bad-text');
    const text = data.text || '';
    if (text.length > MAX_TEXT) throw new HttpError(413, `Die Nachricht ist zu lang (max. ${MAX_TEXT} Zeichen).`, 'too-long');
    if (!text.trim() && !attachment) throw badRequest('Leere Nachricht.', 'empty');
    const source = SOURCES.includes(data.source) ? data.source : undefined;
    const clientMsgId = data.clientMsgId ? str(String(data.clientMsgId), 100) : undefined;
    const ts = keepTs && Number.isFinite(data.ts) ? data.ts : now();
    const base = newMessage({ from, type, text, attachment, source, clientMsgId, ts });
    const msg = {
      ...passthrough(data, MSG_RESERVED), // meta & Co. unverändert
      ...base,
      id: isId(data.id) ? data.id : (base && isId(base.id) ? base.id : uid('m')),
      ts,
      from, type, text,
    };
    if (attachment) msg.attachment = attachment; else delete msg.attachment;
    if (source) msg.source = source; else delete msg.source;
    if (clientMsgId) msg.clientMsgId = clientMsgId; else delete msg.clientMsgId;
    for (const k of Object.keys(msg)) if (msg[k] === undefined) delete msg[k];
    return msg;
  }

  function bumpUnread(chat, from) {
    chat.unread = chat.unread || { owner: 0, clinic: 0 };
    if (from === 'owner') chat.unread.clinic = (chat.unread.clinic || 0) + 1;
    else if (from === 'clinic') chat.unread.owner = (chat.unread.owner || 0) + 1;
  }

  /* → { message, duplicate }. `schedule:false` für Bot-/KI-Antworten und Abschlussnotizen. */
  function addMessage(chatId, data, { schedule = true } = {}) {
    const chat = requireChat(chatId);
    // Idempotent: Die Outbox eines Clients schickt nach einem Verbindungsabbruch evtl. doppelt.
    if (isPlainObject(data) && data.clientMsgId) {
      const dup = chat.messages.find((m) => m.clientMsgId === String(data.clientMsgId));
      if (dup) return { message: dup, duplicate: true };
    }
    if (isPlainObject(data) && isId(data.id)) {
      const dup = chat.messages.find((m) => m.id === data.id);
      if (dup) return { message: dup, duplicate: true };
    }
    const msg = buildMessage(data);
    chat.messages.push(msg);
    chat.updatedAt = msg.ts;
    bumpUnread(chat, msg.from);
    store.emit('message', { chatId: chat.id, message: clone(msg) });
    emitChat(chat);
    if (log && looksLikeMarkup(msg.text)) log.warn(`Nachricht mit HTML/Script-Inhalt gespeichert (Chat ${chat.id}, ${msg.id}) — wird wortgetreu weitergegeben, Clients müssen escapen.`);
    if (schedule && messageHook) messageHook(chat, msg);
    return { message: msg, duplicate: false };
  }

  function updateMessage(chatId, mid, patch) {
    const chat = requireChat(chatId);
    if (!isId(mid)) throw badRequest('Ungültige Nachrichten-ID.', 'bad-id');
    const m = chat.messages.find((x) => x.id === mid);
    if (!m) throw notFound('Nachricht nicht gefunden.');
    if (!isPlainObject(patch)) throw badRequest('Erwartet { text } · { deleted:true } · { reaction } · { rating }.');
    let changed = false;
    if (patch.deleted === true) {
      const oldRef = m.attachment && m.attachment.ref;
      m.deleted = true;
      m.deletedAt = now();
      m.text = '';
      delete m.attachment;
      changed = true;
      if (typeof oldRef === 'string' && oldRef.startsWith('hub:')) pruneFiles([oldRef.slice(4)]);
    }
    if (typeof patch.text === 'string') {
      if (m.deleted) throw new HttpError(409, 'Gelöschte Nachrichten können nicht bearbeitet werden.', 'deleted');
      if (patch.text.length > MAX_TEXT) throw new HttpError(413, `Die Nachricht ist zu lang (max. ${MAX_TEXT} Zeichen).`, 'too-long');
      if (!patch.text.trim() && !m.attachment) throw badRequest('Leere Nachricht.', 'empty');
      m.text = patch.text;
      m.editedAt = now();
      changed = true;
      if (log && looksLikeMarkup(m.text)) log.warn(`Bearbeitete Nachricht mit HTML/Script-Inhalt (Chat ${chat.id}, ${m.id}).`);
    }
    if (patch.reaction !== undefined) {
      const r = patch.reaction;
      if (!isPlainObject(r) || !['owner', 'clinic'].includes(r.side)) throw badRequest('„reaction" braucht { side: owner|clinic, emoji }.', 'bad-reaction');
      m.reactions = isPlainObject(m.reactions) ? m.reactions : {};
      const emoji = typeof r.emoji === 'string' ? r.emoji.slice(0, 16) : '';
      if (emoji) m.reactions[r.side] = emoji; else delete m.reactions[r.side];
      if (!Object.keys(m.reactions).length) delete m.reactions;
      changed = true;
    }
    if (patch.rating !== undefined) {
      if (patch.rating === null || patch.rating === 0) delete m.rating;
      else {
        const n = Number(patch.rating);
        if (!Number.isInteger(n) || n < 1 || n > 5) throw badRequest('„rating" muss 1 bis 5 Sterne sein.', 'bad-rating');
        m.rating = n;
      }
      changed = true;
    }
    if (!changed) throw badRequest('Nichts zu ändern (erlaubt: text, deleted, reaction, rating).');
    chat.updatedAt = Math.max(chat.updatedAt || 0, now());
    store.emit('message:update', { chatId: chat.id, message: clone(m) });
    return m;
  }

  function markRead(chatId, side) {
    const chat = requireChat(chatId);
    if (!['owner', 'clinic'].includes(side)) throw badRequest('„side" muss owner oder clinic sein.', 'bad-side');
    chat.unread = { owner: 0, clinic: 0, ...(chat.unread || {}), [side]: 0 };
    store.emit('read', { chatId: chat.id, side });
    return chat;
  }

  function typing(chatId, from, on) {
    const chat = requireChat(chatId);
    if (!['owner', 'clinic'].includes(from)) throw badRequest('„from" muss owner oder clinic sein.', 'bad-from');
    // Flüchtig: Tipp-Anzeigen werden weder gespeichert noch nach einem Neustart nachgeliefert.
    return store.emit('typing', { chatId: chat.id, from, on: !!on }, { persist: false });
  }

  /* ------------------------------------------------------------ Chats */
  function normLabels(v) {
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((x) => typeof x === 'string' && x && x.length <= 60))].slice(0, 30);
  }
  const normPinned = (v, base = {}) => {
    const out = { ...base };
    if (isPlainObject(v)) for (const side of ['owner', 'clinic']) if (side in v) out[side] = bool(v[side]);
    return out;
  };
  const normUnread = (v, base = { owner: 0, clinic: 0 }) => {
    const out = { owner: base.owner || 0, clinic: base.clinic || 0 };
    if (isPlainObject(v)) for (const side of ['owner', 'clinic']) if (side in v) out[side] = clamp(Math.floor(Number(v[side]) || 0), 0, 1e6);
    return out;
  };

  /* → { chat, created } */
  function createChat(data) {
    if (!isPlainObject(data)) throw badRequest('Chat-Daten fehlen.');
    if (data.id !== undefined && data.id !== null && data.id !== '') {
      if (!isId(data.id)) throw badRequest('Ungültige Chat-ID.', 'bad-id');
      const existing = store.chat(data.id);
      if (existing) return { chat: existing, created: false }; // idempotent (Outbox-Wiederholung)
    }
    const kind = data.kind === undefined ? 'direct' : data.kind;
    if (!CHAT_KINDS.includes(kind)) throw badRequest('„kind" muss request, direct oder network sein.', 'bad-kind');
    requirePractice(data.practiceId);
    let peerPracticeId;
    if (kind === 'network') {
      requirePractice(data.peerPracticeId);
      if (data.peerPracticeId === data.practiceId) throw badRequest('Eine Praxis kann nicht mit sich selbst chatten.', 'bad-peer');
      peerPracticeId = data.peerPracticeId;
    }
    const t = now();
    const chat = {
      ...passthrough(data, CHAT_RESERVED),
      id: isId(data.id) ? data.id : uid('ch'),
      kind,
      practiceId: data.practiceId,
      ...(peerPracticeId ? { peerPracticeId } : {}),
      animal: ANIMALS().includes(data.animal) ? data.animal : 'other',
      color: HEX_COLOR.test(data.color || '') ? data.color : '#0f9b8e',
      icon: str(data.icon, 40) || ANIMAL_ICON[data.animal] || 'paw',
      labels: normLabels(data.labels),
      pinned: normPinned(data.pinned),
      unread: normUnread(data.unread),
      autoReply: bool(data.autoReply),
      isTestData: bool(data.isTestData),
      createdAt: t,
      updatedAt: t,
      messages: [],
    };
    if (kind !== 'network') {
      chat.ownerId = str(data.ownerId, 80) || DEMO_OWNER.ownerId;
      chat.ownerName = str(data.ownerName, 120) || (chat.ownerId === DEMO_OWNER.ownerId ? DEMO_OWNER.name : 'Tierhalter:in');
    }
    const initial = Array.isArray(data.messages) ? data.messages.slice(0, 500) : [];
    for (const m of initial) chat.messages.push(buildMessage(m, { keepTs: true }));
    chat.messages.sort((a, b) => a.ts - b.ts);
    if (chat.messages.length) chat.updatedAt = Math.max(t, chat.messages[chat.messages.length - 1].ts);
    S().chats.push(chat);
    emitChat(chat);
    for (const m of chat.messages) store.emit('message', { chatId: chat.id, message: clone(m) });
    const last = chat.messages[chat.messages.length - 1];
    if (last && messageHook) messageHook(chat, last);
    return { chat, created: true };
  }

  function updateChat(id, patch) {
    const chat = requireChat(id);
    if (!isPlainObject(patch)) throw badRequest('Erwartet ein Objekt mit den zu ändernden Feldern.');
    Object.assign(chat, passthrough(patch, CHAT_RESERVED));
    if ('labels' in patch) chat.labels = normLabels(patch.labels);
    if ('pinned' in patch) chat.pinned = normPinned(patch.pinned, chat.pinned);
    if ('unread' in patch) chat.unread = normUnread(patch.unread, chat.unread);
    if ('autoReply' in patch) chat.autoReply = bool(patch.autoReply);
    if ('isTestData' in patch) chat.isTestData = bool(patch.isTestData);
    if ('animal' in patch) chat.animal = ANIMALS().includes(patch.animal) ? patch.animal : chat.animal;
    if ('color' in patch && !HEX_COLOR.test(String(patch.color))) throw badRequest('Ungültige Farbe (#RRGGBB).', 'bad-color');
    chat.updatedAt = Math.max(chat.updatedAt || 0, now());
    emitChat(chat);
    return chat;
  }

  function deleteChat(id) {
    const chat = requireChat(id);
    S().chats = S().chats.filter((c) => c.id !== id);
    if (chatDeletedHook) chatDeletedHook(id);
    store.emit('chat:deleted', { id });
    // Termine, die auf diesen Chat zeigten, verlieren nur die Verknüpfung (der Termin bleibt).
    for (const a of S().appointments) {
      if (a.chatId === id) { delete a.chatId; store.emit('appointment', { appointment: clone(a) }); }
    }
    const fileIds = [];
    for (const m of chat.messages) {
      const ref = m.attachment && m.attachment.ref;
      if (typeof ref === 'string' && ref.startsWith('hub:')) fileIds.push(ref.slice(4));
    }
    if (fileIds.length) pruneFiles(fileIds);
    return { id };
  }

  /* Anhänge löschen, auf die keine Nachricht mehr zeigt (läuft im Hintergrund). */
  function pruneFiles(candidates) {
    if (!files || !candidates.length) return;
    const still = new Set(referencedFileIds(S()));
    for (const id of candidates) {
      if (!still.has(id) && FILE_ID_RX.test(id)) files.remove(id).catch((e) => log && log.warn('Anhang konnte nicht gelöscht werden: ' + e.message));
    }
  }

  /* ------------------------------------------------------------ Anfrage → Chat */
  function createRequest(body) {
    if (!isPlainObject(body)) throw badRequest('Anfrage-Daten fehlen.');
    const practice = requirePractice(body.practiceId);
    const situation = typeof body.situation === 'string' ? body.situation : '';
    const emergency = situation === 'emergency';
    const labelOf = SITUATION_LABEL();
    const ownerId = str(body.ownerId, 80) || DEMO_OWNER.ownerId;
    const ownerName = str(body.ownerName || body.name, 120) || (ownerId === DEMO_OWNER.ownerId ? DEMO_OWNER.name : 'Tierhalter:in');
    const animal = ANIMALS().includes(body.animal) ? body.animal : 'other';
    const text = str(body.message, MAX_TEXT).trim() || (emergency
      ? 'Guten Tag, es handelt sich um einen Notfall. Bitte rufen Sie mich so schnell wie möglich zurück.'
      : 'Guten Tag, ich hätte gern einen Termin.');
    const first = { from: 'owner', type: 'text', text };
    if (body.clientMsgId) first.clientMsgId = body.clientMsgId;
    const { chat, created } = createChat({
      id: body.chatId || body.id || undefined,
      kind: 'request',
      practiceId: practice.id,
      ownerId,
      ownerName,
      petName: str(body.petName, 80),
      animal,
      topic: str(body.topic, 120) || labelOf[situation] || 'Anfrage',
      situation: situation || undefined,
      phone: str(body.phone, 60) || undefined,
      district: str(body.district, 60) || undefined,
      color: emergency ? '#dc2626' : '#0f9b8e',
      icon: ANIMAL_ICON[animal] || 'paw',
      labels: ['posteingang', ...(emergency ? ['notfall'] : [])],
      unread: { owner: 0, clinic: 1 },
      autoReply: body.autoReply !== false,
      isTestData: bool(body.isTestData),
      messages: [first],
    });
    return { chat, created };
  }

  /* ------------------------------------------------------------ Labels */
  function createLabel(data) {
    if (!isPlainObject(data)) throw badRequest('Label-Daten fehlen.');
    const name = str(data.name, 40).trim();
    if (!name) throw badRequest('Das Label braucht einen Namen.', 'bad-name');
    if (data.id !== undefined && data.id !== '') {
      if (!isId(data.id)) throw badRequest('Ungültige Label-ID.', 'bad-id');
      const ex = store.label(data.id);
      if (ex) return { label: ex, created: false };
    }
    const roles = Array.isArray(data.roles) ? data.roles.filter((r) => r === 'owner' || r === 'clinic') : [];
    const label = {
      id: isId(data.id) ? data.id : uid('lb'),
      name,
      color: HEX_COLOR.test(data.color || '') ? data.color : '#6c7d79',
      icon: str(data.icon, 40) || 'tag',
      roles: roles.length ? [...new Set(roles)] : ['owner', 'clinic'],
      seed: false,
    };
    S().labels.push(label);
    store.emit('label', { label: clone(label) });
    return { label, created: true };
  }

  function updateLabel(id, patch) {
    if (!isId(id)) throw badRequest('Ungültige Label-ID.', 'bad-id');
    const l = store.label(id);
    if (!l) throw notFound('Label nicht gefunden.');
    if (!isPlainObject(patch)) throw badRequest('Erwartet ein Objekt.');
    if ('name' in patch) { const n = str(patch.name, 40).trim(); if (!n) throw badRequest('Das Label braucht einen Namen.', 'bad-name'); l.name = n; }
    if ('color' in patch) { if (!HEX_COLOR.test(String(patch.color))) throw badRequest('Ungültige Farbe (#RRGGBB).', 'bad-color'); l.color = patch.color; }
    if ('icon' in patch) l.icon = str(patch.icon, 40) || l.icon;
    if ('roles' in patch) {
      const roles = Array.isArray(patch.roles) ? patch.roles.filter((r) => r === 'owner' || r === 'clinic') : [];
      if (!roles.length) throw badRequest('Ein Label braucht mindestens eine Rolle (owner/clinic).', 'bad-roles');
      l.roles = [...new Set(roles)];
    }
    store.emit('label', { label: clone(l) });
    return l;
  }

  function deleteLabel(id) {
    if (!isId(id)) throw badRequest('Ungültige Label-ID.', 'bad-id');
    const l = store.label(id);
    if (!l) throw notFound('Label nicht gefunden.');
    if (l.seed) throw new HttpError(409, 'Standard-Labels können nicht gelöscht werden.', 'seed-label');
    S().labels = S().labels.filter((x) => x.id !== id);
    store.emit('label:deleted', { id });
    for (const c of S().chats) {
      if (c.labels && c.labels.includes(id)) { c.labels = c.labels.filter((x) => x !== id); emitChat(c); }
    }
    return { id };
  }

  /* ------------------------------------------------------------ Termine & Blockzeiten */
  function listAppointments({ practiceId, from, to } = {}) {
    return S().appointments.filter((a) => (!practiceId || a.practiceId === practiceId)
      && (!from || a.date >= from) && (!to || a.date <= to))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  function checkAppt(a) {
    if (!ISO_DATE_RX.test(a.date || '')) throw badRequest('„date" muss YYYY-MM-DD sein.', 'bad-date');
    if (!TIME_RX.test(a.time || '')) throw badRequest('„time" muss HH:MM sein.', 'bad-time');
    if (!APPT_STATUSES.includes(a.status)) throw badRequest('Ungültiger Termin-Status.', 'bad-status');
    if (a.chatId && !store.chat(a.chatId)) throw badRequest('Der verknüpfte Chat existiert nicht.', 'bad-chat');
  }

  function createAppointment(data) {
    if (!isPlainObject(data)) throw badRequest('Termin-Daten fehlen.');
    requirePractice(data.practiceId);
    if (data.id !== undefined && data.id !== '') {
      if (!isId(data.id)) throw badRequest('Ungültige Termin-ID.', 'bad-id');
      const ex = store.appointment(data.id);
      if (ex) return { appointment: ex, created: false };
    }
    const a = {
      ...passthrough(data, new Set(['id', 'practiceId', 'date', 'time', 'durationMin', 'name', 'animal', 'status', 'reason', 'chatId', 'note', 'isTestData'])),
      id: isId(data.id) ? data.id : uid('ap'),
      practiceId: data.practiceId,
      date: data.date,
      time: data.time,
      durationMin: clamp(Math.round(Number(data.durationMin) || 30), 5, 600),
      name: str(data.name, 120) || 'Termin',
      animal: ANIMALS().includes(data.animal) ? data.animal : 'other',
      status: data.status === undefined ? 'open' : data.status,
      reason: str(data.reason, 300),
      isTestData: bool(data.isTestData),
    };
    if (data.chatId) a.chatId = data.chatId;
    if (data.note) a.note = str(data.note, 2000);
    checkAppt(a);
    S().appointments.push(a);
    store.emit('appointment', { appointment: clone(a) });
    return { appointment: a, created: true };
  }

  function updateAppointment(id, patch) {
    if (!isId(id)) throw badRequest('Ungültige Termin-ID.', 'bad-id');
    const a = store.appointment(id);
    if (!a) throw notFound('Termin nicht gefunden.');
    if (!isPlainObject(patch)) throw badRequest('Erwartet ein Objekt.');
    const next = { ...a, ...passthrough(patch, new Set(['id', 'practiceId', 'noteMessageId'])) };
    if ('durationMin' in patch) next.durationMin = clamp(Math.round(Number(patch.durationMin) || 30), 5, 600);
    if ('note' in patch) next.note = str(patch.note, 2000);
    if (next.chatId === null || next.chatId === '') delete next.chatId;
    checkAppt(next);
    Object.assign(a, next);
    if (!next.chatId) delete a.chatId;
    let noteMessage = null;
    // Abschlussnotiz: landet als Nachricht (type 'note') im verknüpften Chat — so sieht die
    // Tierhalter:in sie und kann Sterne vergeben. Gleiche Notiz zweimal → nur einmal senden.
    if (patch.status === 'done' && typeof patch.note === 'string' && patch.note.trim() && a.chatId && store.chat(a.chatId)) {
      const chat = store.chat(a.chatId);
      const already = a.noteMessageId && chat.messages.find((m) => m.id === a.noteMessageId && m.text === a.note);
      if (!already) {
        noteMessage = addMessage(a.chatId, { from: 'clinic', type: 'note', text: a.note, meta: { appointmentId: a.id } }, { schedule: false }).message;
        a.noteMessageId = noteMessage.id;
      }
    }
    store.emit('appointment', { appointment: clone(a) });
    return { appointment: a, noteMessage };
  }

  function deleteAppointment(id) {
    if (!isId(id)) throw badRequest('Ungültige Termin-ID.', 'bad-id');
    if (!store.appointment(id)) throw notFound('Termin nicht gefunden.');
    S().appointments = S().appointments.filter((a) => a.id !== id);
    store.emit('appointment:deleted', { id });
    return { id };
  }

  function createBlock(data) {
    if (!isPlainObject(data)) throw badRequest('Blockzeit-Daten fehlen.');
    requirePractice(data.practiceId);
    const weekday = Number(data.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw badRequest('„weekday" muss 0 (Mo) bis 6 (So) sein.', 'bad-weekday');
    if (!TIME_RX.test(data.time || '') || !TIME_RX.test(data.end || '')) throw badRequest('„time" und „end" müssen HH:MM sein.', 'bad-time');
    if (data.end <= data.time) throw badRequest('Das Ende muss nach dem Beginn liegen.', 'bad-time');
    const b = { id: isId(data.id) ? data.id : uid('bl'), practiceId: data.practiceId, weekday, time: data.time, end: data.end, label: str(data.label, 80) || 'Blockzeit' };
    S().blocks.push(b);
    store.emit('block', { block: clone(b) });
    return b;
  }

  /* ------------------------------------------------------------ Einstellungen & Uhr */
  function updateSettings(patch) {
    if (!isPlainObject(patch)) throw badRequest('Erwartet ein Objekt mit Einstellungen.');
    const clean = {};
    for (const [k, v] of Object.entries(patch)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (k === 'botMode') {
        if (!BOT_MODES.includes(v)) throw badRequest('Ungültiger botMode (ai-fallback, ai, bot, off).', 'bad-setting');
        clean.botMode = v;
      } else if (k === 'ai') {
        if (!isPlainObject(v)) throw badRequest('„ai" muss ein Objekt sein.', 'bad-setting');
        const ai = {};
        for (const [ak, av] of Object.entries(v)) {
          if (ak === 'provider') {
            if (!AI_PROVIDERS.includes(av)) throw badRequest('Ungültiger KI-Anbieter (auto, mock, ollama, anthropic, openai).', 'bad-setting');
            ai.provider = av;
          } else if (ak === 'ollamaUrl' || ak === 'openaiUrl') {
            if (av && !/^https?:\/\/[^\s]{1,200}$/i.test(String(av))) throw badRequest(`„${ak}" muss eine http(s)-Adresse sein.`, 'bad-setting');
            ai[ak] = av ? String(av) : '';
          } else if (typeof av === 'string' || typeof av === 'boolean' || typeof av === 'number') {
            ai[ak] = typeof av === 'string' ? av.slice(0, 200) : av;
          }
        }
        clean.ai = ai;
      } else if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string' || v === null) {
        clean[k] = typeof v === 'string' ? v.slice(0, 500) : v;
      }
    }
    S().settings = deepMerge(S().settings, clean);
    store.emit('settings', { settings: clone(S().settings) });
    return S().settings;
  }

  const MAX_OFFSET = 5 * 365 * 24 * 3600e3;
  function setClock(body = {}) {
    if (!isPlainObject(body)) throw badRequest('Erwartet { offsetMs } · { iso } · { reset:true }.');
    let offset;
    if (body.reset === true) offset = 0;
    else if (body.iso !== undefined) {
      const t = Date.parse(String(body.iso));
      if (!Number.isFinite(t)) throw badRequest('Ungültiges Datum in „iso".', 'bad-clock');
      offset = t - Date.now();
    } else if (body.offsetMs !== undefined) {
      offset = Number(body.offsetMs);
      if (!Number.isFinite(offset)) throw badRequest('„offsetMs" muss eine Zahl sein.', 'bad-clock');
    } else if (body.addMs !== undefined) {
      offset = (S().clockOffsetMs || 0) + (Number(body.addMs) || 0);
    } else throw badRequest('Erwartet { offsetMs } · { iso } · { reset:true }.', 'bad-clock');
    offset = Math.round(clamp(offset, -MAX_OFFSET, MAX_OFFSET));
    S().clockOffsetMs = offset;
    store.emit('clock', { offsetMs: offset });
    return { offsetMs: offset, now: now(), iso: new Date(now()).toISOString() };
  }

  /* ------------------------------------------------------------ Reset & Import */
  function reset(kind = 'demo') {
    if (!['demo', 'empty'].includes(kind)) throw badRequest('„seed" muss demo oder empty sein.', 'bad-seed');
    const offset = S().clockOffsetMs || 0;
    const next = buildSeedState(kind, Date.now() + offset);
    next.clockOffsetMs = offset;
    if (chatDeletedHook) for (const c of S().chats) chatDeletedHook(c.id);
    store.replaceState(next, { mode: kind });
    if (files) files.prune(referencedFileIds(S())).catch(() => {});
    return { ok: true, rev: store.rev, mode: kind };
  }

  const V1_KEYS = ['vn_chats_v1', 'vn_labels_v1', 'vn_chat_settings_v2', 'vn_chat_settings_v1', 'vn_auth', 'vn_hide_testdata'];

  /* Akzeptiert: Hub-Export, App-Export (store.exportJSON, auch nur mit einzelnen Teilen — fehlende
     Teile bleiben wie sie sind) und alte v1-Exporte (localStorage-Schlüssel vn_*), die über
     shared/migrate.js (migrateV1) übernommen werden. */
  function importState(input) {
    let src = isPlainObject(input) && isPlainObject(input.state) ? input.state : input;
    if (!isPlainObject(src)) throw badRequest('Kein gültiger VetNow-Export.', 'bad-import');
    const cur = S();
    let migratedFrom = null;
    if (!Array.isArray(src.practices) && !Array.isArray(src.chats) && V1_KEYS.some((k) => src[k] != null && src[k] !== '')) {
      const mig = migrateV1({
        chats: src.vn_chats_v1, labels: src.vn_labels_v1, settings: src.vn_chat_settings_v2,
        settingsV1: src.vn_chat_settings_v1, auth: src.vn_auth, hideTestData: src.vn_hide_testdata,
      }, now(), { practices: cur.practices });
      const ids = new Set((mig.chats || []).map((c) => c.id));
      const settings = deepMerge(cur.settings, isPlainObject(mig.settings) ? mig.settings : {});
      if (typeof mig.hideTestData === 'boolean') settings.hideTestData = mig.hideTestData;
      src = {
        ...clone(cur),
        chats: (mig.chats || []).concat(clone(cur.chats).filter((c) => !ids.has(c.id))),
        labels: Array.isArray(mig.labels) ? mig.labels : clone(cur.labels),
        settings,
      };
      migratedFrom = 'v1';
    }
    if (!Array.isArray(src.practices) && !Array.isArray(src.chats)) {
      throw badRequest('Kein gültiger VetNow-Export (erwartet practices[] und/oder chats[]).', 'bad-import');
    }
    // Fehlende Teile (z. B. Export nur mit Chats) übernehmen den aktuellen Stand statt ihn zu leeren.
    for (const k of ['practices', 'chats', 'labels', 'appointments', 'blocks']) if (!Array.isArray(src[k])) src = { ...src, [k]: clone(cur[k]) };
    if (!isPlainObject(src.settings)) src = { ...src, settings: clone(cur.settings) };
    if (Number.isFinite(src.schema) && src.schema > 3) throw badRequest('Der Export stammt aus einer neueren VetNow-Version.', 'bad-import');
    for (const c of src.chats) {
      if (!isPlainObject(c) || !isId(c.id)) throw badRequest('Import enthält einen Chat ohne gültige ID.', 'bad-import');
    }
    for (const p of src.practices) {
      if (!isPlainObject(p) || !isId(p.id)) throw badRequest('Import enthält eine Praxis ohne gültige ID.', 'bad-import');
    }
    const n = normalizeState(src);
    // Termine, deren Chat im Import fehlt, verlieren nur die Verknüpfung (wie beim Löschen eines Chats).
    const chatIds = new Set(n.chats.map((c) => c.id));
    for (const a of n.appointments) if (a.chatId && !chatIds.has(a.chatId)) delete a.chatId;
    // Nachrichten aus fremden Exporten (ältere Apps, Handarbeit) auf die Pflichtfelder bringen —
    // sonst stolpern Clients über fehlende IDs oder ts-Strings wie 'jetzt'.
    const t = now();
    for (const c of n.chats) {
      const seen = new Set();
      c.messages = c.messages.map((m) => {
        const out = { ...m };
        if (!isId(out.id) || seen.has(out.id)) out.id = uid('m');
        seen.add(out.id);
        if (!Number.isFinite(out.ts)) out.ts = t;
        if (!FROM_SIDES.includes(out.from)) out.from = 'system';
        if (!MSG_TYPES.includes(out.type)) out.type = 'text';
        if (typeof out.text !== 'string') out.text = out.text == null ? '' : String(out.text);
        return out;
      });
    }
    if (chatDeletedHook) for (const c of S().chats) chatDeletedHook(c.id);
    store.replaceState(n, { mode: src.mode === 'empty' ? 'empty' : (src.mode === 'demo' ? 'demo' : cur.mode) });
    if (files) files.prune(referencedFileIds(S())).catch(() => {});
    return { ok: true, rev: store.rev, counts: counts(), ...(migratedFrom ? { migratedFrom } : {}) };
  }

  function counts() {
    const s = S();
    return {
      practices: s.practices.length,
      chats: s.chats.length,
      messages: s.chats.reduce((n, c) => n + c.messages.length, 0),
      labels: s.labels.length,
      appointments: s.appointments.length,
      blocks: s.blocks.length,
    };
  }

  return {
    random,
    setMessageHook(fn) { messageHook = fn; },
    setChatDeletedHook(fn) { chatDeletedHook = fn; },
    requirePractice, requireChat,
    updatePractice, setStatus, setAbsence,
    buildMessage, addMessage, updateMessage, markRead, typing,
    createChat, updateChat, deleteChat, createRequest,
    createLabel, updateLabel, deleteLabel,
    listAppointments, createAppointment, updateAppointment, deleteAppointment, createBlock,
    updateSettings, setClock, reset, importState, counts,
  };
}
