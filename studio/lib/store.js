/* VetNow Studio — App-Registry (JSON-Datei im DATA_DIR, persistiert Änderungen). */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.STUDIO_DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'apps.json');
const DEFAULT = path.join(__dirname, '..', 'apps.default.json');

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

function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 8); }

module.exports = { read, write, uid, DATA_DIR };
