/* ============================================================================================
   NOTBEHELF für fehlende shared/-Module — wird NUR über ./shared.js benutzt.
   ============================================================================================
   Warum gibt es das?
   `shared/` entsteht parallel zum Hub. Damit der Hub trotzdem startet und getestet werden kann,
   liefert diese Datei minimale Versionen der vertraglich festgelegten Funktionen
   (docs/V3-ARCHITEKTUR.md §5) — gleiche Namen, gleiche Signaturen, gleiche Rückgabeformen.

   Wichtig: Das ist KEIN Ersatz für shared/. Sobald shared/ vollständig ist, wird hier nichts mehr
   verwendet (./shared.js bevorzugt immer shared/). Ist doch etwas aktiv, meldet der Selbsttest
   den Check „shared-module" rot, und der Hub schreibt beim Start eine Warnung.
   ============================================================================================ */
import { randomBytes } from 'node:crypto';

// Bot: shared/bot/index.js existiert bereits (Adapter auf Bot 2.2). Fällt auch der weg,
// antwortet der Notbehelf mit einem festen, sicheren Satz statt abzustürzen.
let bot = null;
try { bot = await import(new URL('../../shared/bot/index.js', import.meta.url).href); } catch { bot = null; }

export const APP_VERSION = '3.0.0';
export const PROTOCOL = 3;
export const DATA_SCHEMA = 3;

export const SETTINGS_DEFAULT = Object.freeze({
  botMode: 'ai-fallback', typing: true, greeting: true, agentEnabled: true, showLabels: true,
  enableOwner: true, enablePosteingang: true, enableNetwork: true, hideTestData: false,
  ai: { provider: 'auto', model: '', visionModel: '' },
});

export const LABELS_SEED = Object.freeze([
  { id: 'tiere', name: 'Meine Tiere', color: '#0f9b8e', icon: 'paw2', roles: ['owner'], seed: true },
  { id: 'posteingang', name: 'Praxis-Posteingang', color: '#2e6f9e', icon: 'building', roles: ['clinic'], seed: true },
  { id: 'netzwerk', name: 'Praxis-Netzwerk', color: '#8a5d05', icon: 'shield', roles: ['clinic'], seed: true },
  { id: 'notfall', name: 'Notfall', color: '#dc2626', icon: 'siren', roles: ['owner', 'clinic'], seed: true },
  { id: 'termin', name: 'Termin', color: '#16a34a', icon: 'cal', roles: ['owner', 'clinic'], seed: true },
  { id: 'erledigt', name: 'Erledigt', color: '#6c7d79', icon: 'check', roles: ['owner', 'clinic'], seed: true },
]);

export const SITUATIONS = Object.freeze([
  { key: 'emergency', label: 'Notfall' },
  { key: 'regular', label: 'Normale Termine' },
  { key: 'euthanasia', label: 'Einschläferung' },
  { key: 'housecall', label: 'Hausbesuch' },
]);

export const ANIMAL_LABEL = Object.freeze({
  cat: 'Katze', dog: 'Hund', small: 'Kleintiere', horse: 'Pferd', bird: 'Vogel', exotic: 'Reptilien/Exoten', other: 'Anderes',
});

export const DEMO_OWNER = Object.freeze({ ownerId: 'owner-demo', name: 'Familie Berger' });
export const DEMO_PRACTICE_ID = 'drautal';

/* uid('ch') → 'ch-…'. Akzeptiert auch 'ch-' (ohne doppelten Bindestrich). */
export function uid(prefix = 'id') {
  const p = String(prefix).replace(/-+$/, '');
  return p + '-' + Date.now().toString(36) + randomBytes(5).toString('hex');
}

const RANK = { green: 0, yellow: 1, grey: 2, red: 3 };

