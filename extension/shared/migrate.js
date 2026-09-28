// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* VetNow — Übernahme der alten v1/v2-Speicherstände (localStorage im Web, AsyncStorage am Handy).

   Warum überhaupt? Tester:innen haben in v2 eigene Chats angelegt (Anfragen, Fotos, Notizen).
   Die sollen beim Umstieg auf v3 nicht einfach verschwinden (Web-/Mobile-Audit: „write a migration
   so existing test data survives"). Die alten Schlüssel werden NUR GELESEN, nie gelöscht —
   ein Zurück auf v2 bleibt damit möglich.

   Alte Formen (siehe Audits 3-web/2-mobile):
     vn_chats_v1          [{ id, role:'owner'|'clinic'|'network', title, sub, animal, color, icon, labels[],
                             pinned:bool, unread:number, isTestData, messages:[{ id?, from, text, time:'09:30'|
                             'jetzt'|'Gestern 16:20'|'Mo 19:02', type?, src?, srcB64?, fileName?, fileMime?,
                             source?, aiModel?, editedAt?, deleted?, deletedAt?, reactions? }] }]
     vn_labels_v1         [{ id, name, color, icon, seed }]
     vn_chat_settings_v2  { showLabels, enableOwner, enablePosteingang, enableNetwork, botEnabled, botTyping,
                            botGreeting, botMode, aiModel, aiBaseUrl, agentEnabled, … }   (v1: gleiche Form)
     vn_auth              { role:'owner'|'clinic', name }
     vn_hide_testdata     '1' | '0'

   Ergebnis: Schema-3-TEILZUSTAND { chats, labels, settings, auth, hideTestData, report }.
   Die alten Demo-Chats (ch-o1 … ch-n2) werden verworfen — der neue Seed enthält sie zusammengeführt. */
import { LABELS_SEED, DEMO_OWNER, DEMO_PRACTICE_ID, DEMO_PRACTICE } from './constants.js';
import { MINUTE, todayISO, addDays, tsAt, weekdayMon0, isoOf, parseISO } from './clock.js';
import { uid } from './ids.js';
import { demoPracticeNames } from './seed.js';

export const V1_KEYS = Object.freeze(['vn_chats_v1', 'vn_labels_v1', 'vn_chat_settings_v2', 'vn_chat_settings_v1', 'vn_auth', 'vn_hide_testdata']);
export const V1_SEED_CHAT_IDS = Object.freeze(['ch-o1', 'ch-o2', 'ch-o3', 'ch-c1', 'ch-c2', 'ch-c3', 'ch-c4', 'ch-n1', 'ch-n2']);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/* Werte kommen je nach Plattform als JSON-String (localStorage/AsyncStorage) oder schon geparst. */
function parseMaybe(v, errors, key) {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (e) {
    errors.push(key + ': kein gültiges JSON (' + (e && e.message ? e.message : 'unbekannt') + ')');
    return null;
  }
}

const WD = { mo: 0, di: 1, mi: 2, do: 3, fr: 4, sa: 5, so: 6 };

/* Alte Anzeige-Zeit → Zeitstempel (oder null, wenn unbekannt wie 'jetzt').
   Verstanden werden: '09:30', 'heute, 11:20', 'Gestern 16:20', 'gestern, 16:20', 'Mo 19:02',
   'Mo, 02.06.', '02.06.', '02.06.2026 14:00'. */
export function parseLegacyTime(str, nowTs) {
  const s = String(str == null ? '' : str).trim().toLowerCase();
  if (!s || s === 'jetzt') return null;
  const today = todayISO(nowTs);
  // Uhrzeit/Datum nur übernehmen, wenn sie gültig sind. Sonst rechnet Date still weiter:
  // '25:99' wurde zu „morgen 02:39", '31.02.' zum 03.03. — beides falsche Zeitstempel.
  const at = (iso, h, mi) => {
    if (!parseISO(iso) || +h > 23 || +mi > 59) return null;
    const ts = tsAt(iso, h + ':' + mi);
    return Number.isFinite(ts) ? ts : null;
  };
  let m = /^(heute,?\s*)?(\d{1,2})[:.](\d{2})$/.exec(s);
  if (m) return at(today, m[2], m[3]);
  m = /^gestern,?\s*(\d{1,2})[:.](\d{2})$/.exec(s);
  if (m) return at(addDays(today, -1), m[1], m[2]);
  if (s === 'gestern') return at(addDays(today, -1), '12', '00');
  m = /^(mo|di|mi|do|fr|sa|so)\.?,?\s*(\d{1,2})[:.](\d{2})$/.exec(s);
  if (m) {
    const d = (weekdayMon0(today) - WD[m[1]] + 7) % 7;
    return at(addDays(today, -(d === 0 ? 7 : d)), m[2], m[3]);
  }
  m = /^(?:(?:mo|di|mi|do|fr|sa|so)\.?,?\s*)?(\d{1,2})\.(\d{1,2})\.(\d{4})?,?\s*(?:(\d{1,2})[:.](\d{2}))?$/.exec(s);
  if (m) {
    const nowYear = +today.slice(0, 4);
    let y = m[3] ? +m[3] : nowYear;
    let iso = isoOf(y, +m[2] - 1, +m[1]);
    if (!parseISO(iso)) return null;
    // Ohne Jahr und in der Zukunft → war letztes Jahr gemeint.
    if (!m[3] && iso > today) { y -= 1; iso = isoOf(y, +m[2] - 1, +m[1]); }
    return m[4] ? at(iso, m[4], m[5]) : at(iso, '12', '00');
  }
  return null;
}

/* Praxis anhand eines Titels finden („Tierarztpraxis Drautal" → 'drautal'). */
function guessPracticeId(title, practices, exclude) {
  const t = String(title || '').trim().toLowerCase();
  if (!t) return null;
  const list = Array.isArray(practices) && practices.length
    ? practices.map((p) => [p.id, p.name])
    : Object.entries(demoPracticeNames());
  let hit = list.find(([id, name]) => id !== exclude && String(name).toLowerCase() === t);
  if (!hit) hit = list.find(([id, name]) => id !== exclude && (t.indexOf(String(name).toLowerCase()) >= 0 || String(name).toLowerCase().indexOf(t) >= 0) && t.length >= 6);
  return hit ? hit[0] : null;
}

/* 'Villach · Balu (Hund)' → 'Balu';  'Balu (Hund) · Lahmheit' → 'Balu' (+ topic 'Lahmheit'). */
function parseSub(sub) {
  const parts = String(sub || '').split('·').map((x) => x.trim()).filter(Boolean);
  let petName = '';
  let topic = '';
  parts.forEach((p, i) => {
    const m = /^(.+?)\s*\(([^)]+)\)$/.exec(p);
    if (m && !petName) {
      petName = m[1].trim();
      if (parts[i + 1]) topic = parts[i + 1];
    }
  });
  return { petName, topic };
}

