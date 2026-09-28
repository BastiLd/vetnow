// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* VetNow — Chat-Modell: wer sieht welchen Chat, wie heißt er aus welcher Sicht, was ist ungelesen.

   Kernidee (Vertrag §4): EIN Chat-Datensatz pro Unterhaltung, beide Seiten lesen ihn.
   In v2 hatte jede Seite ihre eigene Kopie (role:'owner' vs. role:'clinic') — eine Antwort der
   Praxis kam bei der Tierhalter:in nie an. Jetzt entscheidet die Anmeldung (auth), aus welcher
   SICHT ein Chat gezeigt wird:
     - Tierhalter:in: request/direct mit ownerId === auth.ownerId → Rubrik 'owner' („Meine Tiere")
     - Praxis:        request/direct mit practiceId === auth.practiceId → Rubrik 'clinic' (Posteingang)
                      network mit practiceId ODER peerPracticeId === auth.practiceId → Rubrik 'network'
   unread/pinned sind pro SEITE gespeichert ({ owner, clinic }), nicht pro Person. */
import { ANIMAL_SINGULAR, DEMO_OWNER } from './constants.js';
import { uid } from './ids.js';
import { now as clockNow } from './clock.js';

export const SIDES = Object.freeze(['owner', 'clinic']);
export const CHAT_KINDS = Object.freeze(['request', 'direct', 'network']);

export function otherSide(side) {
  return side === 'owner' ? 'clinic' : 'owner';
}

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/* Welche Seite bin ich in diesem Chat? Tierhalter → 'owner'. Praxis → 'clinic', AUSSER sie ist
   im Netzwerk-Chat die angeschriebene Kollegin (peerPracticeId) → dann 'owner'
   (Vertrag §4: bei network ist 'clinic' = practiceId, 'owner' = peerPracticeId). */
export function mySide(chat, auth) {
  if (!auth || !auth.role) return null;
  if (auth.role === 'owner') return 'owner';
  if (chat && chat.kind === 'network' && chat.peerPracticeId && chat.peerPracticeId === auth.practiceId
    && chat.practiceId !== auth.practiceId) return 'owner';
  return 'clinic';
}

/* Rubrik des Chats für diese Anmeldung — oder null, wenn die Person ihn gar nicht sehen darf. */
export function rubricOf(chat, auth) {
  if (!chat || !auth || !auth.role) return null;
  const kind = chat.kind || 'direct';
  if (auth.role === 'owner') {
    const me = auth.ownerId || DEMO_OWNER.ownerId;
    return (kind === 'request' || kind === 'direct') && chat.ownerId === me ? 'owner' : null;
  }
  if (auth.role === 'clinic') {
    const pid = auth.practiceId;
    if (!pid) return null;
    if (kind === 'network') return chat.practiceId === pid || chat.peerPracticeId === pid ? 'network' : null;
    return chat.practiceId === pid ? 'clinic' : null;
  }
  return null;
}

/* practices darf ein Array oder eine Map/ein Objekt id → Praxis sein. */
function practiceLookup(practices) {
  if (!practices) return () => null;
  if (typeof practices.get === 'function') return (id) => practices.get(id) || null;
  if (Array.isArray(practices)) {
    const m = new Map();
    practices.forEach((p) => { if (p && p.id) m.set(p.id, p); });
    return (id) => m.get(id) || null;
  }
  if (isObj(practices)) return (id) => practices[id] || null;
  return () => null;
}

/* „Balu (Hund)" — Einzahl, weil „Hoppel (Kleintiere)" falsch klingt. */
export function petLabel(chat) {
  if (!chat) return '';
  const a = ANIMAL_SINGULAR[chat.animal] || '';
  if (chat.petName) return a ? chat.petName + ' (' + a + ')' : chat.petName;
  return a;
}

export function lastMessage(chat) {
  const ms = chat && Array.isArray(chat.messages) ? chat.messages : [];
  return ms.length ? ms[ms.length - 1] : null;
}

/* Zeitpunkt der letzten Aktivität — für die Sortierung der Liste. */
export function lastActivity(chat) {
  const m = lastMessage(chat);
  if (m && num(m.ts)) return m.ts;
  if (chat && num(chat.updatedAt)) return chat.updatedAt;
  if (chat && num(chat.createdAt)) return chat.createdAt;
  return 0;
}

/* Vorschautext für die Chat-Liste. side = meine Seite (dann „Sie: …"). */
export function previewText(msg, side) {
  if (!msg) return 'Noch keine Nachrichten';
  if (msg.deleted) return 'Nachricht gelöscht';
  let t;
  if (msg.type === 'image') t = msg.text ? 'Foto: ' + msg.text : 'Foto';
  else if (msg.type === 'file') t = 'Datei: ' + ((msg.attachment && msg.attachment.name) || msg.text || 'Anhang');
  else if (msg.type === 'note') t = 'Abschlussnotiz: ' + (msg.text || '');
  else t = msg.text || '';
  t = String(t).replace(/\s+/g, ' ').trim();
  if (t.length > 120) t = t.slice(0, 117) + '…';
  return side && msg.from === side ? 'Sie: ' + t : t;
}

/* Sicht auf einen Chat für eine Anmeldung — oder null, wenn er für sie unsichtbar ist.
   Titel/Untertitel wie im Vertrag §4. Eigene Titel: chat.titles[side] (pro Seite umbenannt)
   hat Vorrang, dann chat.title (aus v1 übernommene Chats), dann der berechnete Titel. */
export function chatView(chat, auth, practices) {
  const rubric = rubricOf(chat, auth);
  if (!rubric) return null;
  const find = practiceLookup(practices);
  const side = mySide(chat, auth);
  const practice = find(chat.practiceId);
  const peer = chat.peerPracticeId ? find(chat.peerPracticeId) : null;
  let title;
  let subtitle;
  let counterpartPractice = null;
  if (rubric === 'owner') {
    counterpartPractice = practice;
    title = (practice && practice.name) || 'Praxis';
    subtitle = [practice && practice.district, petLabel(chat)].filter(Boolean).join(' · ');
  } else if (rubric === 'clinic') {
    title = chat.ownerName || 'Tierhalter:in';
    subtitle = [petLabel(chat), chat.topic].filter(Boolean).join(' · ');
  } else {
    counterpartPractice = side === 'clinic' ? peer : practice;
    title = (counterpartPractice && counterpartPractice.name) || chat.peerName || 'Praxis-Netzwerk';
    subtitle = chat.topic || 'Praxis-Netzwerk';
  }
  const titles = isObj(chat.titles) ? chat.titles : {};
  const subs = isObj(chat.subs) ? chat.subs : {};
  if (titles[side]) title = titles[side];
  else if (chat.title) title = chat.title;
  if (subs[side]) subtitle = subs[side];
  else if (chat.sub) subtitle = chat.sub;
  const last = lastMessage(chat);
  const unread = isObj(chat.unread) ? Number(chat.unread[side]) || 0 : 0;
  const pinned = isObj(chat.pinned) ? !!chat.pinned[side] : !!chat.pinned;
  return {
    id: chat.id,
    chat,
    kind: chat.kind || 'direct',
    rubric,
    side,
    other: otherSide(side),
    title,
    subtitle,
    practice,
    peerPractice: peer,
    counterpartPractice,
    unread,
    pinned,
    last,
    lastTs: lastActivity(chat),
    preview: previewText(last, side),
    labels: Array.isArray(chat.labels) ? chat.labels : [],
    color: chat.color || '#0f9b8e',
    icon: chat.icon || 'chat',
    animal: chat.animal || 'other',
    petName: chat.petName || '',
    topic: chat.topic || '',
    isTestData: !!chat.isTestData,
    autoReply: !!chat.autoReply,
  };
}

/* Labels, die eine Rolle sehen darf (Tierhalter:innen sehen z. B. „Praxis-Posteingang" nicht).
   Labels ohne roles (alte/importierte) gelten für alle. */
export function labelsForRole(labels, role) {
  return (Array.isArray(labels) ? labels : []).filter((l) => l && (!Array.isArray(l.roles) || !role || l.roles.indexOf(role) >= 0));
}

/* Label-IDs eines Chats, die für diese Rolle sichtbar sind. */
export function visibleLabelIds(chat, labels, role) {
  const allowed = new Set(labelsForRole(labels, role).map((l) => l.id));
  return (chat && Array.isArray(chat.labels) ? chat.labels : []).filter((id) => allowed.has(id));
}

const RUBRIC_SETTING = { owner: 'enableOwner', clinic: 'enablePosteingang', network: 'enableNetwork' };

/* Sichtbare Chats für den aktuellen Zustand (Store-State oder { chats, auth, practices, settings }).
   Berücksichtigt: Anmeldung (abgemeldet → nichts), Rubrik-Schalter in den Einstellungen,
   „Testdaten ausblenden". Reihenfolge: für MEINE Seite angepinnte zuerst, dann neueste zuerst. */
export function visibleChats(state) {
  const s = state || {};
  const auth = s.auth;
  if (!auth || !auth.role) return [];
  const settings = s.settings || {};
  const hideTest = !!(settings.hideTestData || s.hideTestData);
  const find = practiceLookup(s.practices);
  const out = [];
  (Array.isArray(s.chats) ? s.chats : []).forEach((c) => {
    if (!c) return;
    if (hideTest && c.isTestData) return;
    const v = chatView(c, auth, { get: find });
    if (!v) return;
    if (settings[RUBRIC_SETTING[v.rubric]] === false) return;
    out.push(v);
  });
  out.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.lastTs !== b.lastTs) return b.lastTs - a.lastTs;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return out;
}

