/* VetNow — React-Context für Admin-Zustand + gefilterte Daten-Sicht */
import React from 'react';
import { buildVNData } from '../data.js';
import { getHideTestData, setHideTestDataStored, getAdminLoggedIn, setAdminLoggedInStored } from './admin.js';
import { IS_CLEAN } from './config.js';

const AdminContext = React.createContext(null);

export function AdminProvider({ children }) {
  // Saubere Version: nie Testdaten anzeigen (Flag gewinnt über den lokalen Schalter).
  const [hideTestData, setHide] = React.useState(() => IS_CLEAN || getHideTestData());
  const [adminLoggedIn, setLogged] = React.useState(getAdminLoggedIn);

  const setHideTestData = (on) => { setHideTestDataStored(on); setHide(IS_CLEAN || on); };
  const setAdminLoggedIn = (on) => { setAdminLoggedInStored(on); setLogged(on); };

  const data = React.useMemo(() => buildVNData(IS_CLEAN || hideTestData), [hideTestData]);

  const value = React.useMemo(
    () => ({ hideTestData, setHideTestData, adminLoggedIn, setAdminLoggedIn, data, isClean: IS_CLEAN }),
    [hideTestData, adminLoggedIn, data]
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
