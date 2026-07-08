/* VetNow — Chat-Store (Web). Freie Chats mit Labels/Farben/Icons,
   vorgefertigt beim ersten Start (autoSeed), danach in localStorage persistiert.
   Alles editierbar: erstellen, umbenennen, Farbe/Icon/Labels ändern, anpinnen, löschen. */
import React from 'react';
import { CHATS_SEED, CHAT_LABELS_SEED, CHAT_SETTINGS_DEFAULT } from '../data.js';
import { useAdmin } from './adminContext.jsx';

const K_CHATS = 'vn_chats_v1';
const K_LABELS = 'vn_labels_v1';
const K_SETTINGS = 'vn_chat_settings_v1';

const load = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } };
const uid = (p) => p + Math.random().toString(36).slice(2, 9) + (Date.now ? Date.now().toString(36) : '');

const ChatContext = React.createContext(null);

function initSettings() { return { ...CHAT_SETTINGS_DEFAULT, ...load(K_SETTINGS, {}) }; }
function initLabels(settings) {
  const stored = load(K_LABELS, null);
  if (stored) return stored;
  return settings.autoSeed ? CHAT_LABELS_SEED.map((l) => ({ ...l })) : [];
}
function initChats(settings) {
  const stored = load(K_CHATS, null);
  if (stored) return stored;
  return settings.autoSeed ? CHATS_SEED.map((c) => ({ ...c, messages: c.messages.map((m) => ({ ...m })) })) : [];
}

export function ChatProvider({ children }) {
  const { hideTestData } = useAdmin();
  const [settings, setSettings] = React.useState(initSettings);
  const [labels, setLabels] = React.useState(() => initLabels(initSettings()));
  const [chats, setChats] = React.useState(() => initChats(initSettings()));

  React.useEffect(() => { save(K_SETTINGS, settings); }, [settings]);
  React.useEffect(() => { save(K_LABELS, labels); }, [labels]);
  React.useEffect(() => { save(K_CHATS, chats); }, [chats]);

  // ---- Chat-Operationen ----
  const createChat = (data) => {
    const id = uid('ch-');
    const chat = {
      id, role: data.role || 'owner', title: data.title || 'Neuer Chat', sub: data.sub || '',
      animal: data.animal || 'other', color: data.color || '#0f9b8e', icon: data.icon || 'chat',
      labels: data.labels || [], pinned: false, unread: 0, isTestData: false, messages: data.messages || [],
    };
    setChats((cs) => [chat, ...cs]);
    return id;
  };
  const updateChat = (id, patch) => setChats((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const deleteChat = (id) => setChats((cs) => cs.filter((c) => c.id !== id));
  const togglePin = (id) => setChats((cs) => cs.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)));
  const addMessage = (id, msg) => setChats((cs) => cs.map((c) => (c.id === id ? { ...c, messages: [...c.messages, msg], unread: 0 } : c)));
  const markRead = (id) => setChats((cs) => cs.map((c) => (c.id === id && c.unread ? { ...c, unread: 0 } : c)));

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

  // ---- Sichtbare Chats (Admin-Testdaten-Filter + abgeschaltete Bereiche) ----
  const visibleChats = React.useMemo(() => {
    return chats.filter((c) => {
      if (hideTestData && c.isTestData) return false;
      if (c.role === 'owner' && !settings.enableOwner) return false;
      if (c.role === 'clinic' && !settings.enablePosteingang) return false;
      if (c.role === 'network' && !settings.enableNetwork) return false;
      return true;
    });
  }, [chats, hideTestData, settings]);

  const totalUnread = React.useMemo(() => visibleChats.reduce((a, c) => a + (c.unread || 0), 0), [visibleChats]);

  const value = {
    chats, visibleChats, labels, settings, totalUnread,
    createChat, updateChat, deleteChat, togglePin, addMessage, markRead,
    createLabel, updateLabel, deleteLabel, setSetting, resetSeed, clearAll,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChats() {
  const ctx = React.useContext(ChatContext);
  if (!ctx) throw new Error('useChats muss innerhalb von <ChatProvider> verwendet werden.');
  return ctx;
}
