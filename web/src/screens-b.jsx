/* VetNow — Screens B: Ergebnisliste + Detailansicht */
import React from 'react';
import { VNIcon, StatusBadge, ConfirmLine, AnimalTags, ServiceTags, SpecialtyTags, toast } from './components.jsx';
import { ANIMAL_LABEL, SERVICE_LABEL, SPECIALTY_LABEL, sortPractices } from './data.js';
import { useVNData } from './lib/adminContext.jsx';

export function applyFilters(practices, filters) {
  const animals = filters.animals || [];
  const situations = filters.situations || [];
  const districts = filters.districts || [];
  let list = practices.filter((p) => {
    // Mehrfachauswahl: Treffer, wenn mindestens eine gewählte Option passt
    if (animals.length && !animals.some((a) => a === 'other' || p.animals.includes(a))) return false;
    if (situations.length && !situations.some((s) => p.services.includes(s))) return false;
    if (districts.length && !districts.some((d) => p.district.startsWith(d))) return false;
    if (filters.specialties && filters.specialties.length && !filters.specialties.some((s) => (p.specialties || []).includes(s))) return false;
    if (filters.onlyConfirmed && p.status === 'grey') return false;
    if (filters.onlyGreen && p.status !== 'green') return false;
    if (filters.housecall && !p.services.includes('housecall')) return false;
    if (filters.is24h && !/24/.test(p.hoursShort || '')) return false;
    return true;
  });
  return sortPractices(list);
}

function FilterSummary({ filters, nav }) {
  const chips = [];
  (filters.animals || []).forEach((a) => chips.push(ANIMAL_LABEL[a]));
  (filters.situations || []).forEach((s) => chips.push(SERVICE_LABEL[s]));
  (filters.districts || []).forEach((d) => chips.push(d));
  (filters.specialties || []).forEach((s) => chips.push(SPECIALTY_LABEL[s]));
  if (filters.onlyConfirmed) chips.push('Nur bestätigte');
  if (filters.onlyGreen) chips.push('Heute erreichbar');
  if (filters.housecall) chips.push('Hausbesuch');
  if (filters.is24h) chips.push('24 h');
  return (
    <div className="row between gap-3" style={{ flexWrap: 'wrap' }}>
      <div className="tag-row">
        {chips.length === 0 && <span className="vn-meta">Keine Filter — alle Praxen</span>}
        {chips.map((c, i) => <span className="tag tag-accent" key={i}>{c}</span>)}
      </div>
      <button className="btn btn-secondary btn-sm" onClick={() => nav('search')}>
        <VNIcon.filter s={15} /> Filter ändern
      </button>
    </div>
  );
}

export function ResultCard({ p, nav }) {
  const grey = p.status === 'grey';
  return (
    <div className="card result-card">
      <div className="result-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="vn-h3" style={{ marginBottom: 5 }}>{p.name}</h3>
          <div className="kv"><VNIcon.pin s={15} /> {p.district} · {p.address}</div>
        </div>
        <StatusBadge status={p.status} />
      </div>

      <div style={{ marginTop: 12, marginBottom: 14 }}><ConfirmLine practice={p} /></div>

      {grey ? (
        <div className="notice notice-grey" style={{ marginBottom: 14 }}>
          <span className="ni"><VNIcon.alert s={16} /></span>
          <div>Status nicht aktuell bestätigt — bitte unbedingt telefonisch prüfen.</div>
        </div>
      ) : (
        <div className="rc-info">
          <div className="kv" style={{ alignItems: 'flex-start' }}><VNIcon.siren s={15} /> <span style={{ color: 'var(--ink-2)' }}>{p.emergency}</span></div>
          <div className="kv"><VNIcon.clock s={15} /> {p.hoursShort}</div>
        </div>
      )}

      {p.absent && (
        <div className="vertretung-note" style={{ marginBottom: 14 }}>
          <span style={{ flex: 'none', marginTop: 1 }}><VNIcon.sun s={16} /></span>
          <div>Abwesend ({p.absenceRange}). <strong>Vertretung: {p.vertretung}</strong></div>
        </div>
      )}

      {p.specialties && p.specialties.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="rc-spec-label">Spezialgebiete</div>
          <div className="tag-row"><SpecialtyTags specialties={p.specialties} /></div>
        </div>
      )}

      <div className="tag-row" style={{ marginBottom: 18 }}>
        <AnimalTags animals={p.animals} />
        <ServiceTags services={p.services} accent />
      </div>

      <div className="btn-row" style={{ marginBottom: 10 }}>
        <a className="btn btn-primary" href={'tel:' + p.phone.replace(/\s/g, '')}><VNIcon.phone s={18} /> Anrufen</a>
        <button className="btn btn-secondary" onClick={() => toast('Route in Karten-App öffnen: ' + p.address, 'info')}><VNIcon.route s={18} /> Route</button>
      </div>
      <button className="btn btn-ghost btn-block btn-sm" onClick={() => nav('detail', { practiceId: p.id })}>
        Details ansehen <VNIcon.chevron s={16} />
      </button>
    </div>
  );
}

