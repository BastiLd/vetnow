/* VetNow — Screens F: Kalender (Tag / Woche / Monat) + Termin-Modals */
import React from 'react';
import { VNIcon, AnimalGlyph, Tooltip, toast } from './components.jsx';
import { MONTHS_DE, DOW_DE, APPT_STATUS, ANIMAL_LABEL, ANIMALS, blocksFor } from './data.js';

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseISO = (iso) => new Date(iso + 'T00:00:00');
  const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return ymd(d); };
  const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  function StatusDots({ list }) {
    return (
      <span className="cc-dots">
        {list.slice(0, 4).map((s, i) => <span key={i} className={'cc-dot ' + s}></span>)}
      </span>
    );
  }

  function DayTimeline({ iso, appts, onOpen, onNew, onBlock }) {
    const longTitle = (() => {
      const d = parseISO(iso);
      return WD_LONG[d.getDay()] + ', ' + pad(d.getDate()) + '. ' + MONTHS_DE[d.getMonth()];
    })();
    const blocks = blocksFor(iso).map((b) => ({ ...b, block: true }));
    const items = appts.map((a, i) => ({ ...a, _idx: i }));
    const timeline = [...items, ...blocks].sort((x, y) => x.time < y.time ? -1 : x.time > y.time ? 1 : 0);
    const animalIcon = (a) => <AnimalGlyph animal={a} s={20} />;

    return (
      <div className="stack-4">
        <div className="cal-dayhead">
          <span className="dh-title">{longTitle}</span>
          <span className="vn-meta">{appts.length === 0 ? 'Keine Termine' : appts.length + (appts.length === 1 ? ' Termin' : ' Termine')}</span>
        </div>

        {timeline.length === 0 ? (
          <div className="card cal-empty-day">
            <div className="ce-ic"><VNIcon.cal s={22} /></div>
            <p className="vn-text">Für diesen Tag sind keine Termine eingetragen.</p>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={onNew}><VNIcon.plus s={15} /> Termin anlegen</button>
          </div>
        ) : (
          <div className="stack-3">
            {timeline.map((item, i) => item.block ? (
              <div key={'b' + i} className="block-bar">
                <span className="bb-time">{item.time}</span>
                <span className="bb-label"><VNIcon.clock s={15} /> {item.label} <span className="vn-meta" style={{ fontWeight: 500 }}>({item.time}–{item.end})</span></span>
              </div>
            ) : (() => {
              const a = item; const st = APPT_STATUS[a.status];
              return (
                <button key={i} className={'appt-card' + (a.status === 'done' ? ' is-done' : a.status === 'cancelled' ? ' is-cancelled' : a.status === 'confirmed' ? ' is-confirmed' : '')} onClick={() => onOpen(a._idx)}>
                  <span className="appt-time">{a.time}</span>
                  <span className="appt-icon">{animalIcon(a.animal)}</span>
                  <span className="appt-main">
                    <span className="appt-name" style={{ display: 'block' }}>{a.name}</span>
                    <span className="appt-reason" style={{ display: 'block' }}>{a.note ? a.note : a.reason}</span>
                  </span>
                  <span className={'appt-tag ' + st.cls}>{a.status === 'done' && <VNIcon.check s={13} />}{st.label}</span>
                </button>
              );
            })())}
          </div>
        )}
      </div>
    );
  }

  function MonthYearPicker({ y, m, onPick, onClose }) {
    const [year, setYear] = React.useState(y);
    return (
      <React.Fragment>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 55 }}></div>
        <div className="cal-pop" onClick={(e) => e.stopPropagation()}>
          <div className="yr-row">
            <button className="cal-iconbtn" style={{ width: 34, height: 34 }} onClick={() => setYear((v) => v - 1)}><VNIcon.back s={18} /></button>
            <span className="yr">{year}</span>
            <button className="cal-iconbtn" style={{ width: 34, height: 34 }} onClick={() => setYear((v) => v + 1)}><VNIcon.chevronR s={18} /></button>
          </div>
          <div className="cal-mon-grid">
            {MONTHS_DE.map((name, i) => (
              <button key={i} className={(i === m && year === y) ? 'is-on' : ''} onClick={() => onPick(year, i)}>{name.slice(0, 3)}</button>
            ))}
          </div>
        </div>
      </React.Fragment>
    );
  }

