/* Alle Tests auf einmal: node tools/test-all.mjs [--mobile]
   Prüft Kern + Bot 3.0, Hub, Aktualität der shared-Kopien, Web-Build + SSR-Smoke-Test,
   Extension-Manifest und (mit --mobile) den Handy-Build für iOS und Android. */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = process.argv.includes('--mobile');
const steps = [
  ['Kern + Bot 3.0 (shared)', 'node', ['--test'], 'shared'],
  ['VetNow Hub', 'node', ['--test'], 'hub'],
  ['shared-Kopien aktuell', 'node', ['tools/sync-shared.mjs', '--check'], '.'],
  ['Web-App Build', 'npm', ['run', 'build'], 'web'],
  ['Web-App SSR-Smoke-Build', 'npx', ['vite', 'build', '--ssr', 'scripts/smoke-ssr.jsx', '--outDir', 'dist-ssr'], 'web'],
  ['Web-App SSR-Smoke-Test', 'node', ['dist-ssr/smoke-ssr.js'], 'web'],
  ['Extension (Manifest, Dateien, XSS)', 'node', ['tools/check-extension.mjs'], '.'],
];
if (mobile) {
  steps.push(['Handy: expo-doctor', 'npx', ['expo-doctor'], 'mobile']);
  steps.push(['Handy: Build Android', 'npx', ['expo', 'export', '--platform', 'android', '--output-dir', join(tmpdir(), 'vn-export-android')], 'mobile']);
  steps.push(['Handy: Build iOS', 'npx', ['expo', 'export', '--platform', 'ios', '--output-dir', join(tmpdir(), 'vn-export-ios')], 'mobile']);
}
const results = [];
for (const [name, cmd, args, cwd] of steps) {
  const t0 = Date.now();
  process.stdout.write(`▶ ${name} … `);
  const r = spawnSync(cmd, args, { cwd: join(ROOT, cwd), shell: process.platform === 'win32', encoding: 'utf8', env: { ...process.env, CI: '1' } });
  const ok = r.status === 0;
  const out = (r.stdout || '') + (r.stderr || '');
  const tests = out.match(/ℹ pass (\d+)[\s\S]*?ℹ fail (\d+)/);
  const info = tests ? `${tests[1]} bestanden, ${tests[2]} fehlgeschlagen` : ok ? '' : out.trim().split('\n').slice(-6).join('\n    ');
  results.push({ name, ok, ms: Date.now() - t0, info });
  console.log(ok ? '✔' : '✘', info ? '(' + info.split('\n')[0] + ')' : '');
  if (!ok) console.log('    ' + info);
}
console.log('\n  Ergebnis:');
for (const r of results) console.log(`  ${r.ok ? '✔' : '✘'} ${r.name.padEnd(28)} ${(r.ms / 1000).toFixed(1)} s`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n  ✘ ${failed} Schritt(e) fehlgeschlagen.\n` : `\n  ✔ Alles grün (${results.length} Schritte).\n`);
process.exit(failed ? 1 : 0);
