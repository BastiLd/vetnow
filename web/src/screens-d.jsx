/* VetNow — Screens D: Auth (Landing, Login, Registrierung) */
import React from 'react';
import { VNIcon, Tooltip, toast } from './components.jsx';
import { ANIMALS, DISTRICTS, SERVICE_LABEL, SPECIALTIES } from './data.js';

export function AuthShell({ children, nav, back }) {
  return (
    <div className="auth-wrap">
      <div className="auth-hero" style={{ position: 'relative' }}>
        {nav && back && (
          <button onClick={() => nav(back)} aria-label="Zurück"
            style={{ position: 'absolute', left: 16, top: 'calc(var(--safe-top, 0px) + 14px)', width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.12)', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <VNIcon.back s={20} />
          </button>
        )}
        <div className="vn-brand" style={{ justifyContent: 'center' }}>
          <span className="vn-brand-mark"><VNIcon.paw2 s={20} /></span>
          <span className="vn-brand-name">VetNow <span className="reg">Kärnten</span></span>
        </div>
      </div>
      <div className="auth-card-area">
        <div className="vn-page-wide d-narrow">{children}</div>
      </div>
    </div>
  );
}

/* ---- Landing: Rolle wählen ---- */
export function ScreenAuth({ nav }) {
  return (
    <AuthShell nav={nav} back="home">
      <div className="stack-4">
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <h2 className="vn-h2">Willkommen</h2>
          <p className="vn-text" style={{ marginTop: 6 }}>Wie möchten Sie VetNow nutzen?</p>
        </div>
        <button className="role-card" onClick={() => nav('register-owner')}>
          <span className="rc-icon owner"><VNIcon.user s={26} /></span>
          <span style={{ flex: 1 }}>
            <span className="rc-title">Ich bin Tierhalter:in</span>
            <span className="rc-sub" style={{ display: 'block' }}>Praxis finden, anfragen, Nachrichten verwalten</span>
          </span>
          <span className="rc-arrow"><VNIcon.chevron s={20} /></span>
        </button>
        <button className="role-card" onClick={() => nav('register-clinic')}>
          <span className="rc-icon clinic"><VNIcon.building s={26} /></span>
          <span style={{ flex: 1 }}>
            <span className="rc-title">Ich bin eine Praxis</span>
            <span className="rc-sub" style={{ display: 'block' }}>Status pflegen, Termine & Nachrichten verwalten</span>
          </span>
          <span className="rc-arrow"><VNIcon.chevron s={20} /></span>
        </button>
        <div className="auth-switch">Schon registriert? <a onClick={() => nav('login')}>Jetzt anmelden</a></div>
      </div>
    </AuthShell>
  );
}

/* ---- helper: validated input ---- */
export function VField({ label, req, error, children }) {
  return (
    <div className="field">
      <label>{label}{req && <span className="req"> *</span>}</label>
      {children}
      {error && <span className="field-error"><VNIcon.alert s={13} /> {error}</span>}
    </div>
  );
}
export const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* ---- Login ---- */
export function ScreenLogin({ nav, setAuth }) {
  const [role, setRole] = React.useState('owner');
  const [f, setF] = React.useState({ id: '', pw: '' });
  const [err, setErr] = React.useState({});
  const submit = () => {
    const e = {};
    if (!f.id) e.id = 'Bitte E-Mail oder Telefonnummer eingeben.';
    if (!f.pw) e.pw = 'Bitte Passwort eingeben.';
    setErr(e);
    if (Object.keys(e).length === 0) {
      setAuth && setAuth({ role, name: role === 'clinic' ? 'Tierarztpraxis Drautal' : 'Mein Konto' });
      toast('Erfolgreich angemeldet.', 'success');
      nav(role === 'clinic' ? 'dashboard' : 'home');
    } else {
      toast('Bitte E-Mail und Passwort prüfen.', 'error');
    }
  };
  return (
    <AuthShell nav={nav} back="home">
      <div className="auth-panel">
        <div className="auth-logo-row">
          <span className="vn-brand-mark" style={{ width: 48, height: 48 }}><VNIcon.paw2 s={26} /></span>
        </div>
        <h2 className="vn-h2" style={{ textAlign: 'center' }}>Anmelden</h2>
        <p className="vn-text" style={{ textAlign: 'center', marginTop: 6, marginBottom: 20 }}>Schön, Sie wiederzusehen.</p>

        <div className="seg" style={{ display: 'flex', width: '100%', marginBottom: 20, background: 'var(--surface-3)', borderRadius: 'var(--r-pill)', padding: 4 }}>
          <button onClick={() => setRole('owner')} className={role === 'owner' ? 'is-on' : ''} style={segBtn(role === 'owner')}>Tierhalter:in</button>
          <button onClick={() => setRole('clinic')} className={role === 'clinic' ? 'is-on' : ''} style={segBtn(role === 'clinic')}>Praxis</button>
        </div>

        <div className="stack-4">
          <VField label="E-Mail oder Telefonnummer" req error={err.id}>
            <input className={'input' + (err.id ? ' has-error' : '')} value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} placeholder="name@beispiel.at" />
          </VField>
          <VField label="Passwort" req error={err.pw}>
            <input className={'input' + (err.pw ? ' has-error' : '')} type="password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} placeholder="••••••••" />
          </VField>
          <div style={{ textAlign: 'right', marginTop: -4 }}><a className="link" onClick={() => toast('Link zum Zurücksetzen wurde versendet.', 'success')}>Passwort vergessen?</a></div>
          <button className="btn btn-primary btn-lg btn-block" onClick={submit}>Anmelden</button>
        </div>
        <div className="auth-switch">Noch kein Konto? <a onClick={() => nav('auth')}>Registrieren</a></div>
      </div>
    </AuthShell>
  );
}
function segBtn(on) {
  return { flex: 1, border: 0, background: on ? '#fff' : 'transparent', color: on ? 'var(--teal-700)' : 'var(--ink-2)', padding: '10px', borderRadius: 'var(--r-pill)', fontWeight: 650, fontSize: 14, boxShadow: on ? 'var(--sh-1)' : 'none' };
}

