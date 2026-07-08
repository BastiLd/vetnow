/* VetNow — Admin-Zugang & lokale Einstellungen.
   ACHTUNG: Zugangsdaten nach dem Testen ändern! (nur clientseitig, kein echter Schutz) */

export const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'vetnow2026', // Nach dem Testen ändern!
};

const KEY_HIDE_TESTDATA = 'vn_hide_testdata';
const KEY_ADMIN_SESSION = 'vn_admin_session';

/* Der Schalter wirkt nur im Browser, in dem er gesetzt wurde (localStorage) —
   bewusste Entscheidung, um ohne Server/Drittanbieter-Konto auszukommen. */
export function getHideTestData() {
  try { return localStorage.getItem(KEY_HIDE_TESTDATA) === '1'; } catch { return false; }
}
export function setHideTestDataStored(on) {
  try { localStorage.setItem(KEY_HIDE_TESTDATA, on ? '1' : '0'); } catch { /* privater Modus o. Ä. */ }
}

export function getAdminLoggedIn() {
  try { return localStorage.getItem(KEY_ADMIN_SESSION) === '1'; } catch { return false; }
}
export function setAdminLoggedInStored(on) {
  try {
    if (on) localStorage.setItem(KEY_ADMIN_SESSION, '1');
    else localStorage.removeItem(KEY_ADMIN_SESSION);
  } catch { /* ignore */ }
}

export function checkAdminLogin(username, password) {
  return username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password;
}
