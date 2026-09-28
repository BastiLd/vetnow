#!/usr/bin/env node
/* VetNow Hub — Standalone-Start:  node hub/index.js   (oder im Ordner hub/: npm start)

   Umgebung:
     VN_HUB_PORT        Port (Standard 8787)
     VN_HUB_HOST        Adresse (Standard 0.0.0.0 = im ganzen WLAN erreichbar)
     VN_DATA_DIR        Datenordner (Standard hub/data)
     VN_WEB_DIST        gebaute Web-App (Standard ../web/dist, falls vorhanden)
     VN_ADMIN_PASSWORD  Admin-Passwort (Standard vetnow2026)
     OLLAMA_URL, VN_AI_MODEL, VN_VISION_MODEL, ANTHROPIC_API_KEY, VN_ANTHROPIC_MODEL, VN_OPENAI_URL … (KI) */
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHub } from './hub.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const port = Number(env.VN_HUB_PORT) || 8787;
const host = env.VN_HUB_HOST || '0.0.0.0';
const dataDir = env.VN_DATA_DIR ? path.resolve(env.VN_DATA_DIR) : path.join(HERE, 'data');
const defaultDist = path.resolve(HERE, '..', 'web', 'dist');
const webDist = env.VN_WEB_DIST ? path.resolve(env.VN_WEB_DIST) : (existsSync(defaultDist) ? defaultDist : null);

/* Alle IPv4-Adressen im LAN (für Handy/Tablet im selben WLAN). */
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      const v4 = a.family === 'IPv4' || a.family === 4;
      if (v4 && !a.internal) out.push({ name, address: a.address });
    }
  }
  return out;
}

let hub;
try {
  hub = await createHub({ dataDir, webDist, port, host, logger: console, env });
} catch (e) {
  if (e && e.code === 'EADDRINUSE') {
    console.error(`\n[VetNow Hub] Port ${port} ist schon belegt. Läuft der Hub bereits? Anderen Port wählen: VN_HUB_PORT=8788 node hub/index.js\n`);
  } else {
    console.error('\n[VetNow Hub] Start fehlgeschlagen:', (e && e.stack) || e);
  }
  process.exit(1);
}

const bases = [`http://localhost:${hub.port}`];
if (host === '0.0.0.0' || host === '::') for (const a of lanAddresses()) bases.push(`http://${a.address}:${hub.port}`);
else if (host !== 'localhost' && host !== '127.0.0.1') bases.push(`http://${host}:${hub.port}`);

const st = await hub.ai.status().catch(() => null);
const summary = st ? st.providers.filter((p) => p.id !== 'mock').map((p) => `${p.label}: ${p.ok ? 'bereit' : 'aus'}`).join(' · ') : '';
const aiLine = !st ? 'unbekannt'
  : st.active ? `${st.active.label} (${st.active.model || 'Standardmodell'}) — Einstellung „${st.provider}"`
    : `keine KI aktiv → Auto-Antworten kommen vom Bot (${summary}; Test-KI im Admin-Center wählbar)`;

const line = '─'.repeat(64);
const lines = [
  '',
  line,
  `  VetNow Hub ${hub.version} läuft (Protokoll ${hub.protocol})`,
  line,
  '  Web-App:' + (webDist ? '' : '   (nicht gebaut — im Ordner web/ „npm run build" ausführen)'),
  ...(webDist ? bases.map((b) => `    ${b}/vetnow/`) : []),
  '  Admin-/Test-Center:',
  ...(webDist ? bases.map((b) => `    ${b}/vetnow/#/admin`) : ['    (braucht die gebaute Web-App)']),
  '  API:',
  ...bases.map((b) => `    ${b}/api/v1/health`),
  '',
  `  Daten:  ${dataDir}`,
  `  KI:     ${aiLine}`,
  `  Admin:  am PC ohne Passwort; im WLAN mit ${env.VN_ADMIN_PASSWORD ? 'VN_ADMIN_PASSWORD' : 'dem Standard-Passwort „vetnow2026"'}`,
  '  Beenden mit Strg+C',
  line,
  '',
];
console.log(lines.join('\n'));

let stopping = false;
async function shutdown(signal) {
  if (stopping) { console.log('[VetNow Hub] Sofort beendet.'); process.exit(1); }
  stopping = true;
  console.log(`\n[VetNow Hub] ${signal} empfangen — speichere und beende …`);
  const force = setTimeout(() => { console.error('[VetNow Hub] Beenden dauert zu lange — erzwinge Ende.'); process.exit(1); }, 5000);
  force.unref();
  try {
    await hub.close();
    console.log('[VetNow Hub] Gespeichert. Tschüss!');
    process.exit(0);
  } catch (e) {
    console.error('[VetNow Hub] Fehler beim Beenden:', e && e.message);
    process.exit(1);
  }
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (e) => console.error('[VetNow Hub] Unbehandelter Fehler:', (e && e.stack) || e));