/* ---- Tierhalter Registrierung (1 Seite, 5 Felder) ---- */
export function ScreenRegisterOwner({ nav, setAuth }) {
  const [done, setDone] = React.useState(false);
  const [f, setF] = React.useState({ name: '', phone: '', email: '', pw: '', animals: [] });
  const [err, setErr] = React.useState({});
  const clearErr = (k) => setErr((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; });
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); clearErr(k); };
  const toggleA = (k) => { const s = new Set(f.animals); s.has(k) ? s.delete(k) : s.add(k); set('animals', [...s]); };
  const submit = () => {
    const e = {};
    if (!f.name) e.name = 'Bitte Namen eingeben.';
    if (!f.phone) e.phone = 'Bitte Telefonnummer eingeben.';
    if (!f.email) e.email = 'Bitte E-Mail eingeben.'; else if (!emailOk(f.email)) e.email = 'Bitte gültige E-Mail eingeben.';
    if (!f.pw) e.pw = 'Bitte Passwort wählen.'; else if (f.pw.length < 6) e.pw = 'Mindestens 6 Zeichen.';
    setErr(e);
    if (Object.keys(e).length === 0) {
      setAuth && setAuth({ role: 'owner', name: f.name });
      toast('Konto erstellt — willkommen!', 'success');
      setDone(true);
    } else {
      toast('Bitte prüfen Sie die markierten Felder.', 'error');
    }
  };
  if (done) return <AuthSuccess nav={nav} title="Konto erstellt" text="Ihr Tierhalter-Konto ist startklar. Sie können jetzt Praxen finden und anfragen." cta="Praxis suchen" go="search" />;

  return (
    <AuthShell nav={nav} back="auth">
      <div className="stack-5">
        <div>
          <div className="vn-eyebrow">Registrierung · Tierhalter:in</div>
          <h2 className="vn-h2" style={{ marginTop: 6 }}>Konto erstellen</h2>
        </div>
        <div className="stack-4">
          <VField label="Name" req error={err.name}>
            <input className={'input' + (err.name ? ' has-error' : '')} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Vor- und Nachname" />
          </VField>
          <VField label="Telefonnummer" req error={err.phone}>
            <input className={'input' + (err.phone ? ' has-error' : '')} type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+43 …" />
          </VField>
          <VField label="E-Mail" req error={err.email}>
            <input className={'input' + (err.email ? ' has-error' : '')} value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="name@beispiel.at" />
          </VField>
          <VField label="Passwort" req error={err.pw}>
            <input className={'input' + (err.pw ? ' has-error' : '')} type="password" value={f.pw} onChange={(e) => set('pw', e.target.value)} placeholder="Mindestens 6 Zeichen" />
          </VField>
          <VField label="Tierarten">
            <div className="check-grid">
              {ANIMALS.map((a) => (
                <button key={a.key} className={'check-tile' + (f.animals.includes(a.key) ? ' is-on' : '')} onClick={() => toggleA(a.key)}>
                  <span className="box"><VNIcon.check s={13} /></span>{a.label}
                </button>
              ))}
            </div>
          </VField>
          <button className="btn btn-primary btn-lg btn-block" onClick={submit}>Weiter</button>
        </div>
        <div className="auth-switch">Schon registriert? <a onClick={() => nav('login')}>Anmelden</a></div>
      </div>
    </AuthShell>
  );
}

