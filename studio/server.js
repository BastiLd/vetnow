/* VetNow Studio 2.0 — Backend.
   Registry (Apps/Gruppen), Einstellungen, Web-Builds + statische Vorschau,
   Expo-Server (mehrere parallel, mit eigener Env je App), QR-Codes,
   Extension-ZIP, Ollama-Proxy (Status/Modelle/Pull/Chat) und Selbst-Update
   (git pull + Neustart im Container). Ein Container, eine Oberfläche. */
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const QRCode = require('qrcode');
const archiver = require('archiver');
const store = require('./lib/store');
const proc = require('./lib/proc');

const REPO_ROOT = process.env.REPO_ROOT || path.resolve(__dirname, '..');
const PORT = parseInt(process.env.STUDIO_PORT || '3000', 10);
const IN_DOCKER = process.env.IN_DOCKER === '1' || fs.existsSync('/.dockerenv');
const STARTED_AT = Date.now();

function hostIp() {
  // HOST_IP darf eine LAN-IP (z. B. 192.168.68.10), eine Tailscale-IP
  // (100.x.y.z) oder ein Tailscale-MagicDNS-Name sein. Damit zeigen die
  // QR-Codes (exp://HOST_IP:PORT) je nach Setup ins LAN oder ins Tailnet.
  if (process.env.HOST_IP) return process.env.HOST_IP;
  if (process.env.REACT_NATIVE_PACKAGER_HOSTNAME) return process.env.REACT_NATIVE_PACKAGER_HOSTNAME;
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const i of ifs[name]) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return 'localhost';
}

function ollamaUrl() {
  const s = store.readSettings();
  return (s.ollamaUrl || process.env.OLLAMA_URL || `http://${hostIp()}:11434`).replace(/\/+$/, '');
}

function gitInfo() {
  const opts = { cwd: REPO_ROOT, timeout: 8000 };
  const run = (args) => { try { return execFileSync('git', args, opts).toString().trim(); } catch { return ''; } };
  return {
    commit: run(['rev-parse', '--short', 'HEAD']),
    branch: run(['rev-parse', '--abbrev-ref', 'HEAD']),
    lastMsg: run(['log', '-1', '--format=%s']),
    lastDate: run(['log', '-1', '--format=%ci']),
  };
}

const app = express();
/* 8 MB statt 2 MB: Chat-Anfragen MIT Bild tragen das Foto als Base64 im Body.
   Die Apps rechnen Bilder vorher auf ~1024 px herunter (typisch 150-400 KB),
   das Limit ist der Sicherheitspuffer für Bild + Gesprächsverlauf + Prompt.
   Mit 2 MB endete jede Bildanfrage in einem HTTP 413. */
app.use(express.json({ limit: '8mb' }));

// ---------- Web-Vorschau: statisch aus dem dist-Ordner je App (basePath) ----------
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/') return next();
  const reg = store.read();
  const webApps = (reg.apps || []).filter((a) => a.kind === 'web' && a.basePath);
  for (const a of webApps) {
    const bp = a.basePath.endsWith('/') ? a.basePath : a.basePath + '/';
    if (bp === '/') continue; // '/' würde das Dashboard verdecken
    if (req.path === bp.slice(0, -1) || req.path.startsWith(bp)) {
      const root = a.repoUrl ? extRepoDir(a) : REPO_ROOT;
      const distAbs = path.join(root, a.webDir || '.', a.distDir || 'dist');
      let rel = req.path.slice(bp.length);
      if (!rel || rel === '/') rel = 'index.html';
      const filePath = path.normalize(path.join(distAbs, rel));
      if (!filePath.startsWith(distAbs)) return res.status(403).end();
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return res.sendFile(filePath);
      const idx = path.join(distAbs, 'index.html');
      if (fs.existsSync(idx)) return res.sendFile(idx);
      return res.status(404).send('Diese App wurde noch nicht gebaut. Im Studio auf „Bauen“ klicken.');
    }
  }
  next();
});

