/* VetNow Studio — Backend.
   Verwaltet App-Registry, baut die Web-App, serviert die Web-Vorschau,
   startet/stoppt den Expo-Server, wechselt die Expo-Version, erzeugt QR-Codes
   und packt die Chrome-Extension als ZIP. Ein Container, eine Oberfläche. */
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const archiver = require('archiver');
const store = require('./lib/store');
const proc = require('./lib/proc');

const REPO_ROOT = process.env.REPO_ROOT || path.resolve(__dirname, '..');
const PORT = parseInt(process.env.STUDIO_PORT || '3000', 10);

function hostIp() {
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

const app = express();
app.use(express.json());

// ---------- Web-Vorschau: statisch aus dem dist-Ordner je App (basePath) ----------
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/' || req.path.startsWith('/assets/studio')) return next();
  const reg = store.read();
  const webApps = (reg.apps || []).filter((a) => a.kind === 'web' && a.basePath);
  for (const a of webApps) {
    let bp = a.basePath.endsWith('/') ? a.basePath : a.basePath + '/';
    if (bp === '/') continue; // '/' würde das Dashboard verdecken
    if (req.path === bp.slice(0, -1) || req.path.startsWith(bp)) {
      const distAbs = path.join(REPO_ROOT, a.webDir, a.distDir || 'dist');
      let rel = req.path.slice(bp.length);
      if (!rel || rel === '/') rel = 'index.html';
      const filePath = path.normalize(path.join(distAbs, rel));
      if (!filePath.startsWith(distAbs)) return res.status(403).end();
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return res.sendFile(filePath);
      const idx = path.join(distAbs, 'index.html');
      if (fs.existsSync(idx)) return res.sendFile(idx);
      return res.status(404).send('Diese App wurde noch nicht gebaut. Im Studio auf „Bauen / Aktualisieren“ klicken.');
    }
  }
  next();
});

// ---------- Dashboard (statisch) ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------
function appById(id) { return (store.read().apps || []).find((a) => a.id === id); }
function distExists(a) {
  if (a.kind !== 'web') return false;
  return fs.existsSync(path.join(REPO_ROOT, a.webDir, a.distDir || 'dist', 'index.html'));
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
  return out;
}

// ---------- API ----------
app.get('/api/status', (req, res) => {
  res.json({ hostIp: hostIp(), repoRoot: REPO_ROOT, port: PORT, node: process.version, platform: process.platform });
});

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
  };
  if (napp.kind === 'web') { napp.webDir = b.webDir || 'web'; napp.distDir = b.distDir || 'dist'; napp.basePath = b.basePath || '/' + napp.id + '/'; napp.buildCmd = b.buildCmd || 'npm ci && npm run build'; }
  if (napp.kind === 'expo') { napp.expoDir = b.expoDir || 'mobile'; napp.expoSdk = b.expoSdk || '54'; napp.expoPort = b.expoPort || 8081; }
  if (napp.kind === 'extension') { napp.extensionDir = b.extensionDir || 'extension'; }
  reg.apps.push(napp);
  store.write(reg);
  res.json(enrich(napp, hostIp()));
});

app.put('/api/apps/:id', (req, res) => {
  const reg = store.read();
  const idx = reg.apps.findIndex((a) => a.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'App nicht gefunden' });
  const allowed = ['name', 'group', 'color', 'icon', 'webDir', 'distDir', 'basePath', 'buildCmd', 'expoDir', 'expoSdk', 'expoPort', 'extensionDir'];
  allowed.forEach((k) => { if (req.body[k] !== undefined) reg.apps[idx][k] = req.body[k]; });
  store.write(reg);
  res.json(enrich(reg.apps[idx], hostIp()));
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

app.post('/api/apps/:id/action', (req, res) => {
  const a = appById(req.params.id);
  if (!a) return res.status(404).json({ error: 'App nicht gefunden' });
  const action = req.body.action;
  const ip = hostIp();

  if (action === 'build' && a.kind === 'web') {
    const cwd = path.join(REPO_ROOT, a.webDir);
    return res.json(proc.runOnce(a.id, { task: 'Bauen', shellCmd: a.buildCmd || 'npm ci && npm run build', cwd }));
  }
  if (action === 'pull') {
    return res.json(proc.runOnce(a.id, { task: 'Aktualisieren', shellCmd: 'git pull --ff-only', cwd: REPO_ROOT }));
  }
  if (action === 'start' && a.kind === 'expo') {
    const cwd = path.join(REPO_ROOT, a.expoDir);
    return res.json(proc.startLongRunning(a.id, {
      cmd: 'npx', args: ['expo', 'start', '--port', String(a.expoPort || 8081)], cwd, kind: 'expo', port: a.expoPort || 8081,
      env: { REACT_NATIVE_PACKAGER_HOSTNAME: ip, CI: '1', EXPO_NO_TELEMETRY: '1' },
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
    const cwd = path.join(REPO_ROOT, a.expoDir);
    return res.json(proc.runOnce(a.id, { task: 'Expo-SDK ' + sdk, shellCmd: `npm install expo@~${sdk}.0.0 && npx expo install --fix`, cwd }));
  }
  return res.status(400).json({ error: 'Unbekannte Aktion für diese App' });
});

// QR-Code als PNG
app.get('/api/qr', async (req, res) => {
  const text = req.query.text || '';
  if (!text) return res.status(400).end();
  try {
    const buf = await QRCode.toBuffer(String(text), { width: 240, margin: 1, color: { dark: '#0c7d72', light: '#ffffff' } });
    res.type('png').send(buf);
  } catch (e) { res.status(500).end(); }
});

// Extension als ZIP
app.get('/api/apps/:id/extension.zip', (req, res) => {
  const a = appById(req.params.id);
  if (!a || a.kind !== 'extension') return res.status(404).end();
  const dir = path.join(REPO_ROOT, a.extensionDir);
  if (!fs.existsSync(dir)) return res.status(404).send('Extension-Ordner nicht gefunden');
  res.attachment('vetnow-extension.zip');
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', () => res.status(500).end());
  archive.pipe(res);
  archive.directory(dir, false);
  archive.finalize();
});

process.on('SIGTERM', () => { proc.stopAll(); process.exit(0); });
process.on('SIGINT', () => { proc.stopAll(); process.exit(0); });

app.listen(PORT, () => {
  console.log(`VetNow Studio läuft auf http://${hostIp()}:${PORT}  (Repo: ${REPO_ROOT})`);
});
