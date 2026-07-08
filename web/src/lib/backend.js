/* VetNow — Backend-Seam (Vorbereitung für Supabase, noch NICHT aktiv).

   Aktueller Stand: die App läuft komplett ohne Server. Daten liegen lokal
   (localStorage). Das reicht zum Testen und Weitergeben der UI.

   Später mit Supabase (echtes, geteiltes Backend) nachrüsten:
   1. Kostenloses Supabase-Projekt anlegen (supabase.com, eigenes Konto/E-Mail).
   2. Beim Build/Studio zwei Variablen setzen:
        VITE_SUPABASE_URL=...        (Project URL)
        VITE_SUPABASE_ANON_KEY=...   (anon public key)
   3. `npm i @supabase/supabase-js` und unten `getClient()` aktivieren.
   4. Die lokalen Stores (Praxen, Chats) auf diese Funktionen umstellen.

   Solange HAS_SUPABASE=false ist, bleibt alles lokal — kein Konto nötig. */
import { HAS_SUPABASE, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let _client = null;

export function isBackendEnabled() {
  return HAS_SUPABASE;
}

export async function getClient() {
  if (!HAS_SUPABASE) return null;
  if (_client) return _client;
  // Nachrüsten: import { createClient } from '@supabase/supabase-js';
  //            _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // (Absichtlich noch nicht eingebunden, um ohne Konto auszukommen.)
  return null;
}

/* Platzhalter-API, an der später die echte Datenquelle andockt. */
export const backend = {
  enabled: () => HAS_SUPABASE,
  info: () => (HAS_SUPABASE ? { url: SUPABASE_URL } : null),
};