function mimeOfDataUrl(src) {
  const m = /^data:([^;,]+)[;,]/.exec(String(src || ''));
  return m ? m[1] : '';
}
function sizeOfDataUrl(src) {
  const s = String(src || '');
  const i = s.indexOf(',');
  if (i < 0) return 0;
  const b64 = s.slice(i + 1);
  const pad = b64.slice(-2) === '==' ? 2 : b64.slice(-1) === '=' ? 1 : 0;
  return Math.max(0, Math.floor(b64.length * 3 / 4) - pad);
}
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic' };

/* Eine alte Nachricht → Message (Schema 3). */
function convertMessage(m, ts, report) {
  const type = m.type === 'image' || m.type === 'file' || m.type === 'note' ? m.type : 'text';
  let from = m.from === 'owner' || m.from === 'clinic' ? m.from : (type === 'note' ? 'clinic' : 'owner');
  if (m.from === 'system') from = 'system';
  const out = { id: typeof m.id === 'string' && m.id ? m.id : uid('m'), ts, from, type, text: m.text == null ? '' : String(m.text) };
  if (!m.deleted && (type === 'image' || type === 'file')) {
    // Web: src = data:-URL. Handy: src = file://-Pfad im Cache, srcB64 = dieselben Daten als Base64.
    // srcB64 wird NICHT übernommen: genau das hat den AsyncStorage (2 MB pro Wert) gesprengt.
    let ref = typeof m.src === 'string' ? m.src : '';
    if (!ref && typeof m.srcB64 === 'string' && m.srcB64) ref = 'data:' + (m.fileMime || 'image/jpeg') + ';base64,' + m.srcB64;
    if (ref) {
      const isData = ref.indexOf('data:') === 0;
      const mime = (isData && mimeOfDataUrl(ref)) || m.fileMime || (type === 'image' ? 'image/jpeg' : 'application/octet-stream');
      const name = m.fileName || (type === 'image' ? 'Foto.' + (EXT[mime] || 'jpg') : 'Anhang');
      out.attachment = { kind: type, name, mime, size: isData ? sizeOfDataUrl(ref) : 0, ref };
      if (type === 'image') report.images++; else report.files++;
    } else {
      report.errors.push('Anhang ohne Daten in Nachricht ' + out.id + ' — als Text übernommen.');
    }
  }
  ['source', 'aiModel', 'editedAt', 'deleted', 'deletedAt', 'reactions', 'rating', 'meta'].forEach((k) => {
    if (m[k] !== undefined) out[k] = m[k];
  });
  if (out.deleted) { out.text = ''; delete out.attachment; delete out.reactions; }
  return out;
}

