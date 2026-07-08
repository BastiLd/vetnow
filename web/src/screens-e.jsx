/* VetNow — Screens E: Tab-Dashboard (Status/Nachrichten/Termine/Profil),
   Chat-Komponente (mit Abschlussnotiz & Feedback) & Tierhalter-Nachrichten */
import React from 'react';
import { VNIcon, StatusBadge, Switch, Tooltip, AnimalGlyph, toast, StarRating } from './components.jsx';
import { ANIMAL_LABEL, DISTRICTS, SPECIALTIES } from './data.js';
import { useVNData } from './lib/adminContext.jsx';
import { CalendarPanel } from './screens-f.jsx';

function pad2(n) { return String(n).padStart(2, '0'); }

export function VerifyBadge({ status }) {
  const map = { verified: ['verified', 'Verifiziert', 'checkCircle'], pending: ['pending', 'In Prüfung', 'clock'], none: ['none', 'Nicht verifiziert', 'alert'] };
  const [cls, label, icon] = map[status] || map.none;
  const I = VNIcon[icon];
  return <span className={'verify-badge ' + cls}><I s={14} /> {label}</span>;
}

const ChatDisclaimer = () => (
  <div className="notice notice-warn" style={{ marginBottom: 16 }}>
    <span className="ni"><VNIcon.alert s={16} /></span>
    <div>Keine medizinische Beratung. Bei akuten Notfällen bitte immer zusätzlich telefonisch Kontakt aufnehmen.</div>
  </div>
);

