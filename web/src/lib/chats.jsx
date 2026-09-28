/* VetNow — Chat-Store (Web). Freie Chats mit Labels/Farben/Icons,
   vorgefertigt beim ersten Start (autoSeed), danach in localStorage persistiert.
   Alles editierbar: erstellen, umbenennen, Farbe/Icon/Labels ändern, anpinnen, löschen. */
import React from 'react';
import { CHATS_SEED, CHAT_LABELS_SEED, CHAT_SETTINGS_DEFAULT } from '../data.js';
import { toast } from '../components.jsx';
import { useAdmin } from './adminContext.jsx';
import { IS_CLEAN } from './config.js';
import { useHub, hubChat, hubUploadDataUrl, hubFileUrl } from './hubsync.js';
import { legacyChatsFromHub, hubSideFor } from '../../../shared/legacyview.js';

const K_CHATS = 'vn_chats_v1';
const K_LABELS = 'vn_labels_v1';
const K_SETTINGS = 'vn_chat_settings_v2'; // v2: KI (Ollama) ist Standard-Bot

const load = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } };
const uid = (p) => p + Math.random().toString(36).slice(2, 9) + (Date.now ? Date.now().toString(36) : '');

const ChatContext = React.createContext(null);

function initSettings() {
  // Migration v1 → v2: alte Einstellungen übernehmen, aber botMode/aiModel auf
  // den neuen KI-Standard zurücksetzen (KI antwortet jetzt überall standardmäßig).
  let stored = load(K_SETTINGS, null);
  if (!stored) {
    const old = load('vn_chat_settings_v1', null);
    if (old) { delete old.botMode; delete old.aiModel; stored = old; }
  }
  const s = { ...CHAT_SETTINGS_DEFAULT, ...(stored || {}) };
  if (IS_CLEAN) s.autoSeed = false; // saubere Version: keine vorgefertigten Chats
  return s;
}
function initLabels(settings) {
  const stored = load(K_LABELS, null);
  if (stored) return stored;
  if (IS_CLEAN) return CHAT_LABELS_SEED.map((l) => ({ ...l })); // Labels ja, aber keine Chats
  return settings.autoSeed ? CHAT_LABELS_SEED.map((l) => ({ ...l })) : [];
}
function initChats(settings) {
  const stored = load(K_CHATS, null);
  if (stored) return stored;
  if (IS_CLEAN) return []; // keine Testdaten-Chats in der sauberen Version
  return settings.autoSeed ? CHATS_SEED.map((c) => ({ ...c, messages: c.messages.map((m) => ({ ...m })) })) : [];
}

