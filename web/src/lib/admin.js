/* VetNow — Admin-Zugang & lokale Einstellungen.
   ACHTUNG: Zugangsdaten nach dem Testen ändern! (nur clientseitig, kein echter Schutz) */

export const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'vetnow2026', // Nach dem Testen ändern!
};

const KEY_HIDE_TESTDATA = 'vn_hide_testdata';
const KEY_ADMIN_SESSION = 'vn_admin_session';
const KEY_AUTH = 'vn_auth';

export const AUTH_EMPTY = { role: null, name: '' };

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

/* Anmeldung der Nutzer:innen (Tierhalter:in / Praxis). Ebenfalls nur lokal —
   kein Konto, kein Server. Überlebt aber einen Reload. */
export function getAuth() {
  try {
    const raw = localStorage.getItem(KEY_AUTH);
    if (!raw) return { ...AUTH_EMPTY };
    const a = JSON.parse(raw);
    if (!a || !a.role) return { ...AUTH_EMPTY };
    return { role: a.role, name: a.name || '' };
  } catch { return { ...AUTH_EMPTY }; }
}
export function setAuthStored(auth) {
  try {
    if (auth && auth.role) localStorage.setItem(KEY_AUTH, JSON.stringify({ role: auth.role, name: auth.name || '' }));
    else localStorage.removeItem(KEY_AUTH);
  } catch { /* privater Modus o. Ä. */ }
}

export function checkAdminLogin(username, password) {
  return username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password;
}
