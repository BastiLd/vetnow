/* VetNow Hub — Fehler-Injektion für Tests („Was passiert, wenn …?").

   offline    → alle Nicht-Admin-Anfragen unter /api/v1 antworten 503 {code:'offline'}
   slow       → +2 s Verzögerung vor jeder Nicht-Admin-Anfrage
   ai-offline → alle KI-Anbieter melden „offline" (Clients fallen still auf den Bot zurück)
   error500   → 50 % der Nicht-Admin-Anfragen antworten 500

   Jede Störung hat ein Ablaufdatum, damit ein vergessener Test den Hub nicht dauerhaft lahmlegt. */
export const FAULT_KINDS = ['offline', 'slow', 'ai-offline', 'error500'];
export const FAULT_MAX_MS = 60 * 60 * 1000;

export function createFaults({ now = () => Date.now(), random = Math.random, slowMs = 2000 } = {}) {
  const until = new Map();
  const listeners = new Set();

  const active = (kind) => {
    const t = until.get(kind);
    if (!t) return false;
    if (now() > t) { until.delete(kind); return false; }
    return true;
  };

  return {
    slowMs,
    set(kind, durationMs) {
      const ms = Math.min(FAULT_MAX_MS, Math.max(100, Number(durationMs) || 60000));
      until.set(kind, now() + ms);
      for (const fn of listeners) fn(kind, true);
      return until.get(kind);
    },
    clear(kind) {
      if (kind) until.delete(kind); else until.clear();
      for (const fn of listeners) fn(kind || 'all', false);
    },
    active,
    /* 50-%-Würfel für error500 — `random` ist für Tests austauschbar. */
    roll500: () => active('error500') && random() < 0.5,
    list() {
      return FAULT_KINDS.filter(active).map((kind) => ({ kind, until: until.get(kind), remainingMs: until.get(kind) - now() }));
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