export function ChatProvider({ children }) {
  const { hideTestData, auth } = useAdmin();
  const [settings, setSettings] = React.useState(initSettings);
  const [labels, setLabels] = React.useState(() => initLabels(initSettings()));
  const [chats, setChats] = React.useState(() => initChats(initSettings()));

  React.useEffect(() => { save(K_SETTINGS, settings); }, [settings]);
  React.useEffect(() => { save(K_LABELS, labels); }, [labels]);
  /* Schlägt das Speichern fehl (localStorage voll — meist wegen zu großer
     Anhänge), muss das SICHTBAR sein: sonst sind die Chats nach dem nächsten
     Reload einfach weg, ohne dass jemand etwas gemerkt hat. */
  React.useEffect(() => {
    if (!save(K_CHATS, chats)) toast('Speicher voll — die letzte Änderung konnte nicht gesichert werden. Bitte große Anhänge löschen.', 'error');
  }, [chats]);

  /* ---- v3: Hub-Modus ----
     Ist der VetNow Hub online, zeigen wir dessen Chats (dieselben wie auf Handy und in der Extension)
     und schicken jede Aktion an den Hub. Antworten von Bot/KI kommen dann nur noch vom Hub —
     sonst würden mehrere offene Geräte gleichzeitig antworten. Ohne Hub: alles lokal wie bisher. */
  const hub = useHub();
  const hubMode = hub.status === 'online' && !IS_CLEAN;
  const hubAuth = !auth || !auth.role ? null
    : auth.role === 'owner' ? { role: 'owner', ownerId: 'owner-demo', name: auth.name } : { role: 'clinic', practiceId: 'drautal', name: auth.name };
  const hubChats = React.useMemo(() => {
    if (!hubMode || !hubAuth) return [];
    return legacyChatsFromHub(hub.chats, hubAuth, hub.practices, { fileUrl: hubFileUrl })
      .map((c) => ({ ...c, typing: hub.typing[c.id] ? hubSideFor(c, hub.typing[c.id]) : null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubMode, hub.chats, hub.practices, hub.typing, auth && auth.role, auth && auth.name]);
  const findHub = (id) => hubChats.find((c) => c.id === id);
  const rawHub = (id) => hub.chats.find((c) => c.id === id) || {};
  const hubErr = (e) => toast('Hub: ' + (e && e.message ? e.message : 'Fehler'), 'error');
  const msgAt = (id, idx) => { const c = findHub(id); return c && c.messages[idx]; };

  // ---- Chat-Operationen ----
  const createChat = (data) => {
    if (hubMode) {
      const id = uid('ch-');
      const network = data.role === 'network';
      const mySideNow = auth && auth.role === 'owner' ? 'owner' : 'clinic';
      hubChat('POST', '/chats', {
        id, kind: network ? 'network' : 'direct', practiceId: data.practiceId || 'drautal',
        ...(network ? { peerPracticeId: data.peerPracticeId || 'woerthersee' } : { ownerId: 'owner-demo', ownerName: mySideNow === 'owner' ? (auth.name || 'Tierhalter:in') : (data.title || 'Tierhalter:in') }),
        ...(data.title ? { titles: { [mySideNow]: data.title } } : {}),
        animal: data.animal || 'other', color: data.color || '#0f9b8e', icon: data.icon || 'chat', labels: data.labels || [], autoReply: true,
        messages: (data.messages || []).map((m) => ({ from: m.from || 'owner', type: m.type || 'text', text: m.text || '' })),
      }).catch(hubErr);
      return id;
    }
    const id = uid('ch-');
    const chat = {
      id, role: data.role || 'owner', title: data.title || 'Neuer Chat', sub: data.sub || '',
      animal: data.animal || 'other', color: data.color || '#0f9b8e', icon: data.icon || 'chat',
      labels: data.labels || [], pinned: false, unread: 0, isTestData: false, messages: data.messages || [],
    };
    setChats((cs) => [chat, ...cs]);
    return id;
  };
  const updateChat = (id, patch) => {
    if (hubMode) {
      const c = findHub(id); if (!c) return;
      const p = {};
      for (const k of ['color', 'icon', 'labels', 'animal']) if (k in patch) p[k] = patch[k];
      if ('title' in patch) p.titles = { ...(rawHub(id).titles || {}), [c.side]: patch.title };
      if ('sub' in patch) p.subs = { ...(rawHub(id).subs || {}), [c.side]: patch.sub };
      if ('pinned' in patch) p.pinned = { [c.side]: !!patch.pinned };
      hubChat('PATCH', '/chats/' + id, p).catch(hubErr);
      return;
    }
    updateChatLocal(id, patch);
  };
  const updateChatLocal = (id, patch) => setChats((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const deleteChat = (id) => { if (hubMode) { hubChat('DELETE', '/chats/' + id).catch(hubErr); return; } deleteChatLocal(id); };
  const deleteChatLocal = (id) => setChats((cs) => cs.filter((c) => c.id !== id));
  const togglePin = (id) => { if (hubMode) { const c = findHub(id); if (c) hubChat('PATCH', '/chats/' + id, { pinned: { [c.side]: !c.pinned } }).catch(hubErr); return; } togglePinLocal(id); };
  const togglePinLocal = (id) => setChats((cs) => cs.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)));
  const addMessage = (id, msg) => {
    if (hubMode) {
      const c = findHub(id);
      const from = msg.type === 'note' ? (msg.from || 'clinic') : hubSideFor(c, msg.from || (c && c.role === 'owner' ? 'owner' : 'clinic'));
      const body = { from, type: msg.type || 'text', text: msg.text || '', clientMsgId: uid('cm-') };
      const go = (attachment) => hubChat('POST', '/chats/' + id + '/messages', attachment ? { ...body, attachment } : body).catch(hubErr);
      if (msg.src && String(msg.src).startsWith('data:')) {
        hubUploadDataUrl(msg.src, msg.fileName || (msg.type === 'image' ? 'bild.jpg' : 'datei'))
          .then((a) => go(msg.type === 'image' ? a : { ...a, kind: 'file', name: msg.fileName || a.name, mime: msg.fileMime || a.mime }))
          .catch(hubErr);
      } else go();
      return;
    }
    addMessageLocal(id, msg);
  };
  const addMessageLocal = (id, msg) => setChats((cs) => cs.map((c) => (c.id === id ? { ...c, messages: [...c.messages, { id: uid('m-'), ...msg }], unread: 0 } : c)));
  const markRead = (id) => { if (hubMode) { const c = findHub(id); if (c && c.unread) hubChat('POST', '/chats/' + id + '/read', { side: c.side }).catch(() => {}); return; } markReadLocal(id); };
  const markReadLocal = (id) => setChats((cs) => cs.map((c) => (c.id === id && c.unread ? { ...c, unread: 0 } : c)));

  /* ---- Einzelne Nachrichten bearbeiten / löschen / reagieren ----
     Adressiert über den Array-Index: Nachrichten werden ausschließlich hinten
     angehängt und nie entfernt (Löschen ist „weich"), ein Index bleibt also
     dauerhaft gültig. Alle Felder sind optional — alte Demo-Nachrichten aus
     CHATS_SEED laufen unverändert weiter, keine Migration nötig. */
  const patchMessage = (id, idx, fn) => setChats((cs) => cs.map((c) => (
    c.id === id ? { ...c, messages: c.messages.map((m, i) => (i === idx ? fn(m) : m)) } : c
  )));
  const editMessage = (id, idx, text) => { if (hubMode) { const m = msgAt(id, idx); if (m) hubChat('PATCH', '/chats/' + id + '/messages/' + m.id, { text }).catch(hubErr); return; } editMessageLocal(id, idx, text); };
  const editMessageLocal = (id, idx, text) => patchMessage(id, idx, (m) => ({ ...m, text, editedAt: Date.now() }));
  /* Beim Löschen Inhalt WIRKLICH leeren — sonst bleibt ein gelöschtes Bild
     als Datenmüll im localStorage liegen. */
  const deleteMessage = (id, idx) => { if (hubMode) { const m = msgAt(id, idx); if (m) hubChat('PATCH', '/chats/' + id + '/messages/' + m.id, { deleted: true }).catch(hubErr); return; } deleteMessageLocal(id, idx); };
  const deleteMessageLocal = (id, idx) => patchMessage(id, idx, (m) => {
    const next = { ...m, deleted: true, deletedAt: Date.now(), text: '' };
    delete next.src; delete next.srcB64; delete next.fileName; delete next.fileMime; delete next.reactions;
    return next;
  });
  const toggleReaction = (id, idx, side, emoji) => {
    if (hubMode) {
      const c = findHub(id); const m = msgAt(id, idx); if (!c || !m) return;
      const current = m.reactions && m.reactions[side];
      hubChat('PATCH', '/chats/' + id + '/messages/' + m.id, { reaction: { side: hubSideFor(c, side), emoji: current === emoji ? null : emoji } }).catch(hubErr);
      return;
    }
    toggleReactionLocal(id, idx, side, emoji);
  };
  const toggleReactionLocal = (id, idx, side, emoji) => patchMessage(id, idx, (m) => {
    const r = { ...(m.reactions || {}) };
    if (r[side] === emoji) delete r[side]; else r[side] = emoji;
    return { ...m, reactions: r };
  });

  // ---- Label-Operationen ----
  const createLabel = (data) => {
    const id = uid('lb-');
    setLabels((ls) => [...ls, { id, name: data.name || 'Label', color: data.color || '#0f9b8e', icon: data.icon || 'tag', seed: false }]);
    return id;
  };
  const updateLabel = (id, patch) => setLabels((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const deleteLabel = (id) => {
    setLabels((ls) => ls.filter((l) => l.id !== id));
    setChats((cs) => cs.map((c) => ({ ...c, labels: (c.labels || []).filter((x) => x !== id) })));
  };

  const setSetting = (key, val) => setSettings((s) => ({ ...s, [key]: val }));
  const resetSeed = () => {
    const seededLabels = CHAT_LABELS_SEED.map((l) => ({ ...l }));
    const seededChats = CHATS_SEED.map((c) => ({ ...c, messages: c.messages.map((m) => ({ ...m })) }));
    setLabels(seededLabels);
    setChats(seededChats);
  };
  const clearAll = () => { setChats([]); };

  /* ---- Sichtbare Chats: Testdaten-Schalter, abgeschaltete Bereiche UND die
     angemeldete Rolle. `role` am Chat ist eine Rubrik, keine Besitzangabe:
     Tierhalter:innen sehen nur „Meine Tiere", Praxen Posteingang + Netzwerk.
     Abgemeldet ist nichts sichtbar. ---- */
  const visibleChats = React.useMemo(() => {
    return (hubMode ? hubChats : chats).filter((c) => {
      if (hideTestData && c.isTestData) return false;
      if (c.role === 'owner' && !settings.enableOwner) return false;
      if (c.role === 'clinic' && !settings.enablePosteingang) return false;
      if (c.role === 'network' && !settings.enableNetwork) return false;
      if (!auth || !auth.role) return false;
      if (auth.role === 'owner') return c.role === 'owner';
      return c.role === 'clinic' || c.role === 'network';
    });
  }, [chats, hubChats, hubMode, hideTestData, settings, auth]);

  const totalUnread = React.useMemo(() => visibleChats.reduce((a, c) => a + (c.unread || 0), 0), [visibleChats]);

  const value = {
    chats: hubMode ? hubChats : chats, visibleChats, labels, settings, totalUnread, hubMode,
    createChat, updateChat, deleteChat, togglePin, addMessage, markRead,
    editMessage, deleteMessage, toggleReaction,
    createLabel, updateLabel, deleteLabel, setSetting, resetSeed, clearAll,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChats() {
  const ctx = React.useContext(ChatContext);
  if (!ctx) throw new Error('useChats muss innerhalb von <ChatProvider> verwendet werden.');
  return ctx;
}
