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
app.use(express.json({ limit: '2mb' }));

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

/* Externes Repo einer App klonen/aktualisieren (für "Duolingo für Recht" & Co.) */
function ensureExtRepoCmd(a) {
  if (!a.repoUrl) return '';
  const dir = extRepoDir(a).replace(/\\/g, '/');
  return `if [ ! -d "${dir}/.git" ]; then git clone "${a.repoUrl}" "${dir}"; else git -C "${dir}" pull --ff-only || true; fi && `;
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
  const allowed = ['name', 'group', 'color', 'icon', 'webDir', 'distDir', 'basePath', 'buildCmd', 'expoDir', 'expoSdk', 'expoPort', 'extensionDir', 'repoUrl', 'env'];
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
app.post('/api/apps/:id/action', (req, res) => {
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
    const cwd = a.repoUrl ? extRepoDir(a) : REPO_ROOT;
    return res.json(proc.runOnce(a.id, { task: 'Aktualisieren', shellCmd: 'git pull --ff-only', cwd }));
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
    // Fehlen die node_modules (z. B. neue App nach Repo-Update), erst installieren
    if (!fs.existsSync(path.join(cwd, 'node_modules'))) {
      const sh = process.platform === 'win32' ? 'cmd' : 'bash';
      const flag = process.platform === 'win32' ? '/c' : '-c';
      return res.json(proc.startLongRunning(a.id, {
        cmd: sh, args: [flag, `npm install --no-audit --no-fund && npx expo start --port ${port}`],
        cwd, kind: 'expo', port, env: envx,
      }));
    }
    return res.json(proc.startLongRunning(a.id, {
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
  try {
    const r = await ollamaFetch('/api/version', {}, 4000);
    const v = await r.json();
    res.json({ ok: true, ollama: 'Ollama ' + (v.version || ''), url: ollamaUrl(), defaultModel: store.readSettings().ollamaModel });
  } catch {
    res.json({ ok: false, url: ollamaUrl(), hint: 'Ollama nicht erreichbar — läuft es auf dem Server? (Standard-Port 11434)' });
  }
});

app.get('/api/ai/models', async (req, res) => {
  try {
    const r = await ollamaFetch('/api/tags', {}, 8000);
    const d = await r.json();
    const models = (d.models || []).map((m) => ({
      name: m.name, sizeGb: m.size ? +(m.size / 1e9).toFixed(1) : null,
      family: m.details && m.details.family, params: m.details && m.details.parameter_size,
    }));
    res.json({ models, defaultModel: store.readSettings().ollamaModel });
  } catch {
    res.status(502).json({ error: 'Ollama nicht erreichbar', models: [] });
  }
});

/* Modell herunterladen — streamt Ollamas Fortschritt 1:1 durch (NDJSON) */
app.post('/api/ai/pull', async (req, res) => {
  const name = (req.body && req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Modellname fehlt' });
  try {
    const r = await ollamaFetch('/api/pull', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    }, 3600000);
    res.setHeader('Content-Type', 'application/x-ndjson');
    const reader = r.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch {
    res.status(502).json({ error: 'Download fehlgeschlagen — ist Ollama erreichbar?' });
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
  const model = (req.body && req.body.model) || s.ollamaModel;
  const messages = (req.body && req.body.messages) || [];
  const options = (req.body && req.body.options) || undefined; // z. B. temperature/num_ctx aus der App
  const format = (req.body && req.body.format) || undefined;   // 'json' = Ollama antwortet als reines JSON
  if (!model) return res.status(400).json({ error: 'Kein Modell konfiguriert (Studio → KI)' });
  try {
    const r = await ollamaFetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false, ...(options ? { options } : {}), ...(format ? { format } : {}) }),
    }, (s.aiTimeoutSec || 60) * 1000);
    if (!r.ok) {
      const err = await r.text();
      return res.status(502).json({ error: 'Ollama-Fehler: ' + err.slice(0, 300) });
    }
    res.json(await r.json());
  } catch {
    res.status(502).json({ error: 'KI-Antwort fehlgeschlagen (Timeout oder Ollama offline)' });
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