export function effectiveStatus(p, now = Date.now()) {
  if (!p) return 'grey';
  const a = p.absence;
  if (a && typeof a.from === 'number' && typeof a.to === 'number' && now >= a.from && now <= a.to) return 'red';
  const s = p.status || {};
  if (!s.value || !(s.value in RANK) || s.value === 'grey') return 'grey';
  if (typeof s.expiresAt === 'number' && now > s.expiresAt) return 'grey';
  return s.value;
}

export function withLiveStatus(practices, now = Date.now()) {
  return (practices || []).map((p) => ({ ...p, live: effectiveStatus(p, now) }));
}

export function newMessage({ from = 'owner', type = 'text', text = '', attachment, source, clientMsgId, ts, id } = {}) {
  const m = { id: id || uid('m'), ts: typeof ts === 'number' ? ts : Date.now(), from, type, text: String(text || '') };
  if (attachment) m.attachment = attachment;
  if (source) m.source = source;
  if (clientMsgId) m.clientMsgId = clientMsgId;
  return m;
}

/* v1-Übernahme (Import alter localStorage-Exporte) — ohne shared/migrate.js nicht möglich. */
export function migrateV1() {
  return { chats: [], labels: null, settings: null, auth: null, hideTestData: null, report: { errors: ['Migration nicht verfügbar (shared/migrate.js fehlt).'] } };
}

export function personaFor(chat, lastMsg) {
  if (chat && chat.kind === 'network') return 'colleague';
  return lastMsg && lastMsg.from === 'clinic' ? 'owner' : 'clinic';
}

export function shouldAutoReply(chat, lastMsg, settings) {
  if (!chat || !chat.autoReply || !lastMsg) return false;
  if (!settings || settings.botMode === 'off') return false;
  if (lastMsg.from === 'system' || lastMsg.type === 'note' || lastMsg.source || lastMsg.deleted) return false;
  return true;
}

export function vetSystemPrompt(persona, practiceName) {
  if (persona === 'owner') {
    return 'Du bist ein freundlicher Tierhalter bzw. eine Tierhalterin aus Kärnten (Österreich) und antwortest der Tierarztpraxis im Chat. '
      + 'Antworte IMMER auf Deutsch, kurz (1–3 Sätze). Bittet dich jemand ausdrücklich, ein bestimmtes Wort zu sagen, dann sage GENAU dieses Wort.';
  }
  if (persona === 'colleague') {
    return 'Du bist eine Kollegin bzw. ein Kollege aus einer anderen Tierarztpraxis in Kärnten und antwortest im Praxis-Netzwerk. '
      + 'Antworte IMMER auf Deutsch, kurz und kollegial.';
  }
  const P = practiceName || 'VetNow Kärnten';
  return `Du bist das freundliche Praxisteam der Tierarztpraxis "${P}" in Kärnten (Österreich). Antworte IMMER auf Deutsch (Sie-Form), kurz (1–4 Sätze). `
    + 'Keine Ferndiagnosen, keine Medikamente oder Dosierungen; bei Notfall-Anzeichen sofort zum Anruf raten. '
    + 'Bittet dich jemand ausdrücklich, ein bestimmtes Wort zu sagen, dann sage GENAU dieses Wort.';
}

function b64Of(ref) {
  if (typeof ref !== 'string') return '';
  if (ref.startsWith('data:')) { const i = ref.indexOf(','); return i > 0 ? ref.slice(i + 1) : ''; }
  if (ref.startsWith('hub:')) return ref; // löst der Hub selbst auf (ai/registry.js)
  return '';
}

export function toAiMessages(messages, persona, { maxTurns = 10 } = {}) {
  const mySide = persona === 'clinic' ? 'clinic' : 'owner';
  const recent = (messages || []).filter((m) => m && !m.deleted).slice(-maxTurns);
  let lastImg = -1;
  recent.forEach((m, i) => { if (m.type === 'image' && m.attachment && b64Of(m.attachment.ref)) lastImg = i; });
  return recent.map((m, i) => {
    const role = m.from === mySide ? 'assistant' : 'user';
    if (m.type === 'note') return { role: 'assistant', content: '[Abschlussnotiz] ' + (m.text || '') };
    if (m.type === 'file') return { role, content: '[Datei gesendet: ' + ((m.attachment && m.attachment.name) || 'Anhang') + ']' + (m.text ? ' ' + m.text : '') };
    if (m.type === 'image') {
      const img = i === lastImg ? b64Of(m.attachment.ref) : '';
      const out = { role, content: m.text || (img ? 'Bitte sieh dir dieses Bild an.' : '[Bild gesendet]') };
      if (img) out.images = [img];
      return out;
    }
    return { role, content: m.text || '' };
  });
}