/* ---- Appointment detail + status actions + note ---- */
export function ApptModal({ appt, idx, onClose, onStatus, onComplete }) {
  const st = APPT_STATUS[appt.status];
  const [noteMode, setNoteMode] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [noteText, setNoteText] = React.useState(appt.note || 'Behandlung verlief gut, bitte weiter beobachten.');
  return (
    <div className="vn-modal-bg" onClick={onClose}>
      <div className="vn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h3 className="vn-h3">Termin · {appt.time}</h3>
          <button className="vn-back" style={{ width: 36, height: 36 }} onClick={onClose}><VNIcon.x s={18} /></button>
        </div>
        <div className="stack-3">
          <div className="kv"><VNIcon.user s={15} /> {appt.name}</div>
          <div className="kv"><AnimalGlyph animal={appt.animal} s={15} /> {ANIMAL_LABEL[appt.animal]}</div>
          <div className="kv"><VNIcon.siren s={15} /> {appt.reason}</div>
          <div><span className={'appt-tag ' + st.cls}>{appt.status === 'done' && <VNIcon.check s={13} />}{st.label}</span></div>
          {appt.note && (
            <div className="note-box" style={{ marginTop: 4 }}>
              <span className="note-ic"><VNIcon.note s={16} /></span>
              <div><div className="note-label">Abschlussnotiz</div>{appt.note}</div>
            </div>
          )}
        </div>

        {!noteMode ? (
          <React.Fragment>
            <div className="section-label" style={{ margin: '20px 0 10px' }}>Status ändern</div>
            <div className="status-actions">
              <button className="btn btn-secondary" onClick={() => { onStatus(idx, 'confirmed'); toast('Termin bestätigt.', 'success'); }}><VNIcon.check s={16} /> Bestätigen</button>
              <button className="btn btn-primary" onClick={() => setNoteMode(true)}><VNIcon.checkCircle s={16} /> Abschließen</button>
              {confirmCancel
                ? <button className="btn btn-secondary" onClick={() => { onStatus(idx, 'cancelled'); toast('Termin abgesagt.', 'info'); onClose(); }} style={{ color: '#fff', background: 'var(--red)', borderColor: 'var(--red)' }}><VNIcon.alert s={16} /> Wirklich absagen?</button>
                : <button className="btn btn-secondary" onClick={() => setConfirmCancel(true)} style={{ color: 'var(--red-ink)' }}><VNIcon.x s={16} /> Absagen</button>}
            </div>
          </React.Fragment>
        ) : (
          <div style={{ marginTop: 18 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>Abschlussnotiz für Tierhalter:in</div>
            <textarea className="textarea" value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{ minHeight: 90 }} placeholder="z. B. Behandlung verlief gut, bitte weiter beobachten." />
            <div className="vn-meta" style={{ margin: '6px 0 12px' }}>Die Notiz erscheint als Abschluss-Nachricht im Chat mit der/dem Tierhalter:in.</div>
            <div className="btn-row">
              <button className="btn btn-secondary" onClick={() => setNoteMode(false)}>Zurück</button>
              <button className="btn btn-primary" onClick={() => { if (!noteText.trim()) { toast('Bitte Notiz eingeben.', 'error'); return; } onComplete(idx, noteText.trim()); toast('Termin abgeschlossen, Notiz gesendet.', 'success'); onClose(); }}>
                <VNIcon.send s={16} /> Abschließen & senden
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function NewApptModal({ onClose }) {
  return (
    <div className="vn-modal-bg" onClick={onClose}>
      <div className="vn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <h3 className="vn-h3">Neuen Termin anlegen</h3>
          <button className="vn-back" style={{ width: 36, height: 36 }} onClick={onClose}><VNIcon.x s={18} /></button>
        </div>
        <div className="stack-4">
          <div className="field"><label>Tierhalter:in / Tier</label><input className="input" placeholder="z. B. Mimi (Frau Wieser)" /></div>
          <div className="field"><label>Tierart</label>
            <select className="selectbox">{ANIMALS.map((a) => <option key={a.key}>{a.label}</option>)}</select>
          </div>
          <div>
            <div className="row gap-2" style={{ marginBottom: 7 }}>
              <label style={{ fontSize: 13.5, fontWeight: 600 }}>Zeitwunsch der/des Tierhalter:in</label>
              <Tooltip text="Wunschdatum und bevorzugte Tageszeit — die Praxis bestätigt anschließend einen konkreten Termin." />
            </div>
            <div className="choice-grid cols-2">
              <input className="input" type="text" defaultValue="04.06.2026" aria-label="Datum" />
              <select className="selectbox" aria-label="Bevorzugte Uhrzeit" defaultValue="">
                <option value="">Bevorzugte Uhrzeit</option>
                <option>Vormittag (8–12 Uhr)</option>
                <option>Mittag (12–14 Uhr)</option>
                <option>Nachmittag (14–17 Uhr)</option>
                <option>Abend (ab 17 Uhr)</option>
                <option>So bald wie möglich</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Grund</label><input className="input" placeholder="z. B. Kontrolle" /></div>
        </div>
        <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 18 }} onClick={() => { toast('Termin angelegt.', 'success'); onClose(); }}>Termin speichern</button>
      </div>
    </div>
  );
}

export function BlockModal({ onClose }) {
  return (
    <div className="vn-modal-bg" onClick={onClose}>
      <div className="vn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <h3 className="vn-h3">Blockzeit eintragen</h3>
          <button className="vn-back" style={{ width: 36, height: 36 }} onClick={onClose}><VNIcon.x s={18} /></button>
        </div>
        <div className="vn-meta" style={{ marginBottom: 14 }}>Blockzeiten (z. B. Mittagspause, OP-Zeiten) werden im Kalender als graue Balken markiert und nicht zur Terminbuchung freigegeben.</div>
        <div className="stack-4">
          <div className="field"><label>Bezeichnung</label><input className="input" placeholder="z. B. Mittagspause, OP-Zeit" /></div>
          <div className="choice-grid cols-2">
            <div className="field"><label>Von</label><input className="input" defaultValue="12:00" /></div>
            <div className="field"><label>Bis</label><input className="input" defaultValue="13:00" /></div>
          </div>
        </div>
        <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 18 }} onClick={() => { toast('Blockzeit eingetragen.', 'success'); onClose(); }}>Blockzeit speichern</button>
      </div>
    </div>
  );
}


  export function CalendarPanel({ apptsByDate, today, onStatus, onComplete }) {
    const [view, setView] = React.useState('day');
    const [sel, setSel] = React.useState(today);
    const selD = parseISO(sel);
    const [cursor, setCursor] = React.useState({ y: selD.getFullYear(), m: selD.getMonth() });
    const [pickOpen, setPickOpen] = React.useState(false);
    const [modal, setModal] = React.useState(null); // {idx} | 'new' | 'block'

    const apptsOf = (iso) => apptsByDate[iso] || [];
    const dayAppts = apptsOf(sel);

    // week (Mon–Sun) containing sel
    const mon0 = (selD.getDay() + 6) % 7;
    const monday = new Date(selD); monday.setDate(selD.getDate() - mon0);
    const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });

    // month grid (6 weeks)
    const first = new Date(cursor.y, cursor.m, 1);
    const startW = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < startW; i++) { const d = new Date(cursor.y, cursor.m, 1 - (startW - i)); cells.push(d); }
    const dim = new Date(cursor.y, cursor.m + 1, 0).getDate();
    for (let day = 1; day <= dim; day++) cells.push(new Date(cursor.y, cursor.m, day));
    while (cells.length < 42) { const last = cells[cells.length - 1]; const nd = new Date(last); nd.setDate(last.getDate() + 1); cells.push(nd); }

    const monthTitle = MONTHS_DE[cursor.m] + ' ' + cursor.y;
    const dayTitle = (() => { const d = selD; return pad(d.getDate()) + '. ' + MONTHS_DE[d.getMonth()] + ' ' + d.getFullYear(); })();
    const weekTitle = (() => {
      const a = weekDays[0], b = weekDays[6];
      const m1 = MONTHS_DE[a.getMonth()].slice(0, 3), m2 = MONTHS_DE[b.getMonth()].slice(0, 3);
      return pad(a.getDate()) + '. ' + m1 + ' – ' + pad(b.getDate()) + '. ' + m2;
    })();

    const goPrev = () => {
      if (view === 'month') setCursor((c) => { const m = c.m - 1; return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m }; });
      else if (view === 'week') setSel((s) => addDays(s, -7));
      else setSel((s) => addDays(s, -1));
    };
    const goNext = () => {
      if (view === 'month') setCursor((c) => { const m = c.m + 1; return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m }; });
      else if (view === 'week') setSel((s) => addDays(s, 7));
      else setSel((s) => addDays(s, 1));
    };
    const goToday = () => { setSel(today); const d = parseISO(today); setCursor({ y: d.getFullYear(), m: d.getMonth() }); };
    const pickDay = (d) => { setSel(ymd(d)); setView('day'); };

    const title = view === 'month' ? monthTitle : view === 'week' ? weekTitle : dayTitle;
    const titleClickable = view === 'month';

    return (
      <div className="stack-5">
        {/* toolbar */}
        <div className="cal-toolbar">
          <div className="cal-nav">
            <button className="cal-iconbtn" onClick={goPrev} aria-label="Zurück"><VNIcon.back s={18} /></button>
            {titleClickable ? (
              <button className="cal-title-btn" onClick={() => setPickOpen((o) => !o)}>{title} <VNIcon.chevron s={16} /></button>
            ) : (
              <span className="cal-title-btn" style={{ cursor: 'default' }}>{title}</span>
            )}
            <button className="cal-iconbtn" onClick={goNext} aria-label="Weiter"><VNIcon.chevronR s={18} /></button>
            {pickOpen && view === 'month' && (
              <MonthYearPicker y={cursor.y} m={cursor.m} onClose={() => setPickOpen(false)}
                onPick={(yy, mm) => { setCursor({ y: yy, m: mm }); setPickOpen(false); }} />
            )}
          </div>
          <button className="btn btn-secondary btn-sm cal-today-btn" onClick={goToday}>Heute</button>
          <div className="cal-viewseg">
            {[['day', 'Tag'], ['week', 'Woche'], ['month', 'Monat']].map(([k, l]) => (
              <button key={k} className={view === k ? 'is-on' : ''} onClick={() => setView(k)}>{l}</button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => setModal('new')}>
          <VNIcon.plus s={18} /> Neuen Termin anlegen
        </button>

        {/* legend */}
        <div className="appt-legend">
          <span className="li"><span className="sw yellow"></span> Offen</span>
          <span className="li"><span className="sw blue"></span> Bestätigt</span>
          <span className="li"><span className="sw green"></span> Erledigt</span>
          <span className="li"><span className="sw red"></span> Abgesagt</span>
          <span className="li"><span className="sw block"></span> Blockzeit</span>
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setModal('block')}><VNIcon.plus s={15} /> Blockzeit</button>
        </div>

        {/* views */}
        {view === 'month' && (
          <div className="card card-pad">
            <div className="cal-dow">{DOW_DE.map((d) => <span key={d}>{d}</span>)}</div>
            <div className="cal-grid">
              {cells.map((d, i) => {
                const iso = ymd(d);
                const muted = d.getMonth() !== cursor.m;
                const isToday = iso === today;
                const isSel = iso === sel;
                const weekend = (d.getDay() === 0 || d.getDay() === 6);
                const list = apptsOf(iso);
                return (
                  <button key={i} className={'cal-cell' + (muted ? ' muted' : '') + (weekend ? ' weekend' : '') + (isToday ? ' today' : '') + (isSel ? ' sel' : '')}
                    onClick={() => pickDay(d)}>
                    <span className="cc-num">{d.getDate()}</span>
                    {list.length > 0 && <StatusDots list={list.map((a) => a.status)} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === 'week' && (
          <div className="cal-weekrow">
            {weekDays.map((d, i) => {
              const iso = ymd(d);
              const list = apptsOf(iso);
              const isToday = iso === today; const isSel = iso === sel;
              return (
                <button key={i} className={'cal-wd' + (isToday ? ' today' : '') + (isSel ? ' sel' : '')} onClick={() => pickDay(d)}>
                  <span className="wd-name">{DOW_DE[i]}</span>
                  <span className="wd-num">{d.getDate()}</span>
                  <span className="wd-count">{list.length > 0 ? list.length + ' Term.' : '–'}</span>
                  <StatusDots list={list.map((a) => a.status)} />
                </button>
              );
            })}
          </div>
        )}

        {(view === 'day' || view === 'week') && (
          <DayTimeline iso={sel} appts={dayAppts}
            onOpen={(idx) => setModal({ idx })}
            onNew={() => setModal('new')}
            onBlock={() => setModal('block')} />
        )}

        {modal === 'new' && <NewApptModal onClose={() => setModal(null)} />}
        {modal === 'block' && <BlockModal onClose={() => setModal(null)} />}
        {modal && typeof modal === 'object' && (
          <ApptModal appt={dayAppts[modal.idx]} idx={modal.idx} onClose={() => setModal(null)}
            onStatus={(i, st) => onStatus(sel, i, st)}
            onComplete={(i, note) => onComplete(sel, i, note)} />
        )}
      </div>
    );
  }

