/* VetNow — Chat-Store (Mobile). Freie Chats mit Labels/Farben/Icons,
   vorgefertigt beim ersten Start, danach in AsyncStorage persistiert. */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHATS_SEED, CHAT_LABELS_SEED, CHAT_SETTINGS_DEFAULT } from '../data';
import { useAppState } from './AdminContext';
import { IS_CLEAN } from './config';

const K_CHATS = 'vn_chats_v1';
const K_LABELS = 'vn_labels_v1';
const K_SETTINGS = 'vn_chat_settings_v1';
const uid = (p) => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

const ChatContext = React.createContext(null);

export function ChatProvider({ children }) {
  const { hideTestData } = useAppState();
  const [settings, setSettings] = React.useState(() => (IS_CLEAN ? { ...CHAT_SETTINGS_DEFAULT, autoSeed: false } : CHAT_SETTINGS_DEFAULT));
  const [labels, setLabels] = React.useState(() => CHAT_LABELS_SEED.map((l) => ({ ...l })));
  const [chats, setChats] = React.useState(() => (IS_CLEAN ? [] : CHATS_SEED.map((c) => ({ ...c, messages: c.messages.map((m) => ({ ...m })) }))));
  const [ready, setReady] = React.useState(false);

  // Laden
  React.useEffect(() => {
    (async () => {
      try {
        const [s, l, c] = await Promise.all([
          AsyncStorage.getItem(K_SETTINGS), AsyncStorage.getItem(K_LABELS), AsyncStorage.getItem(K_CHATS),
        ]);
        const st = { ...CHAT_SETTINGS_DEFAULT, ...(s ? JSON.parse(s) : {}) };
        if (IS_CLEAN) st.autoSeed = false; // saubere Version: keine vorgefertigten Chats
        setSettings(st);
        if (l) setLabels(JSON.parse(l)); else setLabels(CHAT_LABELS_SEED.map((x) => ({ ...x })));
        if (c) setChats(JSON.parse(c)); else setChats(st.autoSeed ? CHATS_SEED.map((x) => ({ ...x, messages: x.messages.map((m) => ({ ...m })) })) : []);
      } catch { /* seed bleibt */ }
      setReady(true);
    })();
  }, []);

  // Speichern
  React.useEffect(() => { if (ready) AsyncStorage.setItem(K_SETTINGS, JSON.stringify(settings)).catch(() => {}); }, [settings, ready]);
  React.useEffect(() => { if (ready) AsyncStorage.setItem(K_LABELS, JSON.stringify(labels)).catch(() => {}); }, [labels, ready]);
  React.useEffect(() => { if (ready) AsyncStorage.setItem(K_CHATS, JSON.stringify(chats)).catch(() => {}); }, [chats, ready]);

  const createChat = (data) => {
    const id = uid('ch-');
    setChats((cs) => [{
      id, role: data.role || 'owner', title: data.title || 'Neuer Chat', sub: data.sub || '',
      animal: data.animal || 'other', color: data.color || '#0f9b8e', icon: data.icon || 'chat',
      labels: data.labels || [], pinned: false, unread: 0, isTestData: false, messages: data.messages || [],
    }, ...cs]);
    return id;
  };
  const updateChat = (id, patch) => setChats((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const deleteChat = (id) => setChats((cs) => cs.filter((c) => c.id !== id));
  const togglePin = (id) => setChats((cs) => cs.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)));
  const addMessage = (id, msg) => setChats((cs) => cs.map((c) => (c.id === id ? { ...c, messages: [...c.messages, msg], unread: 0 } : c)));
  const markRead = (id) => setChats((cs) => cs.map((c) => (c.id === id && c.unread ? { ...c, unread: 0 } : c)));

  const createLabel = (data) => {
    const id = uid('lb-');
    setLabels((ls) => [...ls, { id, name: data.name || 'Label', color: data.color || '#0f9b8e', icon: data.icon || 'star', seed: false }]);
    return id;
  };
  const updateLabel = (id, patch) => setLabels((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const deleteLabel = (id) => {
    setLabels((ls) => ls.filter((l) => l.id !== id));
    setChats((cs) => cs.map((c) => ({ ...c, labels: (c.labels || []).filter((x) => x !== id) })));
  };

  const setSetting = (key, val) => setSettings((s) => ({ ...s, [key]: val }));
  const resetSeed = () => {
    setLabels(CHAT_LABELS_SEED.map((l) => ({ ...l })));
    setChats(CHATS_SEED.map((c) => ({ ...c, messages: c.messages.map((m) => ({ ...m })) })));
  };
  const clearAll = () => setChats([]);

  const visibleChats = React.useMemo(() => chats.filter((c) => {
    if (hideTestData && c.isTestData) return false;
    if (c.role === 'owner' && !settings.enableOwner) return false;
    if (c.role === 'clinic' && !settings.enablePosteingang) return false;
    if (c.role === 'network' && !settings.enableNetwork) return false;
    return true;
  }), [chats, hideTestData, settings]);

  const totalUnread = React.useMemo(() => visibleChats.reduce((a, c) => a + (c.unread || 0), 0), [visibleChats]);
  const chatById = React.useCallback((id) => chats.find((c) => c.id === id), [chats]);

  const value = {
    chats, visibleChats, labels, settings, totalUnread, ready, chatById,
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
