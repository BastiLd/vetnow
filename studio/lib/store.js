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
  // KI / Ollama
  ollamaUrl: '',              // leer = OLLAMA_URL-Env bzw. http://HOST_IP:11434
  ollamaModel: 'gemma2:2b',   // Standard-Modell für /api/ai/chat
  aiTimeoutSec: 60,           // Timeout für KI-Antworten
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
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return JSON.parse(fs.readFileSync(DEFAULT, 'utf8')); }
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