/* Zeitstempel für alle Nachrichten eines Chats: parsen, was geht, und sicherstellen, dass die
   Reihenfolge stimmt und nichts in der Zukunft liegt. Fehlt eine Zeit ('jetzt'), wird sie
   von hinten nach vorn im Minutenabstand vor die nächste Nachricht gelegt. */
function assignTimestamps(msgs, baseTs, nowTs) {
  const out = new Array(msgs.length);
  let next = baseTs + MINUTE; // obere Schranke für die jeweils ältere Nachricht
  for (let j = msgs.length - 1; j >= 0; j--) {
    const p = parseLegacyTime(msgs[j] && msgs[j].time, nowTs);
    const upper = next - MINUTE;
    const ts = p != null && p <= upper ? p : upper;
    out[j] = ts;
    next = ts;
  }
  return out;
}

function convertChat(c, idx, ctx) {
  const { now, practices, ownerName, report } = ctx;
  const role = c.role === 'clinic' || c.role === 'network' ? c.role : 'owner';
  const baseTs = now - idx * MINUTE; // v1 legte neue Chats VORNE an → Index 0 = neuester
  const rawMsgs = (Array.isArray(c.messages) ? c.messages : []).filter(isObj);
  const tss = assignTimestamps(rawMsgs, baseTs, now);
  const messages = rawMsgs.map((m, j) => convertMessage(m, tss[j], report));
  report.messages += messages.length;
  const unread = Math.max(0, Number(c.unread) || 0);
  const { petName, topic } = parseSub(c.sub);
  const chat = {
    id: typeof c.id === 'string' && c.id ? c.id : uid('ch'),
    animal: c.animal || 'other',
    color: c.color || '#0f9b8e',
    icon: c.icon || 'chat',
    labels: Array.isArray(c.labels) ? c.labels.filter((x) => typeof x === 'string') : [],
    autoReply: true, // in v1 hat der Bot in JEDEM Chat geantwortet — Verhalten bleibt gleich
    isTestData: !!c.isTestData,
    createdAt: messages.length ? messages[0].ts : baseTs,
    updatedAt: messages.length ? messages[messages.length - 1].ts : baseTs,
    migratedFrom: 'v1',
    messages,
  };
  if (petName) chat.petName = petName;
  if (topic) chat.topic = topic;
  if (role === 'owner') {
    const pid = guessPracticeId(c.title, practices);
    chat.kind = 'direct';
    chat.practiceId = pid || DEMO_PRACTICE_ID;
    chat.ownerId = DEMO_OWNER.ownerId;
    chat.ownerName = ownerName;
    // Titel/Untertitel galten nur für die Tierhalter:in — die Praxis sieht ihre eigene Sicht.
    if (!pid && c.title) chat.titles = { owner: String(c.title) };
    if (c.sub) chat.subs = { owner: String(c.sub) };
    chat.pinned = { owner: !!c.pinned, clinic: false };
    chat.unread = { owner: unread, clinic: 0 };
  } else if (role === 'clinic') {
    chat.kind = 'direct';
    chat.practiceId = DEMO_PRACTICE_ID;
    chat.ownerId = 'owner-v1-' + chat.id.replace(/^ch-?/, '');
    chat.ownerName = String(c.title || 'Tierhalter:in');
    if (c.sub) chat.subs = { clinic: String(c.sub) };
    chat.pinned = { owner: false, clinic: !!c.pinned };
    chat.unread = { owner: 0, clinic: unread };
  } else {
    const peer = guessPracticeId(c.title, practices, DEMO_PRACTICE_ID);
    chat.kind = 'network';
    chat.practiceId = DEMO_PRACTICE_ID;
    chat.peerPracticeId = peer;
    if (!peer) { chat.peerName = String(c.title || 'Praxis'); chat.titles = { clinic: String(c.title || 'Praxis') }; }
    if (c.sub && !chat.topic) chat.topic = String(c.sub);
    chat.pinned = { owner: false, clinic: !!c.pinned };
    chat.unread = { owner: 0, clinic: unread };
  }
  return chat;
}

