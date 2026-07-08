/* VetNow — Screens C: Anfrageformular */
import React from 'react';
import { VNIcon, Checkbox, toast } from './components.jsx';
import { ANIMALS, SITUATIONS, DISTRICTS } from './data.js';
import { useVNData } from './lib/adminContext.jsx';

export function Field({ label, req, children }) {
  return (
    <div className="field">
      <label>{label}{req && <span className="req"> *</span>}</label>
      {children}
    </div>
  );
}

export function ScreenRequest({ nav, filters, practiceId, auth }) {
  const D = useVNData();
  const p = practiceId ? D.PRACTICES.find((x) => x.id === practiceId) : null;
  const loggedIn = auth && auth.role;
  const [sent, setSent] = React.useState(false);
  const [err, setErr] = React.useState({});
  const [form, setForm] = React.useState({
    name: '', phone: '',
    animal: filters.animal || '',
    situation: filters.situation || '',
    district: filters.district || (p ? p.district : ''),
    message: '',
    agree: false,
  });
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErr((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; }); };
  const submit = () => {
    const e = {};
    if (!form.name) e.name = 'Bitte Namen eingeben.';
    if (!form.phone) e.phone = 'Bitte Telefonnummer eingeben.';
    else if ((form.phone.match(/\d/g) || []).length < 6) e.phone = 'Bitte gültige Telefonnummer eingeben (für den Rückruf der Praxis).';
    if (!form.agree) e.agree = 'Bitte bestätigen Sie den Hinweis.';
    setErr(e);
    if (Object.keys(e).length === 0) { setSent(true); toast('Anfrage übermittelt.', 'success'); }
    else { toast('Bitte prüfen Sie die markierten Felder.', 'error'); }
  };

  if (sent) {
    return (
      <div className="vn-page">
        <div className="vn-page-wide d-narrow">
          <div className="card card-pad" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'var(--green-bg)', color: 'var(--green)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
              <VNIcon.check s={32} />
            </div>
            <h2 className="vn-h2">Vielen Dank!</h2>
            <p className="vn-text" style={{ marginTop: 10, maxWidth: 380, marginInline: 'auto' }}>
              Ihre Anfrage{p ? ' an ' + p.name : ''} wurde übermittelt. <strong>Bei akuten Notfällen nehmen Sie bitte zusätzlich telefonisch Kontakt auf</strong> — eine Anfrage ersetzt keinen Anruf.
            </p>
            <div className="stack-3" style={{ marginTop: 24 }}>
              {p && <a className="btn btn-primary btn-block" href={'tel:' + p.phone.replace(/\s/g, '')}><VNIcon.phone s={18} /> {p.name} anrufen</a>}
              <button className="btn btn-secondary btn-block" onClick={() => nav('results')}>Zurück zu den Ergebnissen</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vn-page">
      <div className="vn-page-wide d-narrow">
        <div style={{ marginBottom: 20 }}>
          <h2 className="vn-h2">Anfrage senden</h2>
          <p className="vn-text" style={{ marginTop: 6 }}>
            {p ? <>An <b style={{ color: 'var(--ink)' }}>{p.name}</b>. </> : null}
            Kein Live-Chat — die Praxis meldet sich zurück.
          </p>
        </div>

        {!loggedIn && (
          <div className="notice notice-info" style={{ marginBottom: 18 }}>
            <span className="ni"><VNIcon.user s={16} /></span>
            <div>Bitte <a className="link" onClick={() => nav('login')}>anmelden</a>, um eine Anfrage zu stellen und Ihre Konversationen zu speichern. Sie können das Formular auch ohne Konto absenden.</div>
          </div>
        )}

        <div className="stack-4">
          <Field label="Name" req>
            <input className={'input' + (err.name ? ' has-error' : '')} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ihr Name" />
            {err.name && <span className="field-error"><VNIcon.alert s={13} /> {err.name}</span>}
          </Field>
          <Field label="Telefonnummer" req>
            <input className={'input' + (err.phone ? ' has-error' : '')} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+43 …" />
            {err.phone && <span className="field-error"><VNIcon.alert s={13} /> {err.phone}</span>}
          </Field>
          <div className="choice-grid cols-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Tierart">
              <select className="selectbox" value={form.animal} onChange={(e) => set('animal', e.target.value)}>
                <option value="">Bitte wählen</option>
                {ANIMALS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </Field>
            <Field label="Situation">
              <select className="selectbox" value={form.situation} onChange={(e) => set('situation', e.target.value)}>
                <option value="">Bitte wählen</option>
                {SITUATIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Bezirk / Ort">
            <select className="selectbox" value={form.district} onChange={(e) => set('district', e.target.value)}>
              <option value="">Bitte wählen</option>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Kurze Nachricht">
            <textarea className="textarea" value={form.message} onChange={(e) => set('message', e.target.value)} placeholder="Was ist passiert? Seit wann? Welche Symptome?" />
          </Field>

          <div>
            <button className={'check' + (form.agree ? ' is-on' : '')} onClick={() => set('agree', !form.agree)} style={{ background: 'none', border: 0, padding: 0 }}>
              <Checkbox on={form.agree} />
              <span className="ctext">Ich verstehe, dass dies keine medizinische Beratung ersetzt und ich bei akuten Notfällen zusätzlich telefonisch Kontakt aufnehmen muss.</span>
            </button>
            {err.agree && <span className="field-error" style={{ marginTop: 6 }}><VNIcon.alert s={13} /> {err.agree}</span>}
          </div>

          <button className="btn btn-primary btn-lg btn-block" onClick={submit}>
            <VNIcon.send s={20} /> Anfrage senden
          </button>
        </div>
      </div>
    </div>
  );
}

