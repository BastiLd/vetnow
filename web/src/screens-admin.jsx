/* VetNow — Admin-Bereich: Login + Schalter "Testdaten ausblenden".
   Der Schalter wirkt nur lokal (localStorage) — nur in diesem Browser. */
import React from 'react';
import { VNIcon, Switch, toast } from './components.jsx';
import { checkAdminLogin } from './lib/admin.js';
import { useAdmin } from './lib/adminContext.jsx';
import { PRACTICES, CONVERSATIONS, OWNER_CONVERSATIONS } from './data.js';

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

  const testCount = PRACTICES.filter((p) => p.isTestData).length;
  const chatCount = CONVERSATIONS.filter((c) => c.isTestData).length + OWNER_CONVERSATIONS.filter((c) => c.isTestData).length;

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