function convertLabels(list) {
  const seedById = {};
  LABELS_SEED.forEach((l) => { seedById[l.id] = l; });
  const seen = {};
  const custom = [];
  const seedOut = LABELS_SEED.map((l) => ({ ...l, roles: l.roles.slice() }));
  (Array.isArray(list) ? list : []).filter(isObj).forEach((l) => {
    if (!l.id || seen[l.id]) return;
    seen[l.id] = true;
    if (seedById[l.id]) {
      // Umbenennen/Umfärben der Standard-Labels übernehmen, Rollen kommen aus v3.
      const i = seedOut.findIndex((x) => x.id === l.id);
      seedOut[i] = { ...seedOut[i], name: l.name || seedOut[i].name, color: l.color || seedOut[i].color, icon: l.icon || seedOut[i].icon };
    } else {
      custom.push({ id: String(l.id), name: String(l.name || 'Label'), color: l.color || '#0f9b8e', icon: l.icon || 'tag', roles: ['owner', 'clinic'], seed: false });
    }
  });
  return seedOut.concat(custom);
}

function convertSettings(v2, v1) {
  let src = isObj(v2) ? v2 : null;
  if (!src && isObj(v1)) {
    // Wie v2 selbst: aus v1 alles übernehmen außer botMode/aiModel (die wurden damals zurückgesetzt).
    src = { ...v1 };
    delete src.botMode;
    delete src.aiModel;
  }
  if (!src) return null;
  const s = {};
  ['showLabels', 'enableOwner', 'enablePosteingang', 'enableNetwork', 'agentEnabled'].forEach((k) => {
    if (typeof src[k] === 'boolean') s[k] = src[k];
  });
  if (typeof src.botTyping === 'boolean') s.typing = src.botTyping;
  if (typeof src.botGreeting === 'boolean') s.greeting = src.botGreeting;
  // v2-'ai' hieß schon „KI, still Bot wenn keine da" → v3 'ai-fallback'. 'smart' war der reine Regel-Bot.
  if (src.botEnabled === false) s.botMode = 'off';
  else if (src.botMode === 'smart' || src.botMode === 'bot') s.botMode = 'bot';
  else s.botMode = 'ai-fallback';
  if (typeof src.aiModel === 'string' && src.aiModel) s.ai = { model: src.aiModel };
  if (typeof src.aiBaseUrl === 'string' && src.aiBaseUrl.trim()) s.aiLegacyUrl = src.aiBaseUrl.trim();
  return s;
}