// ---------- Dashboard (statisch) ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------
const EXT_REPOS = path.join(store.DATA_DIR, 'ext-repos');
function extRepoDir(a) { return path.join(EXT_REPOS, a.id); }
function appRoot(a) { return a.repoUrl ? extRepoDir(a) : REPO_ROOT; }

function appById(id) { return (store.read().apps || []).find((a) => a.id === id); }
function distExists(a) {
  if (a.kind !== 'web') return false;
  return fs.existsSync(path.join(appRoot(a), a.webDir || '.', a.distDir || 'dist', 'index.html'));
}
function enrich(a, ip) {
  const st = proc.statusOf(a.id);
  const out = { ...a, status: st };
  if (a.kind === 'web') {
    out.built = distExists(a);
    out.previewUrl = a.basePath || '/';
    out.publicUrl = `http://${ip}:${PORT}${a.basePath || '/'}`;
  }
  if (a.kind === 'expo') {
    out.expUrl = `exp://${ip}:${a.expoPort || 8081}`;
  }
  if (a.kind === 'extension') {
    out.zipUrl = `/api/apps/${a.id}/extension.zip`;
  }
  if (a.repoUrl) out.cloned = fs.existsSync(path.join(extRepoDir(a), '.git'));
  return out;
}

/* Externes Repo einer App klonen/aktualisieren (für "Duolingo für Recht" & Co.)
   Mit optionalem `repoBranch`: liegt der Code nicht im Standard-Branch, wurde
   vorher stillschweigend der falsche Stand geklont — der Ordner der App fehlte
   dann schlicht ("cd .../mobile: No such file or directory"). */
function ensureExtRepoCmd(a) {
  if (!a.repoUrl) return '';
  const dir = extRepoDir(a).replace(/\\/g, '/');
  const br = String(a.repoBranch || '').trim().replace(/[^A-Za-z0-9._\/-]/g, '');
  const clone = br ? `git clone -b "${br}" "${a.repoUrl}" "${dir}"` : `git clone "${a.repoUrl}" "${dir}"`;
  /* Der Ordner ist ein reiner BAU-Klon — hier wird nichts von Hand editiert.
     Trotzdem entstehen beim Bauen Dateien (package-lock.json) und Werkzeuge
     wie EAS ändern app.json. Ein einfaches checkout/pull scheitert daran mit
     "Your local changes would be overwritten". Deshalb hart auf den Server-
     Stand zurücksetzen und unverfolgte Dateien wegräumen.
     `git clean -fd` fasst per .gitignore ausgeschlossene Ordner (node_modules)
     NICHT an — die Installation bleibt also erhalten. */
  const update = br
    ? `git -C "${dir}" fetch origin "${br}" && git -C "${dir}" reset --hard "origin/${br}" && ` +
      `git -C "${dir}" clean -fd && git -C "${dir}" checkout -B "${br}" "origin/${br}"`
    : `git -C "${dir}" reset --hard && git -C "${dir}" clean -fd && (git -C "${dir}" pull --ff-only || true)`;
  return `if [ ! -d "${dir}/.git" ]; then ${clone}; else ${update}; fi && `;
}

// ---------- Status & Einstellungen ----------
app.get('/api/status', (req, res) => {
  let version = '';
  try { version = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version; } catch { /* ignore */ }
  res.json({
    hostIp: hostIp(), repoRoot: REPO_ROOT, port: PORT, node: process.version,
    platform: process.platform, inDocker: IN_DOCKER, version,
    uptimeSec: Math.round((Date.now() - STARTED_AT) / 1000),
    git: gitInfo(),
  });
});

app.get('/api/settings', (req, res) => res.json(store.readSettings()));
app.put('/api/settings', (req, res) => res.json(store.writeSettings(req.body || {})));

// ---------- Apps & Gruppen ----------
app.get('/api/apps', (req, res) => {
  const reg = store.read();
  const ip = hostIp();
  res.json({ groups: reg.groups || [], apps: (reg.apps || []).map((a) => enrich(a, ip)) });
});

app.get('/api/apps/:id', (req, res) => {
  const a = appById(req.params.id);
  if (!a) return res.status(404).json({ error: 'App nicht gefunden' });
  res.json(enrich(a, hostIp()));
});