export function botReply({ messages = [], userText = '', persona = 'clinic', practiceName = '' } = {}) {
  if (bot && typeof bot.botReply === 'function') return bot.botReply({ messages, userText, persona, practiceName });
  return {
    texts: ['Danke für Ihre Nachricht. Bei akuten Notfällen rufen Sie bitte sofort an.'],
    intent: 'fallback', confidence: 0, entities: {}, explain: { normalized: String(userText).toLowerCase(), scores: [] },
  };
}

export function botImageReply(persona) {
  if (bot && typeof bot.botImageReply === 'function') return bot.botImageReply(persona);
  return 'Danke für das Bild.';
}

export const BOT_SUITE = (bot && Array.isArray(bot.BOT_SUITE)) ? bot.BOT_SUITE : [];
export function runBotSuite() {
  if (bot && typeof bot.runBotSuite === 'function') return bot.runBotSuite();
  return { passed: 0, failed: 0, total: 0, results: [] };
}

/* Auto-Antwort nach Vertrag: → { messages:[{text, source}], typingMs:number[] } */
export async function generateAutoReply({ chat, practices = [], settings = SETTINGS_DEFAULT, ai = null, now = Date.now(), signal } = {}) {
  void now;
  const msgs = (chat && chat.messages) || [];
  const last = msgs[msgs.length - 1];
  if (!chat || !last) return { messages: [], typingMs: [] };
  const persona = personaFor(chat, last);
  const practice = practices.find((p) => p.id === chat.practiceId);
  const practiceName = practice ? practice.name : '';
  const typing = (t) => Math.min(3500, 600 + String(t).length * 20);
  const mode = settings.botMode || 'ai-fallback';
  const viaBot = () => {
    const r = last.type === 'image'
      ? { texts: [botImageReply(persona)] }
      : botReply({ messages: msgs.slice(0, -1), userText: last.text || '', persona, practiceName });
    const texts = (r.texts || []).filter(Boolean);
    return { messages: texts.map((text) => ({ text, source: 'bot' })), typingMs: texts.map(typing) };
  };
  if (mode === 'off') return { messages: [], typingMs: [] };
  if (mode === 'bot' || !ai) return viaBot();
  try {
    const history = toAiMessages(msgs, persona, { maxTurns: 10 });
    const res = await ai.chat({ messages: [{ role: 'system', content: vetSystemPrompt(persona, practiceName) }, ...history], signal, persona });
    const source = res.provider === 'mock' ? 'mock-ai' : (res.vision ? 'ai-vision' : 'ai');
    return { messages: [{ text: res.text, source }], typingMs: [typing(res.text)] };
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    if (mode === 'ai-fallback' && (!e || e.code === 'offline')) return viaBot();
    const text = '⚠️ Die KI konnte nicht antworten: ' + ((e && e.message) || 'Unbekannter Fehler.');
    return { messages: [{ text, source: 'error' }], typingMs: [typing(text)] };
  }
}

/* ---- Minimal-Seed (nur 3 Praxen, 3 Chats) — der echte Seed kommt aus shared/seed.js ---- */
function practice(id, name, district, districtLong, value, ageHours, now, extra = {}) {
  const setAt = now - ageHours * 3600e3;
  return {
    id, name, district, districtLong, address: '—', phone: '+43 000 000000',
    specialties: [], animals: ['cat', 'dog', 'small'], services: ['emergency', 'regular'],
    hoursShort: 'Mo–Fr 8–18', hoursWeek: ['8–18', '8–18', '8–18', '8–18', '8–18', 'geschlossen', 'geschlossen'],
    emergency: '', emergencyLong: '', isTestData: true,
    status: { value, setAt, expiresAt: setAt + 24 * 3600e3 }, absence: null, ...extra,
  };
}

