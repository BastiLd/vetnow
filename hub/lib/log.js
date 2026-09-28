/* VetNow Hub — Ringpuffer für das Admin-Protokoll (Anfragen + Ereignisse + Warnungen).
   Nur die letzten 1000 Einträge, nur im Speicher: Das ist ein Werkzeug zum Zuschauen beim Testen,
   kein Audit-Log. Der eigentliche Logger (Konsole/Studio) bekommt Warnungen zusätzlich. */

export function createLogBuffer({ max = 1000, logger = console } = {}) {
  const entries = [];
  let seq = 0;

  function push(entry) {
    seq += 1;
    const e = { seq, ts: Date.now(), ...entry };
    entries.push(e);
    if (entries.length > max) entries.splice(0, entries.length - max);
    return e;
  }

  return {
    request({ method, path, status, ms, client }) {
      return push({ kind: 'req', method, path, status, ms, client: client || '' });
    },
    event(ev) {
      return push({ kind: 'event', type: ev.type, rev: ev.rev, chatId: ev.chatId || (ev.chat && ev.chat.id) || undefined });
    },
    info(msg, extra) { return push({ kind: 'info', msg, ...(extra || {}) }); },
    warn(msg, extra) {
      logger.warn('[hub] ' + msg);
      return push({ kind: 'warn', msg, ...(extra || {}) });
    },
    error(msg, extra) {
      logger.error('[hub] ' + msg);
      return push({ kind: 'error', msg, ...(extra || {}) });
    },
    since(n = 0, limit = 500) {
      const list = entries.filter((e) => e.seq > n);
      return list.slice(-limit);
    },
    last(n = 50) { return entries.slice(-n); },
    get seq() { return seq; },
    get size() { return entries.length; },
  };
}
