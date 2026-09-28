/* Prüft die Extension ohne Browser: gültiges MV3-Manifest (Chrome/Edge + Firefox-Block),
   alle referenzierten Dateien vorhanden, keine innerHTML-Zuweisungen im Popup (XSS-Schutz). */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension');
const m = JSON.parse(readFileSync(join(EXT, 'manifest.json'), 'utf8'));
const problems = [];
if (m.manifest_version !== 3) problems.push('manifest_version ist nicht 3');
if (!m.browser_specific_settings || !m.browser_specific_settings.gecko || !m.browser_specific_settings.gecko.id) problems.push('Firefox-ID fehlt');
const files = [m.action.default_popup, m.options_ui && m.options_ui.page, m.background.service_worker, ...Object.values(m.icons), 'shared/status.js', 'shared/constants.js'];
for (const f of files) if (f && !existsSync(join(EXT, f))) problems.push('Datei fehlt: ' + f);
for (const f of ['popup.js', 'options.js', 'bg.js']) if (/\.innerHTML\s*=/.test(readFileSync(join(EXT, f), 'utf8'))) problems.push(f + ' benutzt innerHTML');
if (problems.length) { console.log('✘ ' + problems.join('\n✘ ')); process.exit(1); }
console.log('✔ Extension', m.version, '— MV3, Firefox-tauglich, alle Dateien vorhanden, kein innerHTML');
