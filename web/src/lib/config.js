/* VetNow — Build-Konfiguration (nur Web).
   VITE_VN_CLEAN=true  -> "saubere" Version ohne Testdaten (für GitHub Pages / Weitergabe).
   Ohne Flag           -> Demo-Version mit Testdaten (lokal / Studio-Demo). */
const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

export const IS_CLEAN = env.VITE_VN_CLEAN === 'true' || env.VITE_VN_CLEAN === '1';

/* Supabase-Seam (später nachrüstbar): sobald diese beiden Variablen gesetzt sind,
   kann ein echtes Backend angebunden werden (siehe lib/backend.js). */
export const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';
export const HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export const APP_MODE = IS_CLEAN ? 'clean' : 'demo';
