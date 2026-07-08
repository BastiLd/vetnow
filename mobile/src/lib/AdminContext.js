/* VetNow — App-weiter Zustand: Admin-Schalter, gefilterte Daten, Auth, Filter */
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

  const value = React.useMemo(
    () => ({ hideTestData, setHideTestData, adminLoggedIn, setAdminLoggedIn, ready, data, auth, setAuth, filters, setFilters }),
    [hideTestData, adminLoggedIn, ready, data, auth, filters]
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