function convertAuth(a) {
  if (!isObj(a) || (a.role !== 'owner' && a.role !== 'clinic')) return null;
  if (a.role === 'owner') return { role: 'owner', name: String(a.name || DEMO_OWNER.name), ownerId: DEMO_OWNER.ownerId };
  return { role: 'clinic', name: String(a.name || DEMO_PRACTICE.name), practiceId: DEMO_PRACTICE_ID };
}

/* Gibt es überhaupt alte Daten? */
export function hasV1Data(old) {
  const o = old || {};
  return ['chats', 'labels', 'settings', 'settingsV1', 'auth', 'hideTestData'].some((k) => o[k] != null && o[k] !== '');
}

/* Hauptfunktion. old = { chats, labels, settings (= vn_chat_settings_v2), settingsV1?, auth, hideTestData }
   (Rohwerte oder schon geparst). opts.practices = bekannte Praxen fürs Zuordnen der Titel. */
export function migrateV1(old, nowTs, opts) {
  const o = old || {};
  const now = typeof nowTs === 'number' && Number.isFinite(nowTs) ? nowTs : Date.now();
  const practices = opts && Array.isArray(opts.practices) ? opts.practices : null;
  const report = { chatsIn: 0, chatsMigrated: 0, seedChatsDropped: 0, messages: 0, images: 0, files: 0, errors: [] };

  const rawChats = parseMaybe(o.chats, report.errors, 'vn_chats_v1');
  const rawLabels = parseMaybe(o.labels, report.errors, 'vn_labels_v1');
  const rawSettings = parseMaybe(o.settings, report.errors, 'vn_chat_settings_v2');
  const rawSettingsV1 = parseMaybe(o.settingsV1, report.errors, 'vn_chat_settings_v1');
  const rawAuth = parseMaybe(o.auth, report.errors, 'vn_auth');

  const auth = convertAuth(rawAuth);
  const ownerName = auth && auth.role === 'owner' ? auth.name : DEMO_OWNER.name;

  const chats = [];
  if (Array.isArray(rawChats)) {
    report.chatsIn = rawChats.length;
    const seenIds = {};
    rawChats.filter(isObj).forEach((c, idx) => {
      if (V1_SEED_CHAT_IDS.indexOf(c.id) >= 0 && c.isTestData !== false) { report.seedChatsDropped++; return; }
      const chat = convertChat(c, idx, { now, practices, ownerName, report });
      if (seenIds[chat.id]) chat.id = uid('ch');
      seenIds[chat.id] = true;
      chats.push(chat);
    });
    report.chatsMigrated = chats.length;
  } else if (rawChats != null) {
    report.errors.push('vn_chats_v1: keine Liste — übersprungen.');
  }

  let hideTestData = null;
  if (o.hideTestData === '1' || o.hideTestData === true || o.hideTestData === 1) hideTestData = true;
  else if (o.hideTestData === '0' || o.hideTestData === false || o.hideTestData === 0) hideTestData = false;

  return {
    chats,
    labels: Array.isArray(rawLabels) ? convertLabels(rawLabels) : null,
    settings: convertSettings(rawSettings, rawSettingsV1),
    auth,
    hideTestData,
    report,
  };
}

/* Migrationsergebnis auf einen Seed legen (vom Store beim ersten Start benutzt).
   Übernommene Chats kommen VOR die Seed-Chats; gleiche IDs gewinnen die übernommenen. */
export function applyMigration(seed, migrated) {
  const s = seed || {};
  const m = migrated || {};
  const ids = new Set((m.chats || []).map((c) => c.id));
  const settings = { ...(s.settings || {}) };
  if (m.settings) {
    Object.keys(m.settings).forEach((k) => {
      if (k === 'ai') settings.ai = { ...(settings.ai || {}), ...m.settings.ai };
      else settings[k] = m.settings[k];
    });
  }
  if (typeof m.hideTestData === 'boolean') settings.hideTestData = m.hideTestData;
  return {
    ...s,
    chats: (m.chats || []).concat((s.chats || []).filter((c) => !ids.has(c.id))),
    labels: m.labels || s.labels || [],
    settings,
    auth: m.auth || null,
  };
}
