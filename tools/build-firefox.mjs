/* Baut die Firefox-Fassung der Extension nach vetnow-app/dist/extension-firefox/.
   Warum eine eigene Fassung: Chrome/Edge verlangen in Manifest V3 einen Service Worker
   (background.service_worker) und melden „background.scripts requires manifest version 2"
   als Fehler. Firefox kennt dagegen nur background.scripts (Event-Page) und braucht eine
   Add-on-ID (browser_specific_settings). Der Code ist identisch — nur das Manifest unterscheidet sich.
   Aufruf: npm run build:firefox  → in Firefox about:debugging → „Temporäres Add-on laden" →
   dist/extension-firefox/manifest.json */
import { cpSync, rmSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'extension');
const OUT = join(ROOT, 'dist', 'extension-firefox');
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(SRC, OUT, { recursive: true, filter: (p) => !/[\/](test|node_modules)([\/]|$)/.test(p) && !p.endsWith('manifest.firefox.json') });
copyFileSync(join(SRC, 'manifest.firefox.json'), join(OUT, 'manifest.json'));
console.log('✔ Firefox-Fassung erstellt: ' + OUT);
