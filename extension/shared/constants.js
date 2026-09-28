// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* VetNow — Konstanten, die ALLE Clients teilen (Web, Handy, Extension, Hub).
   Früher gab es drei leicht unterschiedliche Kopien (web/src/data.js, mobile/src/data.js,
   extension/data.js) mit abweichenden Status- und Tier-Bezeichnungen. Ab v3 ist diese Datei
   die einzige Quelle — Vertrag: docs/V3-ARCHITEKTUR.md §4/§5.
   Reines ESM ohne Abhängigkeiten, damit sie auch in React Native (Hermes) und im
   Extension-Service-Worker läuft. */

/* ---- Ampel-Status ----
   `label` bleibt aus Kompatibilitätsgründen = Langtext: alter UI-Code liest STATUS[x].label.
   `short` ist für enge Stellen (Extension-Popup, Badges), `long` für Ergebnisliste/Detail.
   `title`/`sub` sind die Beschriftungen der Status-Knöpfe im Praxis-Dashboard.
   Die Farbwerte spiegeln die Design-Tokens aus web/src/base.css, damit Handy (ohne CSS)
   und Extension dieselben Farben verwenden können. */
export const STATUS = Object.freeze({
  green: Object.freeze({
    key: 'green', short: 'Erreichbar', long: 'Heute erreichbar', label: 'Heute erreichbar',
    title: 'Heute erreichbar / nehme Notfälle an', sub: 'Wird als grün angezeigt',
    cls: 'green', color: '#16a34a', bg: '#e7f6ec', ink: '#137a39', rank: 0,
  }),
  yellow: Object.freeze({
    key: 'yellow', short: 'Rücksprache', long: 'Nur nach Rücksprache', label: 'Nur nach Rücksprache',
    title: 'Nur nach telefonischer Rücksprache', sub: 'Wird als gelb angezeigt',
    cls: 'yellow', color: '#e3a008', bg: '#fdf2da', ink: '#8a5d05', rank: 1,
  }),
  grey: Object.freeze({
    key: 'grey', short: 'Nicht bestätigt', long: 'Nicht aktuell bestätigt', label: 'Nicht aktuell bestätigt',
    title: 'Nicht aktuell bestätigt', sub: 'Status seit über 24 Stunden nicht bestätigt',
    cls: 'grey', color: '#94a39f', bg: '#eef1f0', ink: '#5e6e6a', rank: 2,
    /* Diese beiden Texte standen früher fest bei den „grauen" Demo-Praxen. Weil ein Status
       jetzt wirklich abläuft, kann JEDE Praxis grau werden — der Hinweis gehört also zum
       Status, nicht zur Praxis (status.js setzt ihn in withLiveStatus ein). */
    notice: 'Status nicht aktuell bestätigt – bitte unbedingt telefonisch prüfen.',
    noticeLong: 'Der Status dieser Praxis wurde seit über 24 Stunden nicht bestätigt und ist daher nicht aktuell. Bitte unbedingt telefonisch prüfen, ob heute Notfälle angenommen werden.',
  }),
  red: Object.freeze({
    key: 'red', short: 'Nicht verfügbar', long: 'Heute nicht verfügbar', label: 'Heute nicht verfügbar',
    title: 'Heute nicht verfügbar', sub: 'Wird als rot angezeigt',
    cls: 'red', color: '#dc2626', bg: '#fcebeb', ink: '#b3201c', rank: 3,
  }),
});

/* Reihenfolge = Rangfolge (grün zuerst, rot zuletzt). */
export const STATUS_KEYS = Object.freeze(['green', 'yellow', 'grey', 'red']);
/* Werte, die eine Praxis selbst setzen kann — grau entsteht nur durch Ablauf. */
export const SETTABLE_STATUS_KEYS = Object.freeze(['green', 'yellow', 'red']);
/* Standard-Gültigkeit einer Status-Bestätigung. */
export const STATUS_HOURS_DEFAULT = 24;

/* ---- Tiere ----
   Web-Bezeichnungen bleiben verbindlich ('Kleintiere', 'Reptilien/Exoten', 'Anderes');
   die Extension hatte eigene ('Kleintier', 'Exoten', 'Tier') — das war einer der Drift-Fehler. */