/* Summe der Ungelesenen über alle sichtbaren Chats (Tab-Badge). */
export function unreadTotal(state) {
  return visibleChats(state).reduce((sum, v) => sum + (v.unread || 0), 0);
}

/* Neue Nachricht nach Vertrag §4. ts wird IMMER als Zahl gespeichert (nie 'jetzt').
   Unbekannte Zusatzfelder (z. B. meta) werden durchgereicht. */
export function newMessage(input) {
  const o = input || {};
  const m = {
    id: o.id || uid('m'),
    ts: num(o.ts) ? o.ts : (num(o.now) ? o.now : clockNow()),
    from: o.from === 'clinic' || o.from === 'system' ? o.from : 'owner',
    type: o.type === 'image' || o.type === 'file' || o.type === 'note' ? o.type : 'text',
    text: o.text == null ? '' : String(o.text),
  };
  if (o.attachment) m.attachment = { ...o.attachment };
  if (o.source) m.source = o.source;
  if (o.clientMsgId) m.clientMsgId = o.clientMsgId;
  if (o.meta && isObj(o.meta)) m.meta = { ...o.meta };
  return m;
}

/* Chat-Datensatz mit allen Pflichtfeldern (für createChat, Migration, Import, Hub-Events).
   Unbekannte Felder bleiben erhalten. */
