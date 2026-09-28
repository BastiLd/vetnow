/* Kopiert den gemeinsamen Kern (vetnow-app/shared) in die Teile, die ihn als lokale Dateien brauchen:
   - extension/shared/   (Chrome lädt nur Dateien aus dem Extension-Ordner — „Entpackt laden" ohne Build)
   - mobile/src/shared/  (Metro/Expo bündelt so ohne Sonderkonfiguration, auch in Expo Go)
   Die Web-App und der Hub importieren shared/ direkt.
   Aufruf: npm run sync:shared   ·   Prüfen ohne Schreiben: node tools/sync-shared.mjs --check */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'shared');
const TARGETS = [join(ROOT, 'extension', 'shared'), join(ROOT, 'mobile', 'src', 'shared')];
const HEADER = '// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)\n';
const SKIP = new Set(['test', 'node_modules', 'package.json', 'legacy-bot.js']);
const check = process.argv.includes('--check');

function list(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...list(p, base));
    else if (name.endsWith('.js')) out.push(relative(base, p));
  }
  return out;
}

const files = list(SRC);
let changed = 0;
for (const target of TARGETS) {
  const wanted = new Set(files);
  for (const rel of files) {
    const dest = join(target, rel);
    const content = HEADER + readFileSync(join(SRC, rel), 'utf8');
    const old = existsSync(dest) ? readFileSync(dest, 'utf8') : null;
    if (old !== content) {
      changed++;
      if (check) console.log('veraltet:', relative(ROOT, dest));
      else { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, content); }
    }
  }
  // Dateien, die es in shared/ nicht mehr gibt, entfernen
  if (existsSync(target)) {
    for (const rel of list(target)) {
      if (!wanted.has(rel)) {
        changed++;
        if (check) console.log('überzählig:', relative(ROOT, join(target, rel)));
        else rmSync(join(target, rel));
      }
    }
  }
}
if (check) {
  console.log(changed ? `✘ ${changed} Datei(en) nicht aktuell — bitte „npm run sync:shared" ausführen.` : '✔ Kopien von shared/ sind aktuell.');
  process.exit(changed ? 1 : 0);
}
console.log(`✔ shared/ → ${TARGETS.map((t) => relative(ROOT, t)).join(', ')} (${files.length} Dateien, ${changed} geändert)`);