/* ---- Praxis Registrierung (2 Schritte) ---- */
export function ScreenRegisterClinic({ nav, setAuth }) {
  const [step, setStep] = React.useState(1);
  const [done, setDone] = React.useState(false);
  const [f, setF] = React.useState({ name: '', address: '', district: '', hours: '', phone: '', email: '', pw: '', services: [], specialties: [], specialtiesOther: '' });
  const [err, setErr] = React.useState({});
  const clearErr = (k) => setErr((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; });
  const toggleSpec = (k) => { const s = new Set(f.specialties); s.has(k) ? s.delete(k) : s.add(k); setF((x) => ({ ...x, specialties: [...s] })); };
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); clearErr(k); };
  const toggleS = (k) => { const s = new Set(f.services); s.has(k) ? s.delete(k) : s.add(k); set('services', [...s]); };

  const next = () => {
    const e = {};
    if (!f.name) e.name = 'Bitte Praxisname eingeben.';
    if (!f.address) e.address = 'Bitte Adresse eingeben.';
    if (!f.district) e.district = 'Bitte Bezirk wählen.';
    if (!f.hours) e.hours = 'Bitte Öffnungszeiten angeben.';
    if (!f.phone) e.phone = 'Bitte Telefonnummer eingeben.';
    setErr(e);
    if (Object.keys(e).length === 0) setStep(2);
    else toast('Bitte prüfen Sie die markierten Felder.', 'error');
  };
  const submit = () => {
    const e = {};
    if (!f.email) e.email = 'Bitte E-Mail eingeben.'; else if (!emailOk(f.email)) e.email = 'Bitte gültige E-Mail eingeben.';
    if (!f.pw) e.pw = 'Bitte Passwort wählen.'; else if (f.pw.length < 6) e.pw = 'Mindestens 6 Zeichen.';
    if (!f.services.length) e.services = 'Bitte mindestens eine Leistung auswählen.';
    setErr(e);
    if (Object.keys(e).length === 0) {
      setAuth && setAuth({ role: 'clinic', name: f.name });
      toast('Praxis registriert — willkommen!', 'success');
      setDone(true);
    } else {
      toast('Bitte prüfen Sie die markierten Felder.', 'error');
    }
  };
  if (done) return <AuthSuccess nav={nav} title="Praxis registriert" text="Ihre Praxis ist angelegt. Pflegen Sie jetzt Ihren Status, damit Tierhalter:innen Sie aktuell erreichen." cta="Zum Dashboard" go="dashboard" />;

  return (
    <AuthShell nav={nav} back="auth">
      <div className="stack-5">
        <div>
          <div className="vn-eyebrow">Registrierung · Praxis</div>
          <h2 className="vn-h2" style={{ marginTop: 6 }}>{step === 1 ? 'Praxisdaten' : 'Zugang & Leistungen'}</h2>
          <div className="row gap-2" style={{ marginTop: 10 }}>
            <span style={{ width: 28, height: 6, borderRadius: 3, background: 'var(--teal-600)' }}></span>
            <span style={{ width: 28, height: 6, borderRadius: 3, background: step === 2 ? 'var(--teal-600)' : 'var(--surface-3)' }}></span>
            <span className="vn-meta" style={{ marginLeft: 6 }}>Schritt {step} von 2</span>
          </div>
        </div>

        {step === 1 ? (
          <div className="stack-4">
            <VField label="Praxisname" req error={err.name}>
              <input className={'input' + (err.name ? ' has-error' : '')} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="z. B. Tierarztpraxis Drautal" />
            </VField>
            <VField label="Adresse" req error={err.address}>
              <input className={'input' + (err.address ? ' has-error' : '')} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Straße, PLZ Ort" />
            </VField>
            <VField label="Bezirk" req error={err.district}>
              <select className={'selectbox' + (err.district ? ' has-error' : '')} value={f.district} onChange={(e) => set('district', e.target.value)}>
                <option value="">Bitte wählen</option>
                {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </VField>
            <VField label="Öffnungszeiten" req error={err.hours}>
              <input className={'input' + (err.hours ? ' has-error' : '')} value={f.hours} onChange={(e) => set('hours', e.target.value)} placeholder="z. B. Mo–Fr 8–18, Sa 9–12" />
            </VField>
            <VField label="Telefonnummer" req error={err.phone}>
              <input className={'input' + (err.phone ? ' has-error' : '')} type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+43 …" />
            </VField>
            <button className="btn btn-primary btn-lg btn-block" onClick={next}>Weiter</button>
          </div>
        ) : (
          <div className="stack-4">
            <VField label="E-Mail" req error={err.email}>
              <input className={'input' + (err.email ? ' has-error' : '')} value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="praxis@beispiel.at" />
            </VField>
            <VField label="Passwort" req error={err.pw}>
              <input className={'input' + (err.pw ? ' has-error' : '')} type="password" value={f.pw} onChange={(e) => set('pw', e.target.value)} placeholder="Mindestens 6 Zeichen" />
            </VField>
            <VField label="Angebotene Leistungen" req error={err.services}>
              <div className="vn-meta" style={{ marginTop: -2, marginBottom: 4 }}>Bitte mindestens eine Option auswählen.</div>
              <div className="check-grid">
                {Object.entries(SERVICE_LABEL).map(([k, label]) => (
                  <button key={k} className={'check-tile' + (f.services.includes(k) ? ' is-on' : '')} onClick={() => toggleS(k)}>
                    <span className="box"><VNIcon.check s={13} /></span>{label}
                  </button>
                ))}
              </div>
            </VField>
            <VField label={<span>Spezialgebiete &amp; Zusatzleistungen <Tooltip text="Optional. Geben Sie an, in welchen Fachgebieten Ihre Praxis besondere Erfahrung hat — das hilft Tierhalter:innen bei der gezielten Suche." /></span>}>
              <div className="vn-meta" style={{ marginTop: -2, marginBottom: 4 }}>Optional — Mehrfachauswahl möglich.</div>
              <div className="check-grid">
                {SPECIALTIES.map((sp) => (
                  <button key={sp.key} className={'check-tile' + (f.specialties.includes(sp.key) ? ' is-on' : '')} onClick={() => toggleSpec(sp.key)}>
                    <span className="box"><VNIcon.check s={13} /></span>{sp.label}
                  </button>
                ))}
              </div>
              <input className="input" style={{ marginTop: 10 }} value={f.specialtiesOther} onChange={(e) => set('specialtiesOther', e.target.value)} placeholder="Sonstige / weitere Spezialgebiete" />
            </VField>
            <div className="btn-row">
              <button className="btn btn-secondary btn-lg" onClick={() => setStep(1)}>Zurück</button>
              <button className="btn btn-primary btn-lg" onClick={submit}>Registrieren</button>
            </div>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

function AuthSuccess({ nav, title, text, cta, go }) {
  return (
    <AuthShell>
      <div className="auth-panel" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-bg)', color: 'var(--green)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
          <VNIcon.check s={34} />
        </div>
        <h2 className="vn-h2">{title}</h2>
        <p className="vn-text" style={{ marginTop: 10, maxWidth: 360, marginInline: 'auto' }}>{text}</p>
        <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 24 }} onClick={() => nav(go)}>{cta}</button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => nav('home')}>Zur Startseite</button>
      </div>
    </AuthShell>
  );
}

