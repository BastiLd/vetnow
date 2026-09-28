// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* VetNow — Versionen (Vertrag: docs/V3-ARCHITEKTUR.md §3).
   Jede App meldet APP_VERSION + Plattform an den Hub; das Admin-Center vergleicht
   damit, ob alle Geräte auf demselben Stand sind. PROTOCOL steigt nur, wenn sich die
   Hub-API inkompatibel ändert; DATA_SCHEMA nur, wenn sich das Speicherformat ändert
   (dann braucht es eine Migration, siehe migrate.js). */
export const APP_VERSION = '3.0.0';
export const PROTOCOL = 3;          // Hub-API-Protokoll
export const DATA_SCHEMA = 3;       // Store-/Speicher-Schema