app.post('/api/apps', (req, res) => {
  const reg = store.read();
  const b = req.body || {};
  const napp = {
    id: store.uid('app-'),
    name: b.name || 'Neue App', group: b.group || (reg.groups[0] && reg.groups[0].id) || 'andere',
    color: b.color || '#0f9b8e', icon: b.icon || '📦', kind: b.kind || 'web',
    repoUrl: (b.repoUrl || '').trim(),
    repoBranch: (b.repoBranch || '').trim(),
  };
  if (napp.kind === 'web') { napp.webDir = b.webDir || 'web'; napp.distDir = b.distDir || 'dist'; napp.basePath = b.basePath || '/' + napp.id + '/'; napp.buildCmd = b.buildCmd || 'npm ci && npm run build'; }
  if (napp.kind === 'expo') { napp.expoDir = b.expoDir || 'mobile'; napp.expoSdk = b.expoSdk || '54'; napp.expoPort = parseInt(b.expoPort, 10) || 8081; napp.env = b.env || {}; }
  if (napp.kind === 'extension') { napp.extensionDir = b.extensionDir || 'extension'; }
  reg.apps.push(napp);
  store.write(reg);
  res.json(enrich(napp, hostIp()));
});

app.put('/api/apps/:id', (req, res) => {
  const reg = store.read();
  const idx = reg.apps.findIndex((a) => a.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'App nicht gefunden' });
  const allowed = ['name', 'group', 'color', 'icon', 'webDir', 'distDir', 'basePath', 'buildCmd', 'expoDir', 'expoSdk', 'expoPort', 'extensionDir', 'repoUrl', 'repoBranch', 'env'];
  allowed.forEach((k) => { if (req.body[k] !== undefined) reg.apps[idx][k] = req.body[k]; });
  if (reg.apps[idx].expoPort) reg.apps[idx].expoPort = parseInt(reg.apps[idx].expoPort, 10) || 8081;
  store.write(reg);
  res.json(enrich(reg.apps[idx], hostIp()));
});

app.post('/api/apps/:id/duplicate', (req, res) => {
  const reg = store.read();
  const src = reg.apps.find((a) => a.id === req.params.id);
  if (!src) return res.status(404).json({ error: 'App nicht gefunden' });
  const copy = { ...src, id: store.uid('app-'), name: src.name + ' (Kopie)' };
  if (copy.kind === 'expo') copy.expoPort = (parseInt(src.expoPort, 10) || 8081) + 1;
  if (copy.kind === 'web' && copy.basePath) copy.basePath = '/' + copy.id + '/';
  reg.apps.push(copy);
  store.write(reg);
  res.json(enrich(copy, hostIp()));
});

app.delete('/api/apps/:id', (req, res) => {
  proc.stop(req.params.id);
  const reg = store.read();
  reg.apps = reg.apps.filter((a) => a.id !== req.params.id);
  store.write(reg);
  res.json({ ok: true });
});

app.put('/api/groups', (req, res) => {
  const reg = store.read();
  if (Array.isArray(req.body.groups)) reg.groups = req.body.groups;
  store.write(reg);
  res.json({ groups: reg.groups });
});

app.get('/api/apps/:id/logs', (req, res) => {
  res.json({ lines: proc.getLogs(req.params.id), status: proc.statusOf(req.params.id) });
});