export function normalizeChat(data, nowTs) {
  const d = data || {};
  const n = num(nowTs) ? nowTs : clockNow();
  const kind = CHAT_KINDS.indexOf(d.kind) >= 0 ? d.kind : 'direct';
  const messages = Array.isArray(d.messages) ? d.messages.filter(isObj) : [];
  const pinned = isObj(d.pinned) ? { owner: !!d.pinned.owner, clinic: !!d.pinned.clinic } : { owner: false, clinic: false };
  const unread = isObj(d.unread)
    ? { owner: Math.max(0, Number(d.unread.owner) || 0), clinic: Math.max(0, Number(d.unread.clinic) || 0) }
    : { owner: 0, clinic: 0 };
  const created = num(d.createdAt) ? d.createdAt : (messages.length && num(messages[0].ts) ? messages[0].ts : n);
  const out = {
    ...d,
    id: d.id || uid('ch'),
    kind,
    practiceId: d.practiceId || null,
    animal: d.animal || 'other',
    color: d.color || '#0f9b8e',
    icon: d.icon || 'chat',
    labels: Array.isArray(d.labels) ? d.labels.filter((x) => typeof x === 'string') : [],
    pinned,
    unread,
    autoReply: !!d.autoReply,
    isTestData: !!d.isTestData,
    createdAt: created,
    updatedAt: num(d.updatedAt) ? d.updatedAt : created,
    messages,
  };
  if (kind !== 'network') delete out.peerPracticeId;
  return out;
}

/* Nachricht einfügen oder ersetzen — die Grundlage für idempotentes Einspielen von Hub-Events.
   Reihenfolge der Suche: 1. gleiche clientMsgId (optimistische Nachricht → Server-Version),
   2. gleiche id. Sonst wird nach ts einsortiert (neu hinten, ältere an die richtige Stelle).
   Rückgabe: { messages (neues Array), added (war sie neu?), index }. */
export function upsertMessage(messages, msg) {
  const list = Array.isArray(messages) ? messages : [];
  // Kaputtes Ereignis (null, Text …) → nichts einfügen statt mit TypeError abzustürzen.
  if (!isObj(msg)) return { messages: list.slice(), added: false, index: -1 };
  let idx = -1;
  if (msg.clientMsgId) idx = list.findIndex((m) => m && (m.clientMsgId === msg.clientMsgId || m.id === msg.clientMsgId));
  if (idx < 0 && msg.id) idx = list.findIndex((m) => m && m.id === msg.id);
  if (idx >= 0) {
    const merged = { ...list[idx], ...msg };
    delete merged.pending;
    delete merged.failed;
    const next = list.slice();
    next[idx] = merged;
    return { messages: next, added: false, index: idx };
  }
  const next = list.slice();
  let at = next.length;
  const ts = num(msg.ts) ? msg.ts : Infinity;
  while (at > 0 && num(next[at - 1].ts) && next[at - 1].ts > ts) at--;
  next.splice(at, 0, msg);
  return { messages: next, added: true, index: at };
}
