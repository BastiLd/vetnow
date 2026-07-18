/* VetNow — Admin-Bereich: Login + Schalter "Testdaten ausblenden".
   Der Schalter wirkt nur lokal (localStorage) — nur in diesem Browser. */
import React from 'react';
import { VNIcon, Switch, toast } from './components.jsx';
import { checkAdminLogin } from './lib/admin.js';
import { useAdmin } from './lib/adminContext.jsx';
import { useChats } from './lib/chats.jsx';
import { aiStatus, aiModels } from './lib/ai.js';
import { PRACTICES, CHATS_SEED } from './data.js';

/* ---- KI-Antworten (Ollama über VetNow Studio) ---- */
function AiSection({ settings, setSetting }) {
  const [status, setStatus] = React.useState(null);   // null=unbekannt
  const [models, setModels] = React.useState([]);
  const [checking, setChecking] = React.useState(false);

  const check = async () => {
    setChecking(true);
    const s = await aiStatus(settings.aiBaseUrl);
    setStatus(s);
    if (s && s.ok) setModels(await aiModels(settings.aiBaseUrl));
    setChecking(false);
    toast(s && s.ok ? 'KI verbunden: ' + (s.ollama || 'Ollama') : 'Keine KI erreichbar — läuft die App über das Studio?', s && s.ok ? 'success' : 'error');
  };

  return (
    <div>
      <div className="section-label" style={{ marginBottom: 10 }}>KI-Antworten (Ollama über VetNow Studio)</div>
      <div className="stack-3">
        <button className="switch-row" style={{ width: '100%', textAlign: 'left' }}
          onClick={() => { const ai = settings.botMode !== 'ai'; setSetting('botMode', ai ? 'ai' : 'smart'); toast(ai ? 'Bot nutzt jetzt die KI (Ollama).' : 'Bot nutzt den eingebauten Modus.', 'success'); }}>
          <div style={{ flex: 1 }}>
            <div className="section-label">Echte KI-Antworten verwenden</div>
            <div className="vn-meta" style={{ marginTop: 3 }}>
              Antworten kommen von einem lokalen Ollama-Modell (über das Studio auf deinem Server).
              Nicht erreichbar (z.&nbsp;B. auf GitHub Pages)? Dann übernimmt automatisch der eingebaute Bot.
            </div>
          </div>
          <Switch on={settings.botMode === 'ai'} />
        </button>

        {settings.botMode === 'ai' && (
          <div className="card card-pad stack-3">
            <div className="field">
              <label>KI-Adresse (leer = automatisch übers Studio)</label>
              <input className="input" value={settings.aiBaseUrl} onChange={(e) => setSetting('aiBaseUrl', e.target.value)} placeholder="/api/ai oder http://192.168.68.10:3000/api/ai" />
            </div>
            <div className="field">
              <label>Modell {models.length > 0 ? '(installiert auf deinem Server)' : ''}</label>
              {models.length > 0 ? (
                <select className="selectbox" value={settings.aiModel} onChange={(e) => setSetting('aiModel', e.target.value)}>
                  <option value="">Standard des Studios</option>
                  {models.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              ) : (
                <input className="input" value={settings.aiModel} onChange={(e) => setSetting('aiModel', e.target.value)} placeholder="z. B. qwen2.5:7b (leer = Studio-Standard)" />
              )}
            </div>
            <button className="btn btn-secondary btn-block" onClick={check} disabled={checking}>
              {checking ? 'Prüfe…' : 'Verbindung testen'}
            </button>
            {status && (
              <div className={'notice ' + (status.ok ? 'notice-info' : 'notice-warn')}>
                <span className="ni"><VNIcon.info s={16} /></span>
                <div>{status.ok
                  ? `Verbunden — ${models.length} Modell(e) verfügbar. Modelle verwaltest du im Studio unter „KI".`
                  : 'Keine Verbindung. Die KI funktioniert nur, wenn die App über das VetNow Studio läuft (http://SERVER:3000/…) und Ollama auf dem Server installiert ist.'}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminLogin({ onSuccess }) {
  const [user, setUser] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [err, setErr] = React.useState('');
  const submit = (ev) => {
    ev.preventDefault();
    if (checkAdminLogin(user.trim(), pw)) {
      setErr('');
      onSuccess();
      toast('Als Admin angemeldet.', 'success');
    } else {
      setErr('Benutzername oder Passwort falsch.');
      toast('Login fehlgeschlagen.', 'error');
    }
  };
  return (
    <form className="card card-pad stack-4" onSubmit={submit}>
      <div className="row gap-2">
        <span className="trust-ic"><VNIcon.lock s={20} /></span>
        <div>
          <h2 className="vn-h2">Admin-Login</h2>
          <p className="vn-meta" style={{ marginTop: 4 }}>Nur für Betreiber:innen der Plattform.</p>
        </div>
      </div>
      <div className="field">
        <label>Benutzername</label>
        <input className={'input' + (err ? ' has-error' : '')} value={user} onChange={(e) => setUser(e.target.value)} placeholder="admin" autoComplete="username" />
      </div>
      <div className="field">
        <label>Passwort</label>
        <input className={'input' + (err ? ' has-error' : '')} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
      </div>
      {err && <span className="field-error"><VNIcon.alert s={13} /> {err}</span>}
      <button className="btn btn-primary btn-lg btn-block" type="submit">Anmelden</button>
    </form>
  );
}

export function ScreenAdmin({ nav }) {
  const { hideTestData, setHideTestData, adminLoggedIn, setAdminLoggedIn } = useAdmin();
  const { settings, setSetting } = useChats();

  const testCount = PRACTICES.filter((p) => p.isTestData).length;
  const chatCount = CHATS_SEED.filter((c) => c.isTestData).length;

  if (!adminLoggedIn) {
    return (
      <div className="vn-page">
        <div className="vn-page-wide d-narrow">
          <AdminLogin onSuccess={() => setAdminLoggedIn(true)} />
        </div>
      </div>
    );
  }

  return (
    <div className="vn-page">
      <div className="vn-page-wide d-narrow stack-4">
        <div>
          <h2 className="vn-h2">Admin-Bereich</h2>
          <p className="vn-text" style={{ marginTop: 6 }}>Einstellungen für diese Installation.</p>
        </div>

        <button className="switch-row" style={{ width: '100%', textAlign: 'left' }}
          onClick={() => { const on = !hideTestData; setHideTestData(on); toast(on ? 'Testdaten werden ausgeblendet.' : 'Testdaten werden wieder angezeigt.', 'success'); }}>
          <div style={{ flex: 1 }}>
            <div className="section-label">Testdaten ausblenden</div>
            <div className="vn-meta" style={{ marginTop: 3 }}>
              Blendet alle Demo-Einträge aus ({testCount} Praxen, {chatCount} Konversationen samt Demo-Terminen).
            </div>
          </div>
          <Switch on={hideTestData} />
        </button>

        <div className="notice notice-info">
          <span className="ni"><VNIcon.info s={16} /></span>
          <div>
            Dieser Schalter wirkt <strong>nur in diesem Browser</strong> (gespeichert in localStorage).
            Andere Besucher sehen weiterhin die Testdaten. Ein globaler Schalter für alle Besucher
            würde ein Backend (z.&nbsp;B. Supabase, kostenloser Tarif, eigenes Konto nötig) erfordern —
            bewusst nicht eingebaut.
          </div>
        </div>

        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>Auto-Antwort-Bot (Demo)</div>
          <div className="stack-3">
            <button className="switch-row" style={{ width: '100%', textAlign: 'left' }}
              onClick={() => { const on = !settings.botEnabled; setSetting('botEnabled', on); toast(on ? 'Bot aktiviert.' : 'Bot deaktiviert.', 'success'); }}>
              <div style={{ flex: 1 }}>
                <div className="section-label">Automatische Antworten</div>
                <div className="vn-meta" style={{ marginTop: 3 }}>Wenn du schreibst, antwortet die Gegenseite automatisch (mit Tipp-Animation).</div>
              </div>
              <Switch on={settings.botEnabled} />
            </button>
            <button className="switch-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setSetting('botTyping', !settings.botTyping)}>
              <div style={{ flex: 1 }}><div className="section-label">Tipp-Animation (3 Punkte)</div><div className="vn-meta" style={{ marginTop: 3 }}>Zeigt „…", während die Gegenseite tippt.</div></div>
              <Switch on={settings.botTyping} />
            </button>
            <button className="switch-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setSetting('botGreeting', !settings.botGreeting)}>
              <div style={{ flex: 1 }}><div className="section-label">Begrüßung beim ersten Öffnen</div><div className="vn-meta" style={{ marginTop: 3 }}>Leerer Chat wird automatisch begrüßt.</div></div>
              <Switch on={settings.botGreeting} />
            </button>
            <button className="switch-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setSetting('agentEnabled', !settings.agentEnabled)}>
              <div style={{ flex: 1 }}><div className="section-label">KI-Agent-Panel</div><div className="vn-meta" style={{ marginTop: 3 }}>Schwebender 🤖-Button: Agent führt Aufgaben sichtbar in der App aus (z. B. „Tag simulieren").</div></div>
              <Switch on={settings.agentEnabled} />
            </button>
          </div>
        </div>

        <AiSection settings={settings} setSetting={setSetting} />

        <div className="notice notice-warn">
          <span className="ni"><VNIcon.alert s={16} /></span>
          <div>Zugangsdaten sind im Code hinterlegt (<code>src/lib/admin.js</code>) — nach dem Testen ändern!</div>
        </div>

        <div className="btn-row">
          <button className="btn btn-secondary" onClick={() => { setAdminLoggedIn(false); toast('Abgemeldet.', 'info'); }}>
            <VNIcon.logout s={16} /> Abmelden
          </button>
          <button className="btn btn-primary" onClick={() => nav('home')}>Zur Startseite</button>
        </div>
      </div>
    </div>
  );
}
