/* VetNow — React-Context für Admin-Zustand + gefilterte Daten-Sicht */
import React from 'react';
import { buildVNData } from '../data.js';
import { getHideTestData, setHideTestDataStored, getAdminLoggedIn, setAdminLoggedInStored, getAuth, setAuthStored, AUTH_EMPTY } from './admin.js';
import { IS_CLEAN } from './config.js';
import { useHub, overlayPractices, hubNow } from './hubsync.js';

const AdminContext = React.createContext(null);

export function AdminProvider({ children }) {
  // Saubere Version: nie Testdaten anzeigen (Flag gewinnt über den lokalen Schalter).
  const [hideTestData, setHide] = React.useState(() => IS_CLEAN || getHideTestData());
  const [adminLoggedIn, setLogged] = React.useState(getAdminLoggedIn);
  /* auth liegt bewusst HIER und nicht in App.jsx: der ChatProvider ist in
     main.jsx ein Kind dieses Providers und ein Elternteil von App — er könnte
     einen State aus App.jsx gar nicht lesen, braucht die Rolle aber für den
     Chat-Filter. localStorage ist synchron, daher kein Ladezustand nötig. */
  const [auth, setAuthState] = React.useState(getAuth);

  const setHideTestData = (on) => { setHideTestDataStored(on); setHide(IS_CLEAN || on); };
  const setAdminLoggedIn = (on) => { setAdminLoggedInStored(on); setLogged(on); };
  const setAuth = (a) => { const next = a && a.role ? a : { ...AUTH_EMPTY }; setAuthState(next); setAuthStored(next); };

  /* v3: Läuft ein Hub, kommt der Praxis-Status LIVE von dort (von Extension, Handy, Dashboard gesetzt). */
  const hub = useHub();
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60000); return () => clearInterval(t); }, []);
  const data = React.useMemo(() => {
    const d = buildVNData(IS_CLEAN || hideTestData);
    if (hub.practices.length) d.PRACTICES = overlayPractices(d.PRACTICES, hub.practices, hubNow());
    d.HUB = { status: hub.status, devices: hub.devices };
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideTestData, hub.practices, hub.status, hub.devices, hub.clockOffsetMs, tick]);

  const value = React.useMemo(
    () => ({ hideTestData, setHideTestData, adminLoggedIn, setAdminLoggedIn, auth, setAuth, data, isClean: IS_CLEAN }),
    [hideTestData, adminLoggedIn, auth, data]
  );
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = React.useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin muss innerhalb von <AdminProvider> verwendet werden.');
  return ctx;
}

/* Gefilterte Daten in der Form des alten window.VN_DATA */
export function useVNData() {
  return useAdmin().data;
}
