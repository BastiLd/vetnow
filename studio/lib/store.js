/* VetNow Studio — Registry (Apps/Gruppen) + Einstellungen.
   Beides als JSON-Dateien im DATA_DIR persistiert. */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.STUDIO_DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'apps.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DEFAULT = path.join(__dirname, '..', 'apps.default.json');

/* Server-seitige Standard-Einstellungen (Frontend hat eigene Registry mit
   Titeln/Beschreibungen/Keywords — hier nur Schlüssel + Defaults). */
const SETTINGS_DEFAULT = {
  // Darstellung
  theme: 'dark',              // dark | light
  accent: '#0f9b8e',          // Akzentfarbe des Studios
  cardDensity: 'normal',      // normal | compact
  showKindBadges: true,       // Typ-Badges (Web/Expo/Extension) auf Karten
  groupView: 'grid',          // grid | list
  // Verhalten
  autoRefreshSec: 5,          // Dashboard-Aktualisierung (Sekunden, 0 = aus)
  logLines: 400,              // maximale Log-Zeilen pro App
  autoOpenLogs: true,         // Logs automatisch öffnen bei Build/Start
  confirmDelete: true,        // Löschen bestätigen
  // KI / Ollama — Vordergrund (Text)
  ollamaUrl: '',              // leer = OLLAMA_URL-Env bzw. http://HOST_IP:11434
  ollamaModel: 'qwen2.5:7b',  // Vordergrund-Modell für /api/ai/chat (Text).
                              // Der Server hat 15,3 GB RAM — die Runde-2-Annahme
                              // „≤ 8 GB" war falsch, 7b ist hier die richtige Wahl.
  // KI / Ollama — Hintergrund (Bilder)
  ollamaVisionModel: '',      // leer = kein Vision-Modell. Wird automatisch statt
                              // ollamaModel benutzt, sobald eine Nachricht ein Bild
                              // enthält (siehe aiAutoVision).
  aiAutoVision: true,         // automatisch aufs Vision-Modell umschalten
  aiTimeoutSec: 60,           // Zeitlimit für normale Text-Antworten (Sekunden)
  aiVisionTimeoutSec: 180,    // Zeitlimit für Antworten MIT Bild — auf der CPU
                              // braucht ein Vision-Modell leicht 20-40 s, bei
                              // größeren Modellen deutlich mehr.
  aiMaxImagePx: 1024,         // längste Bildkante, bevor das Bild gesendet wird
  // Feineinstellungen des Modells (waren bisher in den Apps fest verdrahtet)
  aiTemperature: 0.4,
  aiTopP: 0.9,
  aiNumCtx: 4096,
  aiRepeatPenalty: 1.15,
  // Updates
  updateCheckMin: 60,         // Minuten zwischen Update-Checks (0 = aus)
  autoUpdateOnStart: true,    // (Info) Container zieht bei jedem Start das neueste Repo
};

function ensure() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ignore */ }
  if (!fs.existsSync(FILE)) {
    const seed = fs.readFileSync(DEFAULT, 'utf8');
    fs.writeFileSync(FILE, seed);
  }
}

function read() {
  ensure();
  let data;
  try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { data = JSON.parse(fs.readFileSync(DEFAULT, 'utf8')); }
  return mergeNewDefaults(data);
}

/* Neue Standard-Gruppen/-Apps (z. B. nach einem Repo-Update) einmalig in eine
   bestehende apps.json übernehmen. Bereits gesehene Default-IDs werden in
   seededIds gemerkt, damit vom Nutzer gelöschte Apps nicht wieder auftauchen. */
function mergeNewDefaults(data) {
  try {
    const def = JSON.parse(fs.readFileSync(DEFAULT, 'utf8'));
    data.groups = data.groups || []; data.apps = data.apps || [];
    const seeded = new Set(data.seededIds || data.apps.map((a) => a.id));
    let changed = !Array.isArray(data.seededIds);
    (def.groups || []).forEach((g) => {
      if (!data.groups.some((x) => x.id === g.id)) {
        // vor "andere" einsortieren, sonst ans Ende
        const i = data.groups.findIndex((x) => x.id === 'andere');
        if (i >= 0) data.groups.splice(i, 0, g); else data.groups.push(g);
        changed = true;
      }
    });
    (def.apps || []).forEach((a) => {
      if (!seeded.has(a.id) && !data.apps.some((x) => x.id === a.id)) {
        data.apps.push(a); changed = true;
      } else {
        /* App gibt es schon: NEU hinzugekommene Felder aus den Defaults
           nachtragen (z. B. repoBranch). Vorhandene Werte bleiben unangetastet,
           damit im Studio geänderte Ports/Namen erhalten bleiben. Ohne das
           bekämen bestehende Installationen neue Einstellungen nie zu sehen. */
        const cur = data.apps.find((x) => x.id === a.id);
        if (cur) {
          Object.keys(a).forEach((k) => {
            if (cur[k] === undefined) { cur[k] = a[k]; changed = true; }
          });
        }
      }
      seeded.add(a.id);
    });
    const seededArr = Array.from(seeded);
    if (JSON.stringify(seededArr) !== JSON.stringify(data.seededIds || [])) changed = true;
    data.seededIds = seededArr;
    if (changed) write(data);
  } catch { /* Defaults kaputt/fehlend — bestehende Daten unverändert lassen */ }
  return data;
}

function write(data) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  return data;
}

function readSettings() {
  ensure();
  try { return { ...SETTINGS_DEFAULT, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) }; }
  catch { return { ...SETTINGS_DEFAULT }; }
}

function writeSettings(patch) {
  ensure();
  const merged = { ...readSettings(), ...patch };
  // Nur bekannte Schlüssel speichern (kein Müll in der Datei)
  const clean = {};
  Object.keys(SETTINGS_DEFAULT).forEach((k) => { if (merged[k] !== undefined) clean[k] = merged[k]; });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(clean, null, 2));
  return { ...SETTINGS_DEFAULT, ...clean };
}

function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 8); }

module.exports = { read, write, uid, DATA_DIR, readSettings, writeSettings, SETTINGS_DEFAULT };
