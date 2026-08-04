/* VetNow — Admin-Zugang & lokale Einstellungen (AsyncStorage).
   ACHTUNG: Zugangsdaten nach dem Testen ändern! (nur clientseitig, kein echter Schutz) */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'vetnow2026', // Nach dem Testen ändern!
};

const KEY_HIDE_TESTDATA = 'vn_hide_testdata';
const KEY_ADMIN_SESSION = 'vn_admin_session';
const KEY_AUTH = 'vn_auth';

export const AUTH_EMPTY = { role: null, name: '' };

/* Der Schalter wirkt nur auf dem Gerät, auf dem er gesetzt wurde —
   bewusste Entscheidung, um ohne Server/Drittanbieter-Konto auszukommen. */
export async function loadHideTestData() {
  try { return (await AsyncStorage.getItem(KEY_HIDE_TESTDATA)) === '1'; } catch { return false; }
}
export async function storeHideTestData(on) {
  try { await AsyncStorage.setItem(KEY_HIDE_TESTDATA, on ? '1' : '0'); } catch { /* ignore */ }
}
export async function loadAdminLoggedIn() {
  try { return (await AsyncStorage.getItem(KEY_ADMIN_SESSION)) === '1'; } catch { return false; }
}
export async function storeAdminLoggedIn(on) {
  try {
    if (on) await AsyncStorage.setItem(KEY_ADMIN_SESSION, '1');
    else await AsyncStorage.removeItem(KEY_ADMIN_SESSION);
  } catch { /* ignore */ }
}
/* Anmeldung der Nutzer:innen (Tierhalter:in / Praxis). Ebenfalls nur lokal —
   kein Konto, kein Server. Überlebt aber das Schließen der App. */
export async function loadAuth() {
  try {
    const raw = await AsyncStorage.getItem(KEY_AUTH);
    if (!raw) return { ...AUTH_EMPTY };
    const a = JSON.parse(raw);
    if (!a || !a.role) return { ...AUTH_EMPTY };
    return { role: a.role, name: a.name || '' };
  } catch { return { ...AUTH_EMPTY }; }
}
export async function storeAuth(auth) {
  try {
    if (auth && auth.role) await AsyncStorage.setItem(KEY_AUTH, JSON.stringify({ role: auth.role, name: auth.name || '' }));
    else await AsyncStorage.removeItem(KEY_AUTH);
  } catch { /* ignore */ }
}

export function checkAdminLogin(username, password) {
  return username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password;
}