export function buildDemoSeed(now = Date.now()) {
  const m = (id, from, text, minsAgo, extra = {}) => ({ id, ts: now - minsAgo * 60e3, from, type: 'text', text, ...extra });
  const chat = (c) => ({
    color: '#0f9b8e', icon: 'paw', labels: [], pinned: {}, unread: { owner: 0, clinic: 0 }, autoReply: true,
    isTestData: true, createdAt: now - 3 * 3600e3, updatedAt: now - 60e3, messages: [], ...c,
  });
  const today = new Date(now);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    practices: [
      practice('drautal', 'Tierarztpraxis Drautal', 'Villach', 'Villach', 'green', 2, now),
      practice('woerthersee', 'Tiernotdienst Wörthersee 24h', 'Klagenfurt', 'Klagenfurt', 'green', 3, now),
      practice('lieser', 'Kleintierpraxis Lieser', 'Spittal', 'Spittal an der Drau', 'yellow', 30, now),
    ],
    chats: [
      chat({ id: 'ch-o1', kind: 'request', practiceId: 'drautal', ownerId: 'owner-demo', ownerName: 'Familie Berger', petName: 'Balu', animal: 'dog', topic: 'Lahmheit', labels: ['tiere', 'posteingang'],
        messages: [m('m-o1a', 'owner', 'Guten Morgen, unser Hund Balu humpelt seit heute früh. Können wir heute vorbeikommen?', 90),
          m('m-o1b', 'clinic', 'Guten Morgen! Kommen Sie gerne vorbei, wir sehen ihn uns an.', 80)] }),
      chat({ id: 'ch-c2', kind: 'request', practiceId: 'drautal', ownerId: 'owner-2', ownerName: 'Herr Gruber', petName: 'Mimi', animal: 'cat', topic: 'Impfung', labels: ['posteingang'],
        messages: [m('m-c2a', 'owner', 'Wann ist die nächste Impfung für Mimi fällig?', 30)], unread: { owner: 0, clinic: 1 } }),
      chat({ id: 'ch-n1', kind: 'network', practiceId: 'drautal', peerPracticeId: 'woerthersee', animal: 'other', labels: ['netzwerk'],
        messages: [m('m-n1a', 'owner', 'Hallo Kolleg:innen, habt ihr heute Nacht noch Kapazität?', 20)] }),
    ],
    labels: LABELS_SEED.map((l) => ({ ...l, roles: [...l.roles] })),
    appointments: [
      { id: 'ap-1', practiceId: 'drautal', date: iso(today), time: '09:30', durationMin: 30, name: 'Familie Berger', animal: 'dog', status: 'confirmed', reason: 'Lahmheit', chatId: 'ch-o1', isTestData: true },
      { id: 'ap-2', practiceId: 'drautal', date: iso(today), time: '11:00', durationMin: 20, name: 'Herr Gruber', animal: 'cat', status: 'open', reason: 'Impfung', chatId: 'ch-c2', isTestData: true },
    ],
    blocks: [
      { practiceId: 'drautal', weekday: 0, time: '12:00', end: '13:00', label: 'Mittagspause' },
    ],
    settings: { ...SETTINGS_DEFAULT, ai: { ...SETTINGS_DEFAULT.ai } },
  };
}

export function buildEmptySeed(now = Date.now()) {
  void now;
  return {
    practices: [], chats: [], appointments: [], blocks: [],
    labels: LABELS_SEED.map((l) => ({ ...l, roles: [...l.roles] })),
    settings: { ...SETTINGS_DEFAULT, ai: { ...SETTINGS_DEFAULT.ai } },
  };
}