export const ANIMALS = Object.freeze([
  { key: 'cat', label: 'Katze' },
  { key: 'dog', label: 'Hund' },
  { key: 'small', label: 'Kleintiere' },
  { key: 'horse', label: 'Pferd' },
  { key: 'bird', label: 'Vogel' },
  { key: 'exotic', label: 'Reptilien/Exoten' },
  { key: 'other', label: 'Anderes' },
]);
export const ANIMAL_LABEL = Object.freeze({
  cat: 'Katze', dog: 'Hund', small: 'Kleintiere', horse: 'Pferd', bird: 'Vogel', exotic: 'Reptilien/Exoten', other: 'Anderes',
});
/* Einzahl für Untertitel wie „Hoppel (Kleintier)" — „Hoppel (Kleintiere)" liest sich falsch. */
export const ANIMAL_SINGULAR = Object.freeze({
  cat: 'Katze', dog: 'Hund', small: 'Kleintier', horse: 'Pferd', bird: 'Vogel', exotic: 'Reptil/Exot', other: 'Tier',
});
/* Icon-Namen (VNIcon-Schlüssel) je Tierart — identisch zu web/src/components.jsx ANIMAL_ICON. */
export const ANIMAL_ICON = Object.freeze({
  cat: 'cat', dog: 'dog', small: 'rabbit', horse: 'horse', bird: 'bird', exotic: 'turtle', other: 'paw',
});

/* ---- Leistungen & Spezialgebiete ---- */
export const SERVICE_LABEL = Object.freeze({
  emergency: 'Notfall', regular: 'Normale Termine', euthanasia: 'Einschläferung', housecall: 'Hausbesuch',
});
export const SERVICE_ICON = Object.freeze({ emergency: 'siren', regular: 'cal', euthanasia: 'heart', housecall: 'home' });
export const SPECIALTY_LABEL = Object.freeze({
  chirurgie: 'Chirurgie', zahn: 'Zahnbehandlungen', ortho: 'Orthopädie',
  augen: 'Augenheilkunde', haut: 'Hautkrankheiten', herz: 'Herz / Kardiologie',
  onko: 'Onkologie', neuro: 'Neurologie', exoten: 'Exoten / Vögel / Reptilien',
});
export const SPECIALTIES = Object.freeze(Object.keys(SPECIALTY_LABEL).map((key) => ({ key, label: SPECIALTY_LABEL[key] })));

/* ---- Bezirke ----
   Die 8 Kurznamen sind die Filter-Werte. Praxen speichern `district` = Kurzname und
   `districtLong` = Langname. Früher standen bei manchen Praxen Langnamen ('Spittal an der Drau')
   im Feld district — dadurch zeigte das Anfrageformular „Bitte wählen" (Web-Audit). */
export const DISTRICTS = Object.freeze(['Villach', 'Klagenfurt', 'Spittal', 'Wolfsberg', 'St. Veit', 'Feldkirchen', 'Völkermarkt', 'Hermagor']);
export const DISTRICT_LONG = Object.freeze({
  Villach: 'Villach', Klagenfurt: 'Klagenfurt', Spittal: 'Spittal an der Drau', Wolfsberg: 'Wolfsberg',
  'St. Veit': 'St. Veit an der Glan', Feldkirchen: 'Feldkirchen', 'Völkermarkt': 'Völkermarkt', Hermagor: 'Hermagor',
});

export const SITUATIONS = Object.freeze([
  { key: 'emergency', label: 'Notfall' },
  { key: 'regular', label: 'Normale Termine' },
  { key: 'euthanasia', label: 'Einschläferung' },
  { key: 'housecall', label: 'Hausbesuch' },
]);

/* ---- Termine ---- */
export const APPT_STATUS = Object.freeze({
  open: { label: 'Offen', cls: 'yellow' },
  confirmed: { label: 'Bestätigt', cls: 'blue' },
  done: { label: 'Erledigt', cls: 'green' },
  cancelled: { label: 'Abgesagt', cls: 'red' },
});

/* ---- Chat-Rubriken ----
   key = Rubrik aus chatView(): 'owner' (Meine Tiere), 'clinic' (Praxis-Posteingang),
   'network' (Praxis-Netzwerk). defaultLabel = passendes Label aus LABELS_SEED. */
export const CHAT_ROLES = Object.freeze([
  { key: 'owner', label: 'Meine Tiere', defaultLabel: 'tiere' },
  { key: 'clinic', label: 'Praxis-Posteingang', defaultLabel: 'posteingang' },
  { key: 'network', label: 'Praxis-Netzwerk', defaultLabel: 'netzwerk' },
]);