/* ---------- Reusable chat ---------- */
export function ChatView({ convos, me, layout, store: extStore, setStore: extSet, feedback }) {
  const [intStore, setIntStore] = React.useState(() => Object.fromEntries(convos.map((c) => [c.id, c.messages])));
  const store = extStore || intStore;
  const setStore = extSet || setIntStore;
  const [sel, setSel] = React.useState(convos[0] ? convos[0].id : null);
  const [draft, setDraft] = React.useState('');
  const [pendingImg, setPendingImg] = React.useState(null);
  const fileRef = React.useRef(null);
  const [mobileThread, setMobileThread] = React.useState(false);
  const scrollRef = React.useRef(null);

  const active = convos.find((c) => c.id === sel);
  const msgs = active ? (store[active.id] || []) : [];
  const lastText = (c) => { const m = store[c.id] || []; const l = m[m.length - 1]; return l ? (l.type === 'note' ? 'Abschlussnotiz' : l.text) : ''; };

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs.length, sel]);

  const append = (msg) => setStore((s) => ({ ...s, [active.id]: [...(s[active.id] || []), msg] }));
  const send = () => {
    if (!active) return;
    if (pendingImg) { append({ from: me, type: 'image', src: pendingImg, text: draft.trim(), time: 'jetzt' }); setPendingImg(null); setDraft(''); return; }
    if (!draft.trim()) return;
    append({ from: me, text: draft.trim(), time: 'jetzt' }); setDraft('');
  };
  const onPickFile = (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setPendingImg(reader.result); toast('Bild bereit zum Senden.', 'info'); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const avatarIcon = (from) => from === 'clinic' ? <VNIcon.phone s={14} /> : <VNIcon.paw2 s={14} />;

  const hasNote = msgs.some((m) => m.type === 'note');
  const lastIsOwnerReply = msgs.length && msgs[msgs.length - 1].from === 'owner' && msgs[msgs.length - 1].type !== 'note';
  const showFeedback = feedback && me === 'owner' && hasNote && !lastIsOwnerReply;

  const list = (
    <div className="convo-list">
      {convos.map((c) => {
        const m = store[c.id] || [];
        return (
          <button key={c.id} className={'convo-item' + (c.id === sel ? ' is-on' : '')}
            onClick={() => { setSel(c.id); setMobileThread(true); }}>
            <span className="convo-avatar"><AnimalGlyph animal={c.animal} s={20} /></span>
            <span className="convo-main">
              <span className="convo-name">{c.title}</span>
              <span className="convo-snippet">{c.sub} · {lastText(c)}</span>
            </span>
            <span className="convo-meta">
              <span className="convo-date">{c.date}</span>
              {c.unread > 0 && <span className="unread-dot">{c.unread}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );

  const thread = active ? (
    <div className="chat-thread">
      <div className="chat-head">
        {layout === 'split' && <button className="vn-back m-show" onClick={() => setMobileThread(false)} style={{ width: 36, height: 36 }}><VNIcon.back s={18} /></button>}
        <span className="convo-avatar" style={{ width: 38, height: 38 }}><AnimalGlyph animal={active.animal} s={18} /></span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{active.title}</div>
          <div className="vn-meta">{active.sub}</div>
        </div>
      </div>
      <div className="chat-scroll" ref={scrollRef}>
        {msgs.map((m, i) => {
          if (m.type === 'note') return (
            <div key={i} className="note-msg">
              <div className="note-box">
                <span className="note-ic"><VNIcon.note s={16} /></span>
                <div>
                  <div className="note-label">Abschlussnotiz der Praxis</div>
                  {m.text}
                  <div className="note-time">{m.time}</div>
                </div>
              </div>
            </div>
          );
          if (m.type === 'image') return (
            <div key={i} className={'bubble-row' + (m.from === me ? ' me' : '')}>
              <span className={'bubble-av ' + m.from}>{avatarIcon(m.from)}</span>
              <div>
                <div className={'bubble-img ' + m.from}>
                  <img src={m.src} alt="Anhang" />
                  {m.text && <div className="cap">{m.text}</div>}
                </div>
                <div className="bubble-time">{m.time}</div>
              </div>
            </div>
          );
          return (
            <div key={i} className={'bubble-row' + (m.from === me ? ' me' : '')}>
              <span className={'bubble-av ' + m.from}>{avatarIcon(m.from)}</span>
              <div>
                <div className={'bubble ' + m.from}>{m.text}</div>
                <div className="bubble-time">{m.time}</div>
              </div>
            </div>
          );
        })}
      </div>
      {showFeedback && (
        <div className="feedback-bar">
          <span className="fb-label">Rückmeldung geben:</span>
          <button className="quick-reply" onClick={() => { append({ from: 'owner', text: 'Danke für die Rückmeldung!', time: 'jetzt' }); toast('Antwort gesendet.', 'success'); }}>Danke!</button>
          <StarRating value={0} onChange={(n) => { append({ from: 'owner', text: 'Bewertung: ' + '★'.repeat(n) + ' (' + n + '/5)', time: 'jetzt' }); toast('Vielen Dank für Ihre Bewertung!', 'success'); }} />
        </div>
      )}
      {pendingImg && (
        <div className="img-preview">
          <img src={pendingImg} alt="Vorschau" />
          <span className="vn-meta">Bild angehängt</span>
          <button className="vn-back ip-x" style={{ width: 32, height: 32 }} onClick={() => setPendingImg(null)} aria-label="Entfernen"><VNIcon.x s={16} /></button>
        </div>
      )}
      <div className="chat-compose">
        <input type="file" accept="image/*" ref={fileRef} onChange={onPickFile} style={{ display: 'none' }} />
        <button className="chat-attach" onClick={() => fileRef.current && fileRef.current.click()} aria-label="Bild anhängen" title="Bild anhängen"><VNIcon.camera s={20} /></button>
        <input className="input" value={draft} placeholder={pendingImg ? 'Bildunterschrift (optional) …' : 'Nachricht schreiben …'}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="chat-send" onClick={send} aria-label="Senden"><VNIcon.send s={18} /></button>
      </div>
    </div>
  ) : <div className="chat-empty">Wählen Sie eine Konversation.</div>;

  if (layout === 'stack') {
    return (
      <div className="stack-4">
        <div className="card" style={{ overflow: 'hidden' }}>{list}</div>
        <div className="card" style={{ overflow: 'hidden', minHeight: 420, display: 'flex', flexDirection: 'column' }}>{thread}</div>
      </div>
    );
  }
  return (
    <div className={'chat-split ' + (mobileThread ? 'show-thread' : 'show-list')}>
      {list}
      {thread}
    </div>
  );
}

function clinicConvosMeta(conversations) {
  return conversations.map((c) => ({
    id: c.id, title: c.owner, sub: ANIMAL_LABEL[c.animal], animal: c.animal, date: c.date, unread: c.unread,
  }));
}

/* ---------- Dashboard panels ---------- */
function StatusPanel({ s }) {
  const D = useVNData();
  const statuses = [
    { key: 'green',  cls: 'on-green',  title: 'Heute erreichbar / nehme Notfälle an', sub: 'Wird als grün angezeigt' },
    { key: 'yellow', cls: 'on-yellow', title: 'Nur nach telefonischer Rücksprache', sub: 'Wird als gelb angezeigt' },
    { key: 'red',    cls: 'on-red',    title: 'Heute nicht verfügbar', sub: 'Wird als rot angezeigt' },
  ];
  const soon = s.active && s.remaining < 2 * 3600 * 1000;
  const ab = s.absence;
  const setAb = (k, v) => s.setAbsence({ ...ab, [k]: v });
  return (
    <div className="stack-5">
      {soon && (
        <div className="expire-reminder">
          <span style={{ flex: 'none' }}><VNIcon.alert s={20} /></span>
          <div className="er-main">
            <strong>Status läuft bald ab</strong> — in <span className="er-time">{pad2(s.hh)}:{pad2(s.mm)}:{pad2(s.ss)}</span> werden Sie automatisch grau markiert.
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { s.setExpiry(Date.now() + s.DURATION); toast('Status um 24 Stunden verlängert.', 'success'); }}>
            <VNIcon.refresh s={15} /> Jetzt verlängern
          </button>
        </div>
      )}
      <div className="d-grid-2">
        <div className="stack-5">
          <div className="card card-pad">
            <div className="section-label" style={{ marginBottom: 14 }}>Heutiger Status</div>
            <div className="status-pick">
              {statuses.map((st) => (
                <button key={st.key} className={'status-btn ' + st.cls + (s.picked === st.key ? ' is-on' : '')}
                  onClick={() => { s.setPicked(st.key); s.setExpiry(Date.now() + s.DURATION); toast('Status aktualisiert.', 'success'); }}>
                  <span className="sb-dot" style={{ background: 'var(--' + (st.key === 'green' ? 'green' : st.key === 'yellow' ? 'yellow' : 'red') + ')' }}></span>
                  <span><span className="sb-title">{st.title}</span><span className="sb-sub">{st.sub}</span></span>
                  <span className="sb-check"><VNIcon.check s={20} /></span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="stack-5">
          <div className="card card-pad">
            <div className={'countdown' + (s.active ? '' : ' expired')}>
              <div>
                <div className="cd-label">{s.active ? 'Status läuft ab in' : 'Status abgelaufen'}</div>
                <div className="cd-time">{s.active ? pad2(s.hh) + ':' + pad2(s.mm) + ':' + pad2(s.ss) : '00:00:00'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="cd-label">Ablauf</div>
                <div style={{ fontWeight: 650, fontSize: 14 }}>{s.active ? s.expiryStr : '—'}</div>
              </div>
            </div>
            <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 14 }} onClick={() => { s.setExpiry(Date.now() + s.DURATION); toast('Status für 24 Stunden bestätigt.', 'success'); }}>
              <VNIcon.refresh s={18} /> Status für 24 Stunden bestätigen
            </button>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
              <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Nur zum Ausprobieren</div>
              <div className="row gap-2">
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => s.setExpiry(Date.now() + 90 * 60 * 1000)}>Kurz vor Ablauf</button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => s.setExpiry(Date.now() - 1000)}>Abgelaufen</button>
              </div>
            </div>
            {!s.active && (
              <div className="notice notice-grey" style={{ marginTop: 14 }}>
                <span className="ni"><VNIcon.alert s={16} /></span>
                <div>Status nicht aktuell bestätigt — bitte unbedingt telefonisch prüfen.</div>
              </div>
            )}
            <div className="notice notice-info" style={{ marginTop: 14 }}>
              <span className="ni"><VNIcon.info s={16} /></span>
              <div>Erinnerungen zur Bestätigung erhalten Sie nur <strong>während Ihrer Öffnungszeiten</strong> — nicht an geschlossenen Tagen, nachts oder während einer Abwesenheit.</div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="row gap-2" style={{ marginBottom: 4 }}>
              <div className="section-label">Abwesenheiten</div>
              <Tooltip text="Tragen Sie Urlaub oder Schließzeiten ein. Im Zeitraum erscheinen Sie automatisch als „nicht erreichbar“; auf Ihrer Detailseite wird die Vertretung angezeigt." />
            </div>
            <button className="switch-row" onClick={() => setAb('active', !ab.active)} style={{ width: '100%', textAlign: 'left', marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <div className="section-label">Abwesenheit aktiv</div>
                <div className="vn-meta" style={{ marginTop: 3 }}>Zeigt Ihre Praxis als „Heute nicht verfügbar“.</div>
              </div>
              <Switch on={ab.active} />
            </button>
            <div className="absence-grid" style={{ marginTop: 12 }}>
              <div className="field"><label>Von</label><input className="input" type="text" placeholder="TT.MM.JJJJ" value={ab.from} onChange={(e) => setAb('from', e.target.value)} /></div>
              <div className="field"><label>Bis</label><input className="input" type="text" placeholder="TT.MM.JJJJ" value={ab.to} onChange={(e) => setAb('to', e.target.value)} /></div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Vertretungspraxis</label>
              <select className="selectbox" value={ab.vertretung} onChange={(e) => setAb('vertretung', e.target.value)}>
                <option value="">Keine / selbst organisiert</option>
                {D.PRACTICES.filter((p) => p.id !== s.me.id).map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <button className="btn btn-secondary btn-block" style={{ marginTop: 14 }} onClick={() => toast(ab.active ? 'Abwesenheit gespeichert.' : 'Abwesenheit deaktiviert.', 'success')}>Abwesenheit speichern</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessagesPanel({ store, setStore }) {
  const D = useVNData();
  return (
    <div>
      <ChatDisclaimer />
      <ChatView convos={clinicConvosMeta(D.CONVERSATIONS)} me="clinic" layout="split" store={store} setStore={setStore} />
    </div>
  );
}

function AppointmentsPanel({ apptsByDate, today, onStatus, onComplete }) {
  return (
    <div className="stack-5">
      <div className="notice notice-warn">
        <span className="ni"><VNIcon.alert s={16} /></span>
        <div>Keine medizinische Beratung. Bei akuten Notfällen bitte immer telefonisch Kontakt aufnehmen.</div>
      </div>
      <CalendarPanel apptsByDate={apptsByDate} today={today} onStatus={onStatus} onComplete={onComplete} />
    </div>
  );
}

function ProfilePanel({ s }) {
  const serviceRows = [
    ['emergency', 'Notfälle'], ['regular', 'Normale Termine'], ['euthanasia', 'Einschläferung'],
    ['housecall', 'Hausbesuche'], ['cat', 'Katzen'], ['dog', 'Hunde'], ['small', 'Kleintiere'],
  ];
  const setHour = (i, k, v) => s.setHoursWeek((w) => w.map((h, j) => j === i ? { ...h, [k]: v } : h));
  const toggleClosed = (i) => s.setHoursWeek((w) => w.map((h, j) => j === i ? { ...h, closed: !h.closed } : h));

  const [tName, setTName] = React.useState('');
  const [tRole, setTRole] = React.useState('');
  const [tSpec, setTSpec] = React.useState('');
  const addMember = () => {
    if (!tName.trim()) { toast('Bitte Namen eingeben.', 'error'); return; }
    s.setTeam((t) => [...t, { name: tName.trim(), role: tRole.trim() || 'Tierärztl. Team', specialty: tSpec.trim() }]);
    setTName(''); setTRole(''); setTSpec(''); toast('Teammitglied hinzugefügt.', 'success');
  };
  const notifRows = [
    ['email', 'E-Mail', 'Zusammenfassungen & wichtige Hinweise', 'mail'],
    ['push', 'Push (App)', 'Neue Nachrichten & Termin-Anfragen', 'phone'],
    ['desktop', 'Desktop', 'Browser-Benachrichtigungen am PC', 'building'],
    ['extension', 'Chrome Extension', 'Status- & Termin-Hinweise im Browser', 'shield'],
  ];

  return (
    <div className="d-grid-2">
      {/* LEFT */}
      <div className="stack-5">
        <div className="card card-pad">
          <div className="section-label" style={{ marginBottom: 14 }}>Praxisdaten</div>
          <div className="stack-4">
            <div className="field"><label>Praxisname</label><input className="input" defaultValue={s.me.name} /></div>
            <div className="field"><label>Adresse</label><input className="input" defaultValue={s.me.address} /></div>
            <div className="field"><label>Bezirk</label>
              <select className="selectbox" defaultValue={s.me.district}>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select>
            </div>
            <div className="field">
              <label>Über uns / Wofür unsere Praxis besonders geeignet ist</label>
              <textarea className="textarea" value={s.about} onChange={(e) => s.setAbout(e.target.value)} style={{ minHeight: 100 }}
                placeholder="z. B. Wir sind besonders erfahren bei Chirurgie, Zahnsanierungen und älteren Katzen." />
              <span className="vn-meta">Dieser Text erscheint auf Ihrer öffentlichen Praxisseite.</span>
            </div>
            <div className="field"><label>Notfallhinweis</label><textarea className="textarea" value={s.note} onChange={(e) => s.setNote(e.target.value)} style={{ minHeight: 72 }} /></div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="row gap-2" style={{ marginBottom: 14 }}>
            <div className="section-label">Öffnungszeiten</div>
            <Tooltip text="Strukturierte Zeiten pro Wochentag. „Geschlossen“ blendet die Zeitfelder aus." />
          </div>
          <div className="hours-grid">
            {s.hoursWeek.map((h, i) => (
              <div className="hours-row" key={h.day}>
                <span className="hr-day">{h.day}</span>
                {h.closed
                  ? <span className="hr-closed-label">Geschlossen</span>
                  : <React.Fragment>
                      <input className="input" value={h.open} onChange={(e) => setHour(i, 'open', e.target.value)} aria-label={h.day + ' von'} />
                      <input className="input" value={h.close} onChange={(e) => setHour(i, 'close', e.target.value)} aria-label={h.day + ' bis'} />
                    </React.Fragment>}
                <button className="hr-toggle" onClick={() => toggleClosed(i)}>
                  <Switch on={!h.closed} /> {h.closed ? 'Geschlossen' : 'Geöffnet'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-label" style={{ marginBottom: 12 }}>Leistungen &amp; Tierarten</div>
          <div className="toggle-list">
            {serviceRows.map(([k, label]) => (
              <button key={k} className="toggle-item" onClick={() => s.setServices((x) => ({ ...x, [k]: !x[k] }))} style={{ width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid var(--line-2)' }}>
                <span className="tl-name">{label}</span>
                <Switch on={s.services[k]} />
              </button>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <div className="row gap-2" style={{ marginBottom: 6 }}>
            <div className="section-label">Spezialgebiete &amp; Zusatzleistungen</div>
            <Tooltip text="Fachgebiete, in denen Ihre Praxis besondere Erfahrung hat. Sie erscheinen auf Ihrer Praxis-Karte und sind für Tierhalter:innen filterbar." />
          </div>
          <div className="vn-meta" style={{ marginBottom: 12 }}>Mehrfachauswahl möglich.</div>
          <div className="check-grid">
            {SPECIALTIES.map((sp) => (
              <button key={sp.key} className={'check-tile' + (s.specialties[sp.key] ? ' is-on' : '')} onClick={() => s.setSpecialties((x) => ({ ...x, [sp.key]: !x[sp.key] }))}>
                <span className="box"><VNIcon.check s={13} /></span>{sp.label}
              </button>
            ))}
          </div>
          <input className="input" style={{ marginTop: 10 }} value={s.specialtiesOther} onChange={(e) => s.setSpecialtiesOther(e.target.value)} placeholder="Sonstige / weitere Spezialgebiete" />
        </div>
      </div>

      {/* RIGHT */}
      <div className="stack-5">
        <div className="card card-pad">
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="section-label">Verifizierung</div>
            <VerifyBadge status={s.verification} />
          </div>
          <p className="vn-text">
            {s.verification === 'verified'
              ? 'Ihre Praxis wurde von VetNow geprüft und als verifiziert markiert. Verifizierte Praxen werden in der Suche hervorgehoben.'
              : s.verification === 'pending'
                ? 'Ihre Verifizierung wird derzeit geprüft. Das dauert in der Regel 1–2 Werktage.'
                : 'Lassen Sie Ihre Praxis verifizieren, um Vertrauen zu schaffen und in der Suche hervorgehoben zu werden.'}
          </p>
          {s.verification !== 'verified' && (
            <button className="btn btn-secondary btn-block" style={{ marginTop: 12 }}
              onClick={() => { s.setVerification('pending'); toast('Verifizierung angefragt.', 'success'); }}
              disabled={s.verification === 'pending'}>
              {s.verification === 'pending' ? 'Verifizierung läuft …' : 'Verifizierung anfragen'}
            </button>
          )}
        </div>

        <div className="card card-pad">
          <div className="row gap-2" style={{ marginBottom: 12 }}>
            <div className="section-label">Team / Ärzt:innen</div>
            <Tooltip text="Legen Sie Teammitglieder mit Rolle und Spezialgebiet an. Optional." />
          </div>
          <div className="stack-3">
            {s.team.map((t, i) => (
              <div className="team-item" key={i}>
                <span className="team-av">{t.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="team-name">{t.name}</div>
                  <div className="team-role">{t.role}{t.specialty ? ' · ' + t.specialty : ''}</div>
                </div>
                <button className="team-del" onClick={() => s.setTeam((x) => x.filter((_, j) => j !== i))} aria-label="Entfernen"><VNIcon.x s={16} /></button>
              </div>
            ))}
          </div>
          <div className="stack-3" style={{ marginTop: 14 }}>
            <input className="input" value={tName} onChange={(e) => setTName(e.target.value)} placeholder="Name (z. B. Dr. Anna Drautal)" />
            <div className="btn-row">
              <input className="input" value={tRole} onChange={(e) => setTRole(e.target.value)} placeholder="Rolle" />
              <input className="input" value={tSpec} onChange={(e) => setTSpec(e.target.value)} placeholder="Spezialgebiet" />
            </div>
            <button className="btn btn-secondary btn-block" onClick={addMember}><VNIcon.plus s={16} /> Mitglied hinzufügen</button>
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-label" style={{ marginBottom: 6 }}>Benachrichtigungen</div>
          <div className="vn-meta" style={{ marginBottom: 6 }}>Wo möchten Sie über Nachrichten, Anfragen und Status erinnert werden?</div>
          {notifRows.map(([k, title, sub, icon]) => {
            const I = VNIcon[icon];
            return (
              <button key={k} className="notif-row" onClick={() => s.setNotifs((n) => ({ ...n, [k]: !n[k] }))} style={{ width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid var(--line-2)', background: 'none' }}>
                <span className="notif-ic"><I s={18} /></span>
                <span className="nr-main">
                  <span className="nr-title" style={{ display: 'block' }}>{title}</span>
                  <span className="nr-sub" style={{ display: 'block' }}>{sub}</span>
                </span>
                <Switch on={s.notifs[k]} />
              </button>
            );
          })}
        </div>

        <button className="btn btn-primary btn-lg btn-block" onClick={() => toast('Profil gespeichert.', 'success')}>Änderungen speichern</button>
      </div>
    </div>
  );
}

/* ---- Scrollable tab bar ---- */
export function TabBar({ tabs, tab, setTab }) {
  const ref = React.useRef(null);
  const [scrollable, setScrollable] = React.useState(false);
  const check = () => { const el = ref.current; if (!el) return; setScrollable(el.scrollWidth - el.scrollLeft - el.clientWidth > 8); };
  React.useEffect(() => { check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);
  return (
    <div className={'tab-wrap' + (scrollable ? ' scrollable' : '')}>
      <div className="tabbar" ref={ref} onScroll={check}>
        {tabs.map((t) => {
          const I = VNIcon[t.icon];
          return (
            <button key={t.key} className={tab === t.key ? 'is-on' : ''} onClick={() => setTab(t.key)}>
              <I s={17} /> {t.label}
              {t.pill > 0 && <span className="pill">{t.pill}</span>}
            </button>
          );
        })}
      </div>
      <button className="tab-arrow" aria-label="Mehr Tabs" onClick={() => { ref.current.scrollBy({ left: 160, behavior: 'smooth' }); }}><VNIcon.chevronR s={16} /></button>
    </div>
  );
}

/* ---------- Dashboard shell with tabs ---------- */
export function ScreenDashboard({ nav }) {
  const D = useVNData();
  const me = D.PRACTICES[0];
  if (!me) {
    return (
      <div className="vn-page"><div className="vn-page-wide d-narrow">
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <h2 className="vn-h2">Keine Praxis vorhanden</h2>
          <p className="vn-text" style={{ marginTop: 8 }}>Die Demo-Praxis ist ausgeblendet (Testdaten sind deaktiviert).</p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 14 }} onClick={() => nav && nav('home')}>Zur Startseite</button>
        </div>
      </div></div>
    );
  }
  return <DashboardInner D={D} me={me} />;
}

function DashboardInner({ D, me }) {
  const DURATION = 24 * 3600 * 1000;
  const [tab, setTab] = React.useState('status');
  const [picked, setPicked] = React.useState('green');
  const [expiry, setExpiry] = React.useState(() => Date.now() + DURATION);
  const [now, setNow] = React.useState(Date.now());
  const [note, setNote] = React.useState(me.emergency);
  const [hours, setHours] = React.useState(me.hoursShort);
  const [services, setServices] = React.useState({ emergency: true, regular: true, euthanasia: false, housecall: true, cat: true, dog: true, small: true });
  const [specialties, setSpecialties] = React.useState(() => Object.fromEntries((me.specialties || []).map((k) => [k, true])));
  const [specialtiesOther, setSpecialtiesOther] = React.useState('');
  const [absence, setAbsence] = React.useState({ active: false, from: '', to: '', vertretung: '' });
  const [convoStore, setConvoStore] = React.useState(() => Object.fromEntries(D.CONVERSATIONS.map((c) => [c.id, c.messages])));
  const [appts, setAppts] = React.useState(() => {
    const m = {}; Object.entries(D.APPTS_BY_DATE).forEach(([k, v]) => { m[k] = v.map((a) => ({ ...a })); }); return m;
  });
  const cp = D.CLINIC_PROFILE;
  const [about, setAbout] = React.useState(cp.about);
  const [verification, setVerification] = React.useState(cp.verification);
  const [hoursWeek, setHoursWeek] = React.useState(cp.hoursWeek.map((h) => ({ ...h })));
  const [team, setTeam] = React.useState(cp.team.map((t) => ({ ...t })));
  const [notifs, setNotifs] = React.useState({ ...cp.notifications });

  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const setApptStatus = (dateIso, idx, status) => setAppts((m) => ({ ...m, [dateIso]: m[dateIso].map((a, i) => i === idx ? { ...a, status } : a) }));
  const completeAppt = (dateIso, idx, noteText) => {
    setAppts((m) => ({ ...m, [dateIso]: (m[dateIso] || []).map((a, i) => i === idx ? { ...a, status: 'done', note: noteText } : a) }));
    const a = (appts[dateIso] || [])[idx];
    if (a && a.convoId) {
      setConvoStore((s) => ({ ...s, [a.convoId]: [...(s[a.convoId] || []), { type: 'note', text: noteText, time: 'jetzt' }] }));
    }
  };

  const active = expiry && now < expiry;
  const remaining = Math.max(0, expiry - now);
  const s = {
    me, DURATION, picked, setPicked, expiry, setExpiry, active, remaining,
    hh: Math.floor(remaining / 3600000), mm: Math.floor((remaining % 3600000) / 60000), ss: Math.floor((remaining % 60000) / 1000),
    expiryStr: new Date(expiry).toLocaleString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    note, setNote, hours, setHours, services, setServices,
    specialties, setSpecialties, specialtiesOther, setSpecialtiesOther, absence, setAbsence,
    about, setAbout, verification, setVerification, hoursWeek, setHoursWeek, team, setTeam, notifs, setNotifs,
  };
  const liveStatus = absence.active ? 'red' : (active ? picked : 'grey');
  const unread = D.CONVERSATIONS.reduce((n, c) => n + c.unread, 0);

  const tabs = [
    { key: 'status', label: 'Status', icon: 'siren' },
    { key: 'messages', label: 'Nachrichten', icon: 'chat', pill: unread },
    { key: 'appts', label: 'Termine', icon: 'cal' },
    { key: 'profile', label: 'Profil', icon: 'building' },
  ];

  return (
    <div className="vn-page">
      <div className="vn-page-wide stack-5">
        <div className="card card-pad">
          <div className="row between gap-3" style={{ flexWrap: 'wrap' }}>
            <div>
              <div className="vn-meta">Praxis-Dashboard</div>
              <h2 className="vn-h2" style={{ marginTop: 4 }}>{me.name}</h2>
              <div className="kv" style={{ marginTop: 8 }}><VNIcon.pin s={15} /> {me.address}</div>
              <div style={{ marginTop: 10 }}><VerifyBadge status={verification} /></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="vn-meta" style={{ marginBottom: 8 }}>Aktuell sichtbar als</div>
              <StatusBadge status={liveStatus} />
            </div>
          </div>
          {absence.active && (
            <div className="vertretung-note" style={{ marginTop: 14 }}>
              <span style={{ flex: 'none', marginTop: 1 }}><VNIcon.sun s={16} /></span>
              <div>Abwesenheit aktiv{absence.from ? ' (' + absence.from + ' – ' + absence.to + ')' : ''} — Sie erscheinen als <strong>„Heute nicht verfügbar“</strong>{absence.vertretung ? <>. Vertretung: <strong>{absence.vertretung}</strong></> : null}.</div>
            </div>
          )}
        </div>

        <TabBar tabs={tabs} tab={tab} setTab={setTab} />

        <div>
          {tab === 'status' && <StatusPanel s={s} />}
          {tab === 'messages' && <MessagesPanel store={convoStore} setStore={setConvoStore} />}
          {tab === 'appts' && <AppointmentsPanel apptsByDate={appts} today={D.TODAY_ISO} onStatus={setApptStatus} onComplete={completeAppt} />}
          {tab === 'profile' && <ProfilePanel s={s} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- Tierhalter: Meine Anfragen / Nachrichten ---------- */
export function ScreenOwnerMessages() {
  const D = useVNData();
  const ownerConvos = D.OWNER_CONVERSATIONS;
  return (
    <div className="vn-page">
      <div className="vn-page-wide d-narrow stack-4">
        <div>
          <h2 className="vn-h2">Meine Nachrichten</h2>
          <p className="vn-text" style={{ marginTop: 6 }}>Ihre Anfragen und Konversationen mit Praxen.</p>
        </div>
        <ChatDisclaimer />
        {ownerConvos.length === 0
          ? <div className="card card-pad" style={{ textAlign: 'center' }}><p className="vn-text">Noch keine Nachrichten vorhanden.</p></div>
          : <ChatView convos={ownerConvos} me="owner" layout="stack" feedback />}
      </div>
    </div>
  );
}

/* ---------- Chrome-Extension: siehe screens-ext.jsx (ScreenExtension) ---------- */

