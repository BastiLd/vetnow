/* VetNow — App-weiter Zustand: Admin-Schalter, gefilterte Daten, Auth, Filter,
   Chat-Verläufe (Tierhalter + Praxis), Ungelesen-Zähler und Termin-Store. */
import React from 'react';
import { buildVNData } from '../data';
import { loadHideTestData, storeHideTestData, loadAdminLoggedIn, storeAdminLoggedIn } from './admin';

const AppStateContext = React.createContext(null);

export function AppStateProvider({ children }) {
  const [hideTestData, setHide] = React.useState(false);
  const [adminLoggedIn, setLogged] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [auth, setAuth] = React.useState({ role: null, name: '' });
  const [filters, setFilters] = React.useState({ animal: null, situation: null, district: null, specialties: [], onlyConfirmed: false });

  React.useEffect(() => {
    Promise.all([loadHideTestData(), loadAdminLoggedIn()]).then(([h, a]) => {
      setHide(h); setLogged(a); setReady(true);
    });
  }, []);

  const setHideTestData = (on) => { setHide(on); storeHideTestData(on); };
  const setAdminLoggedIn = (on) => { setLogged(on); storeAdminLoggedIn(on); };

  const data = React.useMemo(() => buildVNData(hideTestData), [hideTestData]);

  /* ---- Chat-Verläufe & Ungelesen-Zähler (Session-Zustand) ---- */
  const [ownerChats, setOwnerChats] = React.useState({});
  const [clinicChats, setClinicChats] = React.useState({});
  const [ownerUnread, setOwnerUnread] = React.useState({});
  const [clinicUnread, setClinicUnread] = React.useState({});
  const [clinicAppts, setClinicAppts] = React.useState({});

  React.useEffect(() => {
    setOwnerChats(Object.fromEntries(data.OWNER_CONVERSATIONS.map((c) => [c.id, c.messages.map((m) => ({ ...m }))])));
    setClinicChats(Object.fromEntries(data.CONVERSATIONS.map((c) => [c.id, c.messages.map((m) => ({ ...m }))])));
    setOwnerUnread(Object.fromEntries(data.OWNER_CONVERSATIONS.map((c) => [c.id, c.unread])));
    setClinicUnread(Object.fromEntries(data.CONVERSATIONS.map((c) => [c.id, c.unread])));
    const m = {};
    Object.entries(data.APPTS_BY_DATE).forEach(([k, v]) => { m[k] = v.map((a) => ({ ...a })); });
    setClinicAppts(m);
  }, [data]);

  const sendChat = React.useCallback((kind, convoId, msg) => {
    const set = kind === 'owner' ? setOwnerChats : setClinicChats;
    set((s) => ({ ...s, [convoId]: [...(s[convoId] || []), msg] }));
  }, []);

  const markRead = React.useCallback((kind, convoId) => {
    const set = kind === 'owner' ? setOwnerUnread : setClinicUnread;
    set((u) => (u[convoId] ? { ...u, [convoId]: 0 } : u));
  }, []);

  const setApptStatus = React.useCallback((iso, idx, status) => {
    setClinicAppts((m) => ({ ...m, [iso]: (m[iso] || []).map((a, i) => (i === idx ? { ...a, status } : a)) }));
  }, []);

  /* Termin abschließen: Status "done" + Abschlussnotiz, Notiz landet im Praxis-Chat */
  const completeAppt = React.useCallback((iso, idx, note) => {
    setClinicAppts((m) => ({ ...m, [iso]: (m[iso] || []).map((x, i) => (i === idx ? { ...x, status: 'done', note } : x)) }));
    const a = (clinicAppts[iso] || [])[idx];
    if (a && a.convoId) sendChat('clinic', a.convoId, { type: 'note', text: note, time: 'jetzt' });
  }, [clinicAppts, sendChat]);

  const value = React.useMemo(
    () => ({
      hideTestData, setHideTestData, adminLoggedIn, setAdminLoggedIn, ready, data, auth, setAuth, filters, setFilters,
      ownerChats, clinicChats, ownerUnread, clinicUnread, sendChat, markRead,
      clinicAppts, setApptStatus, completeAppt,
    }),
    [hideTestData, adminLoggedIn, ready, data, auth, filters, ownerChats, clinicChats, ownerUnread, clinicUnread, sendChat, markRead, clinicAppts, setApptStatus, completeAppt]
  );
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState muss innerhalb von <AppStateProvider> verwendet werden.');
  return ctx;
}

export function useVNData() {
  return useAppState().data;
}