// ---------- App-Aktionen ----------
app.post('/api/apps/:id/action', async (req, res) => {
  const a = appById(req.params.id);
  if (!a) return res.status(404).json({ error: 'App nicht gefunden' });
  const action = req.body.action;
  const ip = hostIp();
  const root = appRoot(a);

  if (action === 'build' && a.kind === 'web') {
    const cwd = path.join(root, a.webDir || '.');
    const pre = ensureExtRepoCmd(a);
    const cmd = a.repoUrl
      ? pre + `cd "${cwd.replace(/\\/g, '/')}" && ` + (a.buildCmd || 'npm ci && npm run build')
      : (a.buildCmd || 'npm ci && npm run build');
    return res.json(proc.runOnce(a.id, { task: 'Bauen', shellCmd: cmd, cwd: a.repoUrl ? undefined : cwd }));
  }
  if (action === 'pull') {
    if (a.repoUrl) {
      // Fremdes Repo: klont beim ersten Mal und beachtet den eingestellten Branch
      return res.json(proc.runOnce(a.id, { task: 'Aktualisieren', shellCmd: ensureExtRepoCmd(a) + 'echo fertig' }));
    }
    return res.json(proc.runOnce(a.id, { task: 'Aktualisieren', shellCmd: 'git pull --ff-only', cwd: REPO_ROOT }));
  }
  if (action === 'clone' && a.repoUrl) {
    return res.json(proc.runOnce(a.id, { task: 'Klonen', shellCmd: ensureExtRepoCmd(a) + 'echo fertig' }));
  }
  if (action === 'start' && a.kind === 'expo') {
    const cwd = path.join(root, a.expoDir || '.');
    const envx = {
      REACT_NATIVE_PACKAGER_HOSTNAME: ip, CI: '1', EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_AI_URL: `http://${ip}:3000/api/ai`, // KI-Proxy fürs Handy (Expo Go)
      ...(a.env || {}),
    };
    const port = a.expoPort || 8081;
    // Apps aus einem FREMDEN Repo (repoUrl) werden hier automatisch geklont bzw.
    // aktualisiert — sonst müsste man vor jedem Start erst „Klonen“ drücken und
    // ein Repo-Update käme nie an. Ebenso: fehlende node_modules nachinstallieren.
    if (a.repoUrl || !fs.existsSync(path.join(cwd, 'node_modules'))) {
      const sh = process.platform === 'win32' ? 'cmd' : 'bash';
      const flag = process.platform === 'win32' ? '/c' : '-c';
      const pre = ensureExtRepoCmd(a); // endet mit "&& " bzw. ist leer
      const inDir = a.repoUrl ? `cd "${cwd.replace(/\\/g, '/')}" && ` : '';
      return res.json(await proc.startLongRunning(a.id, {
        cmd: sh,
        args: [flag, pre + inDir + `npm install --no-audit --no-fund && npx expo start --port ${port}`],
        cwd: a.repoUrl ? undefined : cwd,
        kind: 'expo', port, env: envx,
      }));
    }
    return res.json(await proc.startLongRunning(a.id, {
      cmd: 'npx', args: ['expo', 'start', '--port', String(port)], cwd, kind: 'expo', port,
      env: envx,
    }));
  }
  if (action === 'stop') {
    return res.json(proc.stop(a.id));
  }
  if (action === 'set-sdk' && a.kind === 'expo') {
    const sdk = String(req.body.sdk || '').replace(/[^0-9]/g, '');
    if (!sdk) return res.status(400).json({ error: 'Ungültige SDK-Version' });
    const reg = store.read();
    const idx = reg.apps.findIndex((x) => x.id === a.id);
    reg.apps[idx].expoSdk = sdk; store.write(reg);
    const cwd = path.join(root, a.expoDir || '.');
    return res.json(proc.runOnce(a.id, { task: 'Expo-SDK ' + sdk, shellCmd: `npm install expo@~${sdk}.0.0 && npx expo install --fix`, cwd }));
  }
  // Android-APK in der EAS-Cloud bauen — läuft danach ÜBERALL, ohne WLAN/Server.
  // Voraussetzung (einmalig): EXPO_TOKEN in der docker-compose.yml + eas.json im
  // Projektordner + einmal `eas build` interaktiv (Keystore). Details: Anleitung.
  if (action === 'build-apk' && a.kind === 'expo') {
    const cwd = path.join(root, a.expoDir || '.');
    if (!fs.existsSync(path.join(cwd, 'eas.json'))) {
      return res.status(400).json({ error: 'eas.json fehlt in „' + (a.expoDir || '.') + '". Bitte einmalig die APK-Ersteinrichtung machen (siehe ANLEITUNG-AUSSERHALB-WLAN.md).' });
    }
    if (!process.env.EXPO_TOKEN) {
      return res.status(400).json({ error: 'EXPO_TOKEN fehlt. In der docker-compose.yml unter „environment“ eintragen (kostenloses Token von expo.dev → Account → Access Tokens), dann Studio neu starten. Details in der Anleitung.' });
    }
    const clean = a.env && String(a.env.EXPO_PUBLIC_VN_CLEAN) === 'true';
    const profile = String(req.body.profile || (clean ? 'preview-clean' : 'preview')).replace(/[^a-z0-9-]/gi, '');
    const cmd = `npx --yes eas-cli@latest build --platform android --profile ${profile} --non-interactive`;
    return res.json(proc.runOnce(a.id, { task: 'APK bauen (' + profile + ')', shellCmd: cmd, cwd, env: { EXPO_NO_TELEMETRY: '1' } }));
  }
  return res.status(400).json({ error: 'Unbekannte Aktion für diese App' });
});