export function ScreenResults({ nav, filters, setFilters }) {
  const D = useVNData();
  const list = applyFilters(D.PRACTICES, filters);
  const hiddenGrey = filters.onlyConfirmed ? (applyFilters(D.PRACTICES, { ...filters, onlyConfirmed: false }).length - list.length) : 0;
  return (
    <div className="vn-page">
      <div className="vn-page-wide">
        <div className="stack-4" style={{ marginBottom: 20 }}>
          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <div>
              <h2 className="vn-h2">{list.length} {list.length === 1 ? 'Praxis' : 'Praxen'} gefunden</h2>
              <p className="vn-meta" style={{ marginTop: 4 }}>Grün zuerst · grau und rot zuletzt</p>
            </div>
          </div>
          <FilterSummary filters={filters} nav={nav} />
          <div className="notice notice-info">
            <span className="ni"><VNIcon.info s={16} /></span>
            <div>Angaben ohne Gewähr. Bitte bei Notfällen immer zuerst telefonisch bestätigen, ob die Praxis Sie aufnehmen kann.</div>
          </div>
          {hiddenGrey > 0 && (
            <div className="notice notice-grey">
              <span className="ni"><VNIcon.info s={16} /></span>
              <div>
                {hiddenGrey} {hiddenGrey === 1 ? 'Praxis mit unbestätigtem Status ist' : 'Praxen mit unbestätigtem Status sind'} ausgeblendet.
                {setFilters && <> <a className="link" onClick={() => setFilters({ ...filters, onlyConfirmed: false })}>Trotzdem anzeigen</a></>}
              </div>
            </div>
          )}
        </div>

        {list.length === 0 ? (
          <div className="card card-pad" style={{ textAlign: 'center' }}>
            <p className="vn-text">Keine Praxis entspricht Ihren Filtern.</p>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => nav('search')}>Filter anpassen</button>
          </div>
        ) : (
          <div className="d-grid-results">
            {list.map((p) => <ResultCard key={p.id} p={p} nav={nav} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Detail ---------------- */
const DAYS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];

export function ScreenDetail({ nav, practiceId }) {
  const D = useVNData();
  const p = D.PRACTICES.find((x) => x.id === practiceId) || D.PRACTICES[0];
  if (!p) {
    return (
      <div className="vn-page"><div className="vn-page-wide d-narrow">
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <p className="vn-text">Diese Praxis ist nicht (mehr) verfügbar.</p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => nav('search')}>Zur Suche</button>
        </div>
      </div></div>
    );
  }
  const grey = p.status === 'grey';
  const noticeCls = grey ? 'notice-grey' : p.status === 'red' ? 'notice-danger' : p.status === 'yellow' ? 'notice-warn' : 'notice-info';
  const todayIdx = 2; // Mittwoch (demo "heute", passend zum Kalender 04.06.)

  const actions = (
    <div className="stack-3">
      <a className="btn btn-primary btn-lg btn-block" href={'tel:' + p.phone.replace(/\s/g, '')}><VNIcon.phone s={20} /> Jetzt anrufen</a>
      <div className="btn-row">
        <button className="btn btn-secondary" onClick={() => toast('Route in Karten-App öffnen: ' + p.address, 'info')}><VNIcon.route s={18} /> Route öffnen</button>
        <button className="btn btn-secondary" onClick={() => nav('request', { practiceId: p.id })}><VNIcon.send s={18} /> Anfrage</button>
      </div>
    </div>
  );

  return (
    <React.Fragment>
      <div className="vn-page" style={{ paddingBottom: 24 }}>
        <div className="vn-page-wide d-grid-detail">
          {/* main column */}
          <div className="stack-5">
            <div>
              <h1 className="vn-h1" style={{ fontSize: 'clamp(24px,5vw,34px)' }}>{p.name}</h1>
              <div className="kv" style={{ marginTop: 10 }}><VNIcon.pin s={16} /> {p.district} · {p.address}</div>
              <div style={{ marginTop: 16 }}><StatusBadge status={p.status} size="lg" /></div>
              <div style={{ marginTop: 10 }}><ConfirmLine practice={p} /></div>
            </div>

            <div className={'notice ' + noticeCls}>
              <span className="ni"><VNIcon.siren s={18} /></span>
              <div><strong>Notfallhinweis.</strong> {p.emergencyLong}</div>
            </div>

            {p.absent && (
              <div className="vertretung-note">
                <span style={{ flex: 'none', marginTop: 1 }}><VNIcon.sun s={18} /></span>
                <div><strong>Derzeit abwesend</strong> ({p.absenceRange}). Bitte wenden Sie sich an die Vertretung: <strong>{p.vertretung}</strong>.</div>
              </div>
            )}

            <div className="card card-pad">
              <div className="section-label" style={{ marginBottom: 12 }}>Öffnungszeiten</div>
              <table className="hours">
                <tbody>
                  {DAYS.map((d, i) => (
                    <tr key={d} className={i === todayIdx ? 'today' : ''}>
                      <td>{d}{i === todayIdx ? ' · heute' : ''}</td>
                      <td>{p.hoursWeek[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card card-pad">
              <div className="section-label" style={{ marginBottom: 12 }}>Tierarten</div>
              <div className="tag-row" style={{ marginBottom: 18 }}><AnimalTags animals={p.animals} /></div>
              <div className="section-label" style={{ marginBottom: 12 }}>Leistungen</div>
              <div className="tag-row" style={{ marginBottom: (p.specialties && p.specialties.length ? 18 : 0) }}><ServiceTags services={p.services} accent /></div>
              {p.specialties && p.specialties.length > 0 && (
                <React.Fragment>
                  <div className="section-label" style={{ marginBottom: 12 }}>Spezialgebiete &amp; Zusatzleistungen</div>
                  <div className="tag-row"><SpecialtyTags specialties={p.specialties} /></div>
                </React.Fragment>
              )}
            </div>
          </div>

          {/* side column */}
          <div className="stack-5 d-sticky-side">
            <div className="card card-pad">
              <div className="section-label" style={{ marginBottom: 12 }}>Adresse</div>
              <div className="kv" style={{ marginBottom: 14 }}><VNIcon.pin s={16} /> {p.address}</div>
              <div className="map-ph">
                <div className="map-pin"><VNIcon.paw2 s={18} /></div>
              </div>
            </div>
            <div className="m-hide">{actions}</div>
          </div>
        </div>
      </div>

      <div className="sticky-actions d-hide">
        {actions}
      </div>
    </React.Fragment>
  );
}

