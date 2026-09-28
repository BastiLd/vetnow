/* VetNow Hub — Admin-Anmeldung.

   - Passwort: VN_ADMIN_PASSWORD, Standard 'vetnow2026' (Vertrag §6).
   - Token: zufällig (32 Byte), nur im Arbeitsspeicher, 12 h gültig. Nach einem Neustart muss man
     sich neu anmelden — für ein Test-/Vorführ-Werkzeug ist das gewollt einfach.
   - Bequemlichkeit am PC: Anfragen von 127.0.0.1/::1 brauchen KEIN Token. Aber nur, wenn kein
     Proxy dazwischen sitzt (X-Forwarded-For/Forwarded): Hinter einem Reverse-Proxy kämen sonst
     ALLE Anfragen scheinbar von localhost. Abschaltbar mit VN_ADMIN_LOCAL_BYPASS=0.
   - Schutz gegen Durchprobieren: nach 10 Fehlversuchen einer Adresse 5 Minuten Sperre. */
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { HttpError, isLoopback, socketAddress } from './http.js';

export const DEFAULT_ADMIN_PASSWORD = 'vetnow2026';
export const TOKEN_TTL_MS = 12 * 3600e3;

const sha = (s) => createHash('sha256').update(String(s), 'utf8').digest();

export function createAdminAuth({
  password = DEFAULT_ADMIN_PASSWORD, ttlMs = TOKEN_TTL_MS, localBypass = true,
  remoteAddress = socketAddress, now = () => Date.now(),
} = {}) {
  const tokens = new Map(); // token → expiresAt
  const failures = new Map(); // Adresse → { count, until }
  const pwHash = sha(password);

  function sweep() {
    const t = now();
    for (const [k, exp] of tokens) if (exp <= t) tokens.delete(k);
    for (const [k, f] of failures) if (f.until && f.until <= t) failures.delete(k);
  }

  function isLocal(req) {
    if (!localBypass) return false;
    const h = req.headers || {};
    if (h['x-forwarded-for'] || h.forwarded || h['x-real-ip']) return false;
    return isLoopback(remoteAddress(req) || '');
  }

  function login(pw, req) {
    sweep();
    const addr = remoteAddress(req) || '?';
    const f = failures.get(addr);
    if (f && f.until && f.until > now()) {
      throw new HttpError(429, 'Zu viele Fehlversuche. Bitte in ein paar Minuten erneut versuchen.', 'too-many-attempts');
    }
    const ok = typeof pw === 'string' && pw.length > 0 && timingSafeEqual(sha(pw), pwHash);
    if (!ok) {
      const next = { count: (f ? f.count : 0) + 1, until: 0 };
      if (next.count >= 10) next.until = now() + 5 * 60e3;
      failures.set(addr, next);
      throw new HttpError(401, 'Falsches Admin-Passwort.', 'bad-password');
    }
    failures.delete(addr);
    const token = randomBytes(32).toString('hex');
    const expiresAt = now() + ttlMs;
    tokens.set(token, expiresAt);
    return { token, expiresAt };
  }

  function valid(token) {
    if (typeof token !== 'string' || token.length < 10) return false;
    const exp = tokens.get(token);
    if (!exp) return false;
    if (exp <= now()) { tokens.delete(token); return false; }
    return true;
  }

  /* Wirft 401, wenn weder localhost noch gültiges Token. → 'local' | 'token' */
  function check(req) {
    if (isLocal(req)) return 'local';
    const h = req.headers || {};
    const raw = h['x-vn-admin'] || (typeof h.authorization === 'string' && h.authorization.startsWith('Bearer ') ? h.authorization.slice(7) : '');
    if (valid(String(raw || '').trim())) return 'token';
    throw new HttpError(401, 'Admin-Anmeldung erforderlich (Header x-vn-admin mit Token von POST /api/v1/admin/login).', 'unauthorized');
  }

  return {
    login, check, isLocal, valid,
    logout(token) { tokens.delete(token); },
    get activeTokens() { sweep(); return tokens.size; },
  };
}
