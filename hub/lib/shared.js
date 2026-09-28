/* VetNow Hub — EINZIGE Stelle, an der der Hub Code aus `shared/` importiert.

   Warum eine eigene Datei?
   `shared/` wird parallel zum Hub gebaut (Vertrag: docs/V3-ARCHITEKTUR.md §5). Wenn sich dort ein
   Modulname oder Pfad ändert, muss nur diese Datei angepasst werden — alle anderen Hub-Dateien
   importieren ausschließlich von hier.

   Warum dynamisch statt `import { … } from '../../shared/index.js'`?
   Ein statischer Import scheitert komplett, sobald EIN Untermodul fehlt oder einen Tippfehler hat —
   dann startet der ganze Hub nicht. Hier wird pro vertraglichem Namen geprüft:
     1. `shared/index.js` (der offizielle Einstieg),
     2. sonst das im Vertrag genannte Einzelmodul (z. B. `shared/seed.js`),
     3. sonst der klar markierte NOTBEHELF aus `./shared-fallback.js`.
   Jeder Notbehelf wird in `SHARED_FALLBACKS` aufgelistet, laut geloggt und vom Selbsttest
   (`GET /api/v1/admin/selftest`, Check „shared-module") ROT gemeldet — er kann also nicht
   unbemerkt im Betrieb bleiben. */
import * as fallback from './shared-fallback.js';

// Vertraglicher Name → Modul laut §5 (relativ zu shared/).
const CONTRACT = {
  APP_VERSION: 'version.js',
  PROTOCOL: 'version.js',
  DATA_SCHEMA: 'version.js',
  SETTINGS_DEFAULT: 'constants.js',
  LABELS_SEED: 'constants.js',
  SITUATIONS: 'constants.js',
  ANIMAL_LABEL: 'constants.js',
  DEMO_OWNER: 'constants.js',
  DEMO_PRACTICE_ID: 'constants.js',
  uid: 'ids.js',
  buildDemoSeed: 'seed.js',
  buildEmptySeed: 'seed.js',
  effectiveStatus: 'status.js',
  withLiveStatus: 'status.js',
  newMessage: 'chats.js',
  migrateV1: 'migrate.js',
  shouldAutoReply: 'autoreply.js',
  personaFor: 'autoreply.js',
  generateAutoReply: 'autoreply.js',
  vetSystemPrompt: 'ai.js',
  toAiMessages: 'ai.js',
  botReply: 'bot/index.js',
  botImageReply: 'bot/index.js',
  runBotSuite: 'bot/index.js',
  BOT_SUITE: 'bot/index.js',
};

const SHARED_BASE = new URL('../../shared/', import.meta.url);

async function tryImport(rel) {
  try {
    return { mod: await import(new URL(rel, SHARED_BASE).href), error: null };
  } catch (e) {
    return { mod: null, error: e };
  }
}

const resolved = {};
const fallbacks = [];
const loadErrors = {};

const index = await tryImport('index.js');
if (index.error) loadErrors['index.js'] = String(index.error && index.error.message || index.error);

const moduleCache = new Map();
for (const [name, file] of Object.entries(CONTRACT)) {
  if (index.mod && index.mod[name] !== undefined) { resolved[name] = index.mod[name]; continue; }
  if (!moduleCache.has(file)) moduleCache.set(file, await tryImport(file));
  const single = moduleCache.get(file);
  if (single.mod && single.mod[name] !== undefined) { resolved[name] = single.mod[name]; continue; }
  if (single.error) loadErrors[file] = String(single.error && single.error.message || single.error);
  // ---- NOTBEHELF ----------------------------------------------------------------------------
  resolved[name] = fallback[name];
  fallbacks.push(name);
}

/** Namen, die NICHT aus shared/ kommen, sondern aus dem Notbehelf (leer = alles in Ordnung). */
export const SHARED_FALLBACKS = Object.freeze(fallbacks.slice());
/** Ladefehler je shared-Datei (nur zur Diagnose im Admin-Überblick/Selbsttest). */
export const SHARED_LOAD_ERRORS = Object.freeze({ ...loadErrors });

if (fallbacks.length) {
  // Absichtlich console.warn: Zu diesem Zeitpunkt gibt es noch keinen Hub-Logger.
  console.warn('[VetNow Hub] WARNUNG: shared/ unvollständig — Notbehelf aktiv für: ' + fallbacks.join(', '));
}

export const APP_VERSION = resolved.APP_VERSION;
export const PROTOCOL = resolved.PROTOCOL;
export const DATA_SCHEMA = resolved.DATA_SCHEMA;
export const SETTINGS_DEFAULT = resolved.SETTINGS_DEFAULT;
export const LABELS_SEED = resolved.LABELS_SEED;
export const SITUATIONS = resolved.SITUATIONS;
export const ANIMAL_LABEL = resolved.ANIMAL_LABEL;
export const DEMO_OWNER = resolved.DEMO_OWNER;
export const DEMO_PRACTICE_ID = resolved.DEMO_PRACTICE_ID;
export const uid = resolved.uid;
export const buildDemoSeed = resolved.buildDemoSeed;
export const buildEmptySeed = resolved.buildEmptySeed;
export const effectiveStatus = resolved.effectiveStatus;
export const withLiveStatus = resolved.withLiveStatus;
export const newMessage = resolved.newMessage;
export const migrateV1 = resolved.migrateV1;
export const shouldAutoReply = resolved.shouldAutoReply;
export const personaFor = resolved.personaFor;
export const generateAutoReply = resolved.generateAutoReply;
export const vetSystemPrompt = resolved.vetSystemPrompt;
export const toAiMessages = resolved.toAiMessages;
export const botReply = resolved.botReply;
export const botImageReply = resolved.botImageReply;
export const runBotSuite = resolved.runBotSuite;
export const BOT_SUITE = resolved.BOT_SUITE;
