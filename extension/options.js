/* Optionen der Extension: Hub-Adresse, eigene Praxis, Web-App-Adresse.
   Für Adressen außerhalb von localhost fragt die Extension einmalig nach der Berechtigung
   (optional_host_permissions) — sonst blockiert der Browser die Verbindung. */
const api = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);

async function load() {
  const o = await api.storage.local.get(['hubUrl', 'practiceId', 'webUrl']);
  $('hub').value = o.hubUrl || 'http://localhost:8787';
  $('web').value = o.webUrl || '';
  await fillPractices(o.practiceId || 'drautal');
}

async function fillPractices(selected) {
  try {
    const st = await (await fetch($('hub').value.replace(/\/+$/, '') + '/api/v1/state')).json();
    const sel = $('practice');
    sel.replaceChildren(...st.practices.map((p) => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; return o; }));
    sel.value = selected;
  } catch { /* ohne Hub bleibt die Demo-Praxis */ }
}

async function ensurePermission(url) {
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url)) return true;
  const origin = new URL(url).origin + '/*';
  if (await api.permissions.contains({ origins: [origin] })) return true;
  return api.permissions.request({ origins: [origin] });
}

$('test').addEventListener('click', async () => {
  const url = $('hub').value.replace(/\/+$/, '');
  const out = $('result');
  out.textContent = 'Prüfe …';
  try {
    if (!(await ensurePermission(url))) throw new Error('Berechtigung für diese Adresse wurde nicht erteilt.');
    const t0 = performance.now();
    const h = await (await fetch(url + '/api/v1/health')).json();
    out.textContent = `✔ ${h.name} ${h.version} erreichbar (${Math.round(performance.now() - t0)} ms, ${h.clients} Geräte verbunden).`;
    await fillPractices($('practice').value);
  } catch (e) { out.textContent = '✘ Nicht erreichbar: ' + e.message; }
});

$('save').addEventListener('click', async () => {
  const hubUrl = $('hub').value.replace(/\/+$/, '') || 'http://localhost:8787';
  try { await ensurePermission(hubUrl); } catch { /* Speichern trotzdem erlauben */ }
  await api.storage.local.set({ hubUrl, practiceId: $('practice').value, webUrl: $('web').value.trim() });
  $('saved').textContent = ' Gespeichert.';
  api.runtime.sendMessage({ type: 'vn:refresh' }).catch(() => {});
});

load();