// ---------- KI / Ollama-Proxy ----------

/* Ollama-Rohfehler in verständliches Deutsch übersetzen.
   Ohne das steht im Studio z. B. wörtlich „llama runner process has terminated
   with exit code -1" — technisch korrekt und für niemanden hilfreich. */
const AI_ERROR_MAP = [
  [/exit code -1|runner process has terminated|llm server not responding/i,
    'Das Modell konnte nicht geladen werden. Häufigste Ursache: Es passt nicht auf die Grafikkarte. '
    + 'Tipp: Ollama auf reinen CPU-Betrieb stellen (Umgebungsvariable OLLAMA_NUM_GPU=0 bzw. CUDA_VISIBLE_DEVICES="") und die Ollama-App neu starten.'],
  [/out of memory|cuda error|insufficient memory|failed to allocate/i,
    'Zu wenig Speicher für dieses Modell. Entweder ein kleineres Modell wählen oder Ollama auf CPU-Betrieb stellen (OLLAMA_NUM_GPU=0).'],
  [/does not support (images|vision)|image input is not supported|unable to process image/i,
    'Dieses Modell kann keine Bilder verarbeiten. Im Studio unter KI ein Vision-Modell installieren und als Hintergrund-Modell setzen.'],
  [/does not support tools/i, 'Dieses Modell unterstützt keine Werkzeuge (Tools).'],
  [/model .* not found|no such model|pull the model/i,
    'Dieses Modell ist auf dem Server nicht installiert. Im KI-Tab herunterladen.'],
  [/context length|too many tokens|exceeds context/i,
    'Die Anfrage ist zu lang für das Kontextfenster des Modells. Entweder weniger Verlauf mitschicken oder num_ctx erhöhen (Einstellungen → KI).'],
  [/aborted|abort|timeout|timed out/i,
    'Zeitlimit überschritten — das Modell hat nicht rechtzeitig geantwortet. Bei Bildern auf der CPU ist das normal: Zeitlimit erhöhen (Einstellungen → KI) oder ein kleineres Modell wählen.'],
  [/ECONNREFUSED|fetch failed|ENOTFOUND|EHOSTUNREACH|not reachable/i,
    'Ollama ist nicht erreichbar. Läuft der Ollama-Dienst auf dem Server (Standard-Port 11434)? Adresse prüfen unter Einstellungen → KI.'],
  [/413|too large|payload/i,
    'Die Anfrage war zu groß (meist ein zu großes Bild). Das Bild wird eigentlich automatisch verkleinert — bitte im Studio unter Einstellungen → KI die maximale Bildkante prüfen.'],
];

function aiErrorText(err) {
  const raw = typeof err === 'string' ? err : (err && err.message) || String(err || '');
  for (const [rx, msg] of AI_ERROR_MAP) if (rx.test(raw)) return msg;
  return raw ? 'Unerwarteter KI-Fehler: ' + raw.slice(0, 200) : 'Unbekannter KI-Fehler.';
}

/* Maschinenlesbare Einordnung — die Apps müssen unterscheiden können:
   `offline` = KI schlicht nicht da → der eingebaute Bot übernimmt STILL
               (so muss sich eine Vorführung ohne Netz weiterhin verhalten).
   alles andere = echtes Problem mit Modell oder Bild → sichtbarer Hinweis. */
