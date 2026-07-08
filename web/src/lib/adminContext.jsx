/* VetNow — React-Context für Admin-Zustand + gefilterte Daten-Sicht */
import React from 'react';
import { buildVNData } from '../data.js';
import { getHideTestData, setHideTestDataStored, getAdminLoggedIn, setAdminLoggedInStored } from './admin.js';

const AdminContext = React.createContext(null);

export function AdminProvider({ children }) {
  const [hideTestData, setHide] = React.useState(getHideTestData);
  const [adminLoggedIn, setLogged] = React.useState(getAdminLoggedIn);

  const setHideTestData = (on) => { setHideTestDataStored(on); setHide(on); };
  const setAdminLoggedIn = (on) => { setAdminLoggedInStored(on); setLogged(on); };

  const data = React.useMemo(() => buildVNData(hideTestData), [hideTestData]);

  const value = React.useMemo(
    () => ({ hideTestData, setHideTestData, adminLoggedIn, setAdminLoggedIn, data }),
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
