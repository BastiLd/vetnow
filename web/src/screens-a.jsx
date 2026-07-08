/* VetNow — Screens A: Startseite + Notfall-Suche */
import React from 'react';
import { VNIcon, Tooltip, MultiSelect, Switch, ANIMAL_ICON, SERVICE_ICON } from './components.jsx';
import { ANIMALS, SITUATIONS, DISTRICTS, SPECIALTIES } from './data.js';

export function LegendMini() {
  const items = [
    ['green',  'Grün',  'Heute bestätigt erreichbar'],
    ['yellow', 'Gelb',  'Nur nach telefonischer Rücksprache'],
    ['red',    'Rot',   'Heute nicht verfügbar'],
    ['grey',   'Grau',  'Status nicht aktuell bestätigt'],
  ];
  return (
    <div className="card card-pad">
      <div className="section-label" style={{ marginBottom: 14 }}>Das Ampel-System</div>
      <div className="legend">
        {items.map(([c, t, d]) => (
          <div className="legend-item" key={c}>
            <span className={'dot dot-' + c} style={{ marginTop: 4 }}></span>
            <div><b>{t}</b> — {d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScreenHome({ nav, setFilters, filters }) {
  const quick = [
    { key: 'cat', icon: 'cat', label: 'Katze' },
    { key: 'dog', icon: 'dog', label: 'Hund' },
    { key: 'small', icon: 'rabbit', label: 'Kleintiere' },
    { key: 'horse', icon: 'horse', label: 'Pferd' },
    { key: 'bird', icon: 'bird', label: 'Vogel' },
    { key: 'exotic', icon: 'turtle', label: 'Exoten' },
  ];
  const goQuick = (animal) => { if (setFilters && filters) setFilters({ ...filters, animal }); nav('search'); };
  return (
    <div className="vn-page home-page">
      <div className="vn-page-wide home-grid">
        <div className="stack-5">
          <div className="home-intro">
            <span className="vn-eyebrow">Tierärztliche Soforthilfe · Kärnten</span>
            <h1>Schnell die richtige Praxis finden — wenn es zählt.</h1>
            <p className="vn-text">Finden Sie eine passende tierärztliche Anlaufstelle in Kärnten — mit tagesaktuellem Status, Notfallinfos und direktem Kontakt.</p>
          </div>

          <button className="emergency-cta" onClick={() => nav('search')}>
            <span className="ec-icon"><VNIcon.siren s={26} /></span>
            <span>
              <span className="ec-title">Ich brauche jetzt Hilfe</span>
              <span className="ec-sub">Notfall-Praxen mit bestätigtem Status finden</span>
            </span>
            <span className="ec-arrow"><VNIcon.chevronR s={22} /></span>
          </button>

          <div className="notice notice-warn">
            <span className="ni"><VNIcon.alert s={18} /></span>
            <div><strong>Keine medizinische Beratung.</strong> Bei akuten Notfällen bitte sofort telefonisch Kontakt aufnehmen.</div>
          </div>

          <div>
            <div className="section-label" style={{ marginBottom: 12 }}>Schnellsuche nach Tierart</div>
            <div className="qa-grid">
              {quick.map((q) => {
                const I = VNIcon[q.icon];
                return (
                  <button key={q.key} className="qa-tile" onClick={() => goQuick(q.key)}>
                    <span className="qa-ic"><I s={20} /></span>
                    {q.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="home-cards stack-4">
          <LegendMini />
          <div className="card card-pad">
            <div className="trust-row">
              <span className="trust-ic"><VNIcon.shield s={20} /></span>
              <div>
                <div className="section-label">Tagesaktuell bestätigt</div>
                <p className="vn-text" style={{ marginTop: 6 }}>
                  Praxen bestätigen ihren Status für jeweils 24 Stunden. Ist die Bestätigung älter, wird die Praxis automatisch grau markiert — verlassen Sie sich nie allein auf einen unbestätigten Status.
                </p>
              </div>
            </div>
          </div>
          <button className="card card-pad" onClick={() => nav('owner-messages')} style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left' }}>
            <span className="trust-ic"><VNIcon.chat s={20} /></span>
            <div style={{ flex: 1 }}>
              <div className="section-label">Meine Nachrichten</div>
              <p className="vn-meta" style={{ marginTop: 3 }}>Anfragen und Konversationen mit Praxen ansehen.</p>
            </div>
            <VNIcon.chevronR s={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChoiceGroup({ label, hint, cols, options, value, onChange, multi }) {
  const isSel = (k) => multi ? (value || []).includes(k) : value === k;
  const toggle = (k) => {
    if (multi) {
      const set = new Set(value || []);
      set.has(k) ? set.delete(k) : set.add(k);
      onChange([...set]);
    } else {
      onChange(value === k ? null : k);
    }
  };
  return (
    <div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="section-label">{label}</div>
        {hint && <span className="vn-meta">{hint}</span>}
      </div>
      <div className={'choice-grid cols-' + cols}>
        {options.map((o) => {
          const on = isSel(o.key);
          const I = o.icon ? VNIcon[o.icon] : null;
          return (
            <button key={o.key} className={'choice' + (on ? ' is-on' : '')} onClick={() => toggle(o.key)} aria-pressed={on}>
              {I && <I s={18} />}
              {o.label}
              {on && <VNIcon.check s={16} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ScreenSearch({ nav, filters, setFilters }) {
  const set = (k, v) => setFilters({ ...filters, [k]: v });
  const animalOpts = ANIMALS.map((a) => ({ ...a, icon: ANIMAL_ICON[a.key] }));
  const sitOpts = SITUATIONS.map((s) => ({ ...s, icon: SERVICE_ICON[s.key] }));
  const distOpts = DISTRICTS.map((d) => ({ key: d, label: d }));

  const steps = [!!filters.animal, !!filters.situation, !!filters.district, !!(filters.specialties && filters.specialties.length)];
  const doneCount = steps.filter(Boolean).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="vn-page">
      <div className="vn-page-wide d-narrow">
        <div className="search-progress">
          <span className="sp-label">{doneCount === 0 ? 'Auswahl starten' : doneCount + ' von 4 gewählt'}</span>
          <span className="sp-bar"><span className="sp-fill" style={{ width: Math.max(6, pct) + '%' }}></span></span>
        </div>

        <div className="stack-6" style={{ marginTop: 18 }}>
          <div>
            <h2 className="vn-h2">Wonach suchen Sie?</h2>
            <p className="vn-text" style={{ marginTop: 6 }}>Alle Angaben sind optional. Je genauer, desto besser passen die Ergebnisse.</p>
          </div>

          <ChoiceGroup label="Tierart" cols="2" options={animalOpts}
            value={filters.animal} onChange={(v) => set('animal', v)} />

          <ChoiceGroup label="Situation" cols="2" options={sitOpts}
            value={filters.situation} onChange={(v) => set('situation', v)} />

          <ChoiceGroup label="Bezirk" cols="2" options={distOpts}
            value={filters.district} onChange={(v) => set('district', v)} />

          <div>
            <div className="row gap-2" style={{ marginBottom: 12 }}>
              <div className="section-label">Spezialisierungen</div>
              <Tooltip text="Filtern Sie nach speziellen Fachgebieten wie Chirurgie, Zahn oder Kardiologie. Mehrfachauswahl möglich." />
            </div>
            <MultiSelect options={SPECIALTIES} value={filters.specialties}
              onChange={(v) => set('specialties', v)} placeholder="Alle Spezialgebiete" />
          </div>

          <button className="switch-row" onClick={() => set('onlyConfirmed', !filters.onlyConfirmed)} style={{ width: '100%', textAlign: 'left' }}>
            <div style={{ flex: 1 }}>
              <div className="section-label">Nur aktuell bestätigte Praxen</div>
              <div className="vn-meta" style={{ marginTop: 3 }}>Blendet graue (nicht bestätigte) Einträge aus.</div>
            </div>
            <Switch on={filters.onlyConfirmed} />
          </button>
        </div>

        <div className="sticky-cta">
          <button className="btn btn-primary btn-lg btn-block" onClick={() => nav('results')}>
            Ergebnisse anzeigen <VNIcon.chevron s={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