function aiErrorCode(err) {
  const raw = typeof err === 'string' ? err : (err && err.message) || String(err || '');
  if (/ECONNREFUSED|fetch failed|ENOTFOUND|EHOSTUNREACH|not reachable|aborted|abort|timeout|timed out/i.test(raw)) return 'offline';
  if (/does not support (images|vision)|image input is not supported|unable to process image/i.test(raw)) return 'no-vision';
  if (/exit code -1|runner process has terminated|out of memory|cuda error|insufficient memory/i.test(raw)) return 'model-crash';
  if (/model .* not found|no such model/i.test(raw)) return 'model-missing';
  return 'other';
}

async function ollamaFetch(pathname, opts = {}, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(ollamaUrl() + pathname, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

app.get('/api/ai/status', async (req, res) => {
  const s = store.readSettings();
  try {
    const r = await ollamaFetch('/api/version', {}, 4000);
    const v = await r.json();
    res.json({
      ok: true, ollama: 'Ollama ' + (v.version || ''), url: ollamaUrl(),
      defaultModel: s.ollamaModel, visionModel: s.ollamaVisionModel, autoVision: s.aiAutoVision !== false,
    });
  } catch (e) {
    res.json({ ok: false, url: ollamaUrl(), hint: aiErrorText(e) });
  }
});

app.get('/api/ai/models', async (req, res) => {
  try {
    const r = await ollamaFetch('/api/tags', {}, 8000);
    const d = await r.json();
    const models = (d.models || []).map((m) => ({
      name: m.name, sizeGb: m.size ? +(m.size / 1e9).toFixed(1) : null,
      family: m.details && m.details.family, params: m.details && m.details.parameter_size,
      // Diese drei kamen bisher an und wurden weggeworfen:
      quant: m.details && m.details.quantization_level,
      families: (m.details && m.details.families) || [],
      modifiedAt: m.modified_at || null,
    }));
    const s = store.readSettings();
    res.json({ models, defaultModel: s.ollamaModel, visionModel: s.ollamaVisionModel });
  } catch {
    res.status(502).json({ error: 'Ollama nicht erreichbar', models: [] });
  }
});

/* Detail-Infos zu EINEM Modell (Ollama /api/show). Liefert u. a. `capabilities`
   — daraus ergibt sich automatisch, ob ein Modell Bilder versteht; das war
   bisher im Frontend hartkodiert. Ergebnis wird gecacht, weil /api/show je
   Aufruf spürbar dauert und sich der Inhalt nur beim Neuinstallieren ändert. */
const showCache = new Map(); // name -> { at, data }
const SHOW_TTL_MS = 10 * 60 * 1000;

async function modelInfo(name) {
  const hit = showCache.get(name);
  if (hit && Date.now() - hit.at < SHOW_TTL_MS) return hit.data;
  const r = await ollamaFetch('/api/show', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: name }),
  }, 15000);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  const det = d.details || {};
  const info = d.model_info || {};
  const ctxKey = Object.keys(info).find((k) => k.endsWith('.context_length'));
  const data = {
    name,
    capabilities: d.capabilities || [],
    vision: (d.capabilities || []).includes('vision'),
    tools: (d.capabilities || []).includes('tools'),
    params: det.parameter_size || null,
    quant: det.quantization_level || null,
    family: det.family || null,
    families: det.families || [],
    contextLength: ctxKey ? info[ctxKey] : null,
    license: (d.license || '').split('\n')[0].slice(0, 120) || null,
  };
  showCache.set(name, { at: Date.now(), data });
  return data;
}

app.get('/api/ai/model/:name', async (req, res) => {
  try {
    res.json(await modelInfo(req.params.name));
  } catch (e) {
    res.status(502).json({ error: aiErrorText(e), name: req.params.name, capabilities: [] });
  }
});

/* Welche Modelle sind gerade tatsächlich GELADEN (Ollama /api/ps)?
   Damit zeigt das Studio, was wirklich im Speicher liegt statt nur, was
   konfiguriert ist. */
