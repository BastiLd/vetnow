/* VetNow — App-weiter Zustand: Admin-Schalter, gefilterte Daten, Auth, Filter
   und Termin-Store. Chats laufen über den separaten ChatContext (nested). */
import React from 'react';
import { buildVNData } from '../data';
import { loadHideTestData, storeHideTestData, loadAdminLoggedIn, storeAdminLoggedIn } from './admin';

const AppStateContext = React.createContext(null);

export function AppStateProvider({ children }) {
  const [hideTestData, setHide] = React.useState(false);
  const [adminLoggedIn, setLogged] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [auth, setAuth] = React.useState({ role: null, name: '' });
  const [filters, setFilters] = React.useState({ animals: [], situations: [], districts: [], specialties: [], onlyConfirmed: false, onlyGreen: false, housecall: false, is24h: false });

  React.useEffect(() => {
    Promise.all([loadHideTestData(), loadAdminLoggedIn()]).then(([h, a]) => {
      setHide(h); setLogged(a); setReady(true);
    });
  }, []);

  const setHideTestData = (on) => { setHide(on); storeHideTestData(on); };
  const setAdminLoggedIn = (on) => { setLogged(on); storeAdminLoggedIn(on); };

  const data = React.useMemo(() => buildVNData(hideTestData), [hideTestData]);

  /* ---- Termin-Store (Praxis-Kalender) ---- */
  const [clinicAppts, setClinicAppts] = React.useState({});
  React.useEffect(() => {
    const m = {};
    Object.entries(data.APPTS_BY_DATE).forEach(([k, v]) => { m[k] = v.map((a) => ({ ...a })); });
    setClinicAppts(m);
  }, [data]);

  const setApptStatus = React.useCallback((iso, idx, status) => {
    setClinicAppts((m) => ({ ...m, [iso]: (m[iso] || []).map((a, i) => (i === idx ? { ...a, status } : a)) }));
  }, []);

  /* completeAppt: Status "done" + Abschlussnotiz. Rückgabe der convoId,
     damit der aufrufende Screen die Notiz zusätzlich in den Chat schreiben kann. */
  const completeAppt = React.useCallback((iso, idx, note) => {
    let convoId = null;
    setClinicAppts((m) => {
      const list = m[iso] || [];
      convoId = list[idx] && list[idx].convoId;
      return { ...m, [iso]: list.map((x, i) => (i === idx ? { ...x, status: 'done', note } : x)) };
    });
    return convoId;
  }, []);

  const value = React.useMemo(
    () => ({
      hideTestData, setHideTestData, adminLoggedIn, setAdminLoggedIn, ready, data, auth, setAuth, filters, setFilters,
      clinicAppts, setApptStatus, completeAppt,
    }),
    [hideTestData, adminLoggedIn, ready, data, auth, filters, clinicAppts, setApptStatus, completeAppt]
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