/* Stempel neben einer Nachricht je `source` (Vertrag §4 Message.source). */
export const SOURCE_LABEL = Object.freeze({
  ai: 'KI', 'ai-vision': 'KI · Bild', bot: 'Bot', 'mock-ai': 'Test-KI', error: 'Hinweis',
});

/* ---- Labels ----
   Die IDs bleiben die alten ('tiere', 'notfall' …), weil übernommene v1-Chats genau diese IDs
   in chat.labels tragen. NEU: `roles` — Tierhalter:innen sehen nur Labels mit 'owner'
   (vorher sahen sie auch „Praxis-Posteingang"/„Praxis-Netzwerk", Web-Audit). */
export const LABELS_SEED = Object.freeze([
  { id: 'tiere', name: 'Meine Tiere', color: '#0f9b8e', icon: 'paw2', roles: ['owner'], seed: true },
  { id: 'posteingang', name: 'Praxis-Posteingang', color: '#2e6f9e', icon: 'building', roles: ['clinic'], seed: true },
  { id: 'netzwerk', name: 'Praxis-Netzwerk', color: '#8a5d05', icon: 'shield', roles: ['clinic'], seed: true },
  { id: 'notfall', name: 'Notfall', color: '#dc2626', icon: 'siren', roles: ['owner', 'clinic'], seed: true },
  { id: 'termin', name: 'Termin', color: '#16a34a', icon: 'cal', roles: ['owner', 'clinic'], seed: true },
  { id: 'erledigt', name: 'Erledigt', color: '#6c7d79', icon: 'check', roles: ['owner', 'clinic'], seed: true },
].map((l) => Object.freeze({ ...l, roles: Object.freeze(l.roles.slice()) })));

/* ---- Einstellungen (Vertrag §4 Settings) ----
   botMode: 'ai-fallback' = KI; ist sie schlicht nicht da (offline/timeout), antwortet STILL der
   eingebaute Bot — so bleibt eine Vorführung ohne Netz sauber. 'ai' = nur KI (Fehler sichtbar),
   'bot' = nur Regel-Bot, 'off' = keine Auto-Antworten.
   aiLegacyUrl: Adresse eines ALTEN Studios ohne Hub (…/api/ai), siehe §7 „Legacy-KI". */
export const SETTINGS_DEFAULT = Object.freeze({
  botMode: 'ai-fallback',
  typing: true,
  greeting: true,
  agentEnabled: true,
  showLabels: true,
  enableOwner: true,
  enablePosteingang: true,
  enableNetwork: true,
  hideTestData: false,
  aiLegacyUrl: '',
  ai: Object.freeze({ provider: 'auto', model: '', visionModel: '' }),
});
export const BOT_MODES = Object.freeze(['ai-fallback', 'ai', 'bot', 'off']);
export const AI_PROVIDERS = Object.freeze(['auto', 'mock', 'ollama', 'anthropic', 'openai']);
/* Diese Einstellungen gelten im Hub-Modus für ALLE Geräte (der Hub antwortet serverseitig);
   alle anderen sind reine Anzeige-Einstellungen dieses Geräts. */
export const SERVER_SETTING_KEYS = Object.freeze(['botMode', 'typing', 'greeting', 'ai']);

/* Frische, veränderbare Kopie der Standard-Einstellungen (SETTINGS_DEFAULT ist eingefroren). */
export function defaultSettings() {
  return { ...SETTINGS_DEFAULT, ai: { ...SETTINGS_DEFAULT.ai } };
}
/* Frische, veränderbare Kopie der Standard-Labels. */
export function seedLabels() {
  return LABELS_SEED.map((l) => ({ ...l, roles: l.roles.slice() }));
}

/* ---- Demo-Identitäten (Vertrag §4 Auth) ---- */
export const DEMO_OWNER = Object.freeze({ ownerId: 'owner-demo', name: 'Familie Berger' });
export const DEMO_PRACTICE_ID = 'drautal';
export const DEMO_PRACTICE = Object.freeze({ practiceId: 'drautal', name: 'Tierarztpraxis Drautal' });

/* ---- Grenzen ---- */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // Hub-Limit für /files (§6)
export const HUB_PORT = 8787;
export const STUDIO_PORT = 3000;
export const ZIMA_STUDIO_URL = 'http://192.168.68.10:3000';