app.get('/api/ai/running', async (req, res) => {
  try {
    const r = await ollamaFetch('/api/ps', {}, 6000);
    const d = await r.json();
    res.json({
      running: (d.models || []).map((m) => ({
        name: m.name,
        sizeGb: m.size ? +(m.size / 1e9).toFixed(1) : null,
        vramGb: m.size_vram ? +(m.size_vram / 1e9).toFixed(1) : 0,
        onGpu: !!(m.size_vram && m.size && m.size_vram > m.size * 0.5),
        expiresAt: m.expires_at || null,
      })),
    });
  } catch {
    res.json({ running: [], error: 'Ollama nicht erreichbar' });
  }
});

/* Modell herunterladen — streamt Ollamas Fortschritt 1:1 durch (NDJSON) */
app.post('/api/ai/pull', async (req, res) => {
  const name = (req.body && req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Modellname fehlt' });
  let started = false;   // ab hier sind die Header raus — kein res.status() mehr!
  let clientGone = false;
  res.on('close', () => { clientGone = true; });
  try {
    const r = await ollamaFetch('/api/pull', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    }, 3600000);
    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: aiErrorText(t) });
    }
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    started = true;
    const reader = r.body.getReader();
    for (;;) {
      // Ohne diese Prüfung pumpt der Server weiter, wenn der Browser weg ist —
      // der Download lief dann bis zum Ende ins Leere.
      if (clientGone) { try { await reader.cancel(); } catch { /* egal */ } break; }
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) {
        await new Promise((ok) => res.once('drain', ok));
      }
    }
    res.end();
  } catch (e) {
    // Nach begonnenem Stream wirft res.status() ERR_HTTP_HEADERS_SENT — dann
    // den Fehler als letzte NDJSON-Zeile mitgeben, damit ihn das Studio sieht.
    if (started) {
      try { res.write(JSON.stringify({ error: aiErrorText(e) }) + '\n'); } catch { /* egal */ }
      try { res.end(); } catch { /* egal */ }
    } else {
      res.status(502).json({ error: aiErrorText(e) });
    }
  }
});

app.delete('/api/ai/models/:name', async (req, res) => {
  try {
    const r = await ollamaFetch('/api/delete', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: req.params.name }),
    }, 20000);
    res.json({ ok: r.ok });
  } catch {
    res.status(502).json({ error: 'Löschen fehlgeschlagen' });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const s = store.readSettings();
  const messages = (req.body && req.body.messages) || [];
  const format = (req.body && req.body.format) || undefined;   // 'json' = Ollama antwortet als reines JSON

  /* Automatisches Umschalten Vordergrund → Hintergrund:
     Sobald irgendeine Nachricht Bilddaten trägt und ein Vision-Modell
     konfiguriert ist, antwortet dieses statt des Textmodells. */
  const hasImage = messages.some((m) => Array.isArray(m.images) && m.images.length > 0);
  const wantVision = hasImage && s.aiAutoVision !== false && !!s.ollamaVisionModel;
  const model = (req.body && req.body.model) || (wantVision ? s.ollamaVisionModel : s.ollamaModel);

  if (!model) {
    return res.status(400).json({
      error: hasImage
        ? 'Kein Bild-Modell konfiguriert. Im Studio unter KI ein Vision-Modell installieren und als Hintergrund-Modell setzen.'
        : 'Kein Modell konfiguriert (Studio → KI)',
      code: hasImage ? 'no-vision-model' : 'no-model',
    });
  }
  if (hasImage && !wantVision && !(req.body && req.body.model)) {
    // Bild da, aber kein Vision-Modell hinterlegt → das Textmodell würde das
    // Bild stumm ignorieren. Lieber ehrlich sagen als so tun, als ginge es.
    return res.status(400).json({
      error: 'Es wurde ein Bild mitgeschickt, aber es ist kein Bild-Modell hinterlegt. Studio → KI → Hintergrund-Modell setzen.',
      code: 'no-vision-model',
    });
  }

  /* Feineinstellungen kommen jetzt aus den Studio-Einstellungen; was die App
     mitschickt, hat weiterhin Vorrang (Rückwärtskompatibilität). */
  const options = {
    temperature: s.aiTemperature, top_p: s.aiTopP,
    num_ctx: s.aiNumCtx, repeat_penalty: s.aiRepeatPenalty,
    ...((req.body && req.body.options) || {}),
  };
  const timeoutMs = (hasImage ? (s.aiVisionTimeoutSec || 180) : (s.aiTimeoutSec || 60)) * 1000;

  try {
    const r = await ollamaFetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false, options, ...(format ? { format } : {}) }),
    }, timeoutMs);
    if (!r.ok) {
      const err = await r.text();
      return res.status(502).json({ error: aiErrorText(err), code: aiErrorCode(err), raw: err.slice(0, 300), model, usedVision: wantVision });
    }
    const out = await r.json();
    // Die Apps zeigen klein an, WELCHES Modell geantwortet hat (· KI bzw. · KI · Bild).
    res.json({ ...out, vnModel: model, vnVision: wantVision });
  } catch (e) {
    res.status(502).json({ error: aiErrorText(e), code: aiErrorCode(e), model, usedVision: wantVision });
  }
});

// ---------- Selbst-Update ----------
app.get('/api/update/check', (req, res) => {
  const opts = { cwd: REPO_ROOT, timeout: 20000 };
  try {
    execFileSync('git', ['fetch', 'origin'], opts);
    const behind = parseInt(execFileSync('git', ['rev-list', 'HEAD..origin/main', '--count'], opts).toString().trim(), 10) || 0;
    const latestMsg = behind > 0 ? execFileSync('git', ['log', 'origin/main', '-1', '--format=%s'], opts).toString().trim() : '';
    res.json({ ok: true, behind, latestMsg, git: gitInfo() });
  } catch (e) {
    res.json({ ok: false, error: 'Update-Check fehlgeschlagen (kein Netz/Repo?)' });
  }
});

app.post('/api/update/apply', (req, res) => {
  const opts = { cwd: REPO_ROOT, timeout: 60000 };
  try {
    execFileSync('git', ['pull', '--ff-only'], opts);
  } catch {
    return res.status(500).json({ error: 'git pull fehlgeschlagen' });
  }
  if (IN_DOCKER) {
    // Container beendet sich — restart:unless-stopped startet ihn neu,
    // der Entrypoint installiert/baut dann den neuesten Stand.
    res.json({ ok: true, restarting: true, note: 'Studio startet in wenigen Sekunden neu…' });
    setTimeout(() => { proc.stopAll(); process.exit(0); }, 800);
  } else {
    res.json({ ok: true, restarting: false, note: 'Code aktualisiert. Bitte Studio manuell neu starten (lokaler Modus).' });
  }
});

// ---------- QR & Extension-ZIP ----------
app.get('/api/qr', async (req, res) => {
  const text = req.query.text || '';
  if (!text) return res.status(400).end();
  try {
    const buf = await QRCode.toBuffer(String(text), { width: 240, margin: 1, color: { dark: '#0c7d72', light: '#ffffff' } });
    res.type('png').send(buf);
  } catch { res.status(500).end(); }
});

app.get('/api/apps/:id/extension.zip', (req, res) => {
  const a = appById(req.params.id);
  if (!a || a.kind !== 'extension') return res.status(404).end();
  const dir = path.join(appRoot(a), a.extensionDir || '.');
  if (!fs.existsSync(dir)) return res.status(404).send('Extension-Ordner nicht gefunden');
  res.attachment((a.id || 'extension') + '.zip');
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', () => res.status(500).end());
  archive.pipe(res);
  archive.directory(dir, false);
  archive.finalize();
});

process.on('SIGTERM', () => { proc.stopAll(); process.exit(0); });
process.on('SIGINT', () => { proc.stopAll(); process.exit(0); });

app.listen(PORT, () => {
  console.log(`VetNow Studio 2.0 läuft auf http://${hostIp()}:${PORT}  (Repo: ${REPO_ROOT}${IN_DOCKER ? ', Docker' : ''})`);
});
