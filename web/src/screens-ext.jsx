/* VetNow — Screens EXT: Chrome-Extension Mini-App für Praxen
   Eigenständige Mini-Arbeitsoberfläche: Status, Termine (mit Tageswechsel
   & Notiz), Nachrichten (lesen + schnell antworten). */

import React from 'react';
import { VNIcon, AnimalGlyph, toast } from './components.jsx';
import { useVNData } from './lib/adminContext.jsx';

  const pad = (n) => String(n).padStart(2, '0');
  const parseISO = (iso) => new Date(iso + 'T00:00:00');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return ymd(d); };
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  export function ScreenExtension({ nav }) {
    const D = useVNData();
    const DURATION = 24 * 3600 * 1000;
    const [view, setView] = React.useState('status'); // status | appts | messages
    const [picked, setPicked] = React.useState('green');
    const [expiry, setExpiry] = React.useState(() => Date.now() + DURATION);
    const [now, setNow] = React.useState(Date.now());
    const [appts, setAppts] = React.useState(() => {
      const m = {}; Object.entries(D.APPTS_BY_DATE).forEach(([k, v]) => { m[k] = v.map((a) => ({ ...a })); }); return m;
    });
    const [dayIso, setDayIso] = React.useState(D.TODAY_ISO);
    const [openAppt, setOpenAppt] = React.useState(null);
    const [noteMode, setNoteMode] = React.useState(false);
    const [noteText, setNoteText] = React.useState('');
    const [convoStore, setConvoStore] = React.useState(() => Object.fromEntries(D.CONVERSATIONS.map((c) => [c.id, c.messages.map((m) => ({ ...m }))])));
    const [unreadMap, setUnreadMap] = React.useState(() => Object.fromEntries(D.CONVERSATIONS.map((c) => [c.id, c.unread])));
    const [openChat, setOpenChat] = React.useState(null);
    const [draft, setDraft] = React.useState('');
    const scrollRef = React.useRef(null);

    React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
    React.useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [openChat, convoStore]);

    const active = expiry && now < expiry;
    const remaining = Math.max(0, expiry - now);
    const hh = Math.floor(remaining / 3600000), mm = Math.floor((remaining % 3600000) / 60000), ss = Math.floor((remaining % 60000) / 1000);
    const liveStatus = active ? picked : 'grey';
    const liveLabel = D.STATUS[liveStatus].label;
    const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);

    const dayList = appts[dayIso] || [];
    const dayLabel = (() => {
      const d = parseISO(dayIso);
      const rel = dayIso === D.TODAY_ISO ? 'Heute · ' : dayIso === addDays(D.TODAY_ISO, 1) ? 'Morgen · ' : '';
      return rel + WD[d.getDay()] + ', ' + pad(d.getDate()) + '. ' + D.MONTHS_DE[d.getMonth()].slice(0, 3);
    })();

    const setApptStatus = (idx, status) => setAppts((m) => ({ ...m, [dayIso]: m[dayIso].map((a, i) => i === idx ? { ...a, status } : a) }));
    const completeWithNote = (idx, text) => {
      const a = (appts[dayIso] || [])[idx];
      setAppts((m) => ({ ...m, [dayIso]: m[dayIso].map((x, i) => i === idx ? { ...x, status: 'done', note: text } : x) }));
      if (a && a.convoId) setConvoStore((s) => ({ ...s, [a.convoId]: [...(s[a.convoId] || []), { type: 'note', text, time: 'jetzt' }] }));
      toast('Termin abgeschlossen, Notiz gesendet.', 'success');
    };

    const animalIcon = (a, sz) => <AnimalGlyph animal={a} s={sz} />;

    const statusOpts = [
      { key: 'green', cls: 'on-green', label: 'Erreichbar', c: 'green' },
      { key: 'yellow', cls: 'on-yellow', label: 'Rücksprache', c: 'yellow' },
      { key: 'red', cls: 'on-red', label: 'Nicht da', c: 'red' },
    ];

    // ---- STATUS VIEW ----
    const statusView = (
      <React.Fragment>
        <div>
          <div className="ext-section-h" style={{ marginBottom: 8 }}>Heutiger Status</div>
          <div className="ext-status-row">
            {statusOpts.map((o) => (
              <button key={o.key} className={'ext-status-btn ' + o.cls + (picked === o.key ? ' is-on' : '')}
                onClick={() => { setPicked(o.key); setExpiry(Date.now() + DURATION); toast('Status: ' + o.label, 'success'); }}>
                <span className="d" style={{ background: 'var(--' + o.c + ')' }}></span>{o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ext-countdown">
          <div>
            <div className="ec-lab">{active ? 'Läuft ab in' : 'Status abgelaufen'}</div>
            <div className="ec-time">{active ? pad(hh) + ':' + pad(mm) + ':' + pad(ss) : '00:00:00'}</div>
          </div>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }}
            onClick={() => { setExpiry(Date.now() + DURATION); toast('Status um 24 Stunden verlängert.', 'success'); }}>
            <VNIcon.refresh s={15} /> Verlängern
          </button>
        </div>

        <div className="notice notice-info" style={{ fontSize: 12.5 }}>
          <span className="ni"><VNIcon.info s={15} /></span>
          <div>Erinnerungen pausieren außerhalb der Öffnungszeiten und während Abwesenheiten.</div>
        </div>
      </React.Fragment>
    );

    // ---- APPTS VIEW ----
    const apptDetail = openAppt != null && dayList[openAppt] ? (() => {
      const a = dayList[openAppt]; const st = D.APPT_STATUS[a.status];
      return (
        <React.Fragment>
          <button className="ext-back" onClick={() => { setOpenAppt(null); setNoteMode(false); }}><VNIcon.back s={16} /> Termine</button>
          <div className="card card-pad" style={{ padding: 14 }}>
            <div className="row gap-3" style={{ marginBottom: 10 }}>
              <span className="appt-icon">{animalIcon(a.animal, 20)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{a.name}</div>
                <div className="vn-meta">{a.time} · {D.ANIMAL_LABEL[a.animal]}</div>
              </div>
              <span className={'appt-tag ' + st.cls}>{a.status === 'done' && <VNIcon.check s={12} />}{st.label}</span>
            </div>
            <div className="kv" style={{ marginBottom: a.note ? 10 : 0 }}><VNIcon.siren s={14} /> {a.reason}</div>
            {a.note && <div className="note-box" style={{ fontSize: 12.5 }}><span className="note-ic"><VNIcon.note s={15} /></span><div><div className="note-label">Abschlussnotiz</div>{a.note}</div></div>}
          </div>

          {!noteMode ? (
            <React.Fragment>
              <div className="status-actions">
                <button className="btn btn-secondary" onClick={() => { setApptStatus(openAppt, 'confirmed'); toast('Termin bestätigt.', 'success'); }}><VNIcon.check s={15} /> Best.</button>
                <button className="btn btn-primary" onClick={() => { setNoteText('Behandlung verlief gut, bitte weiter beobachten.'); setNoteMode(true); }}><VNIcon.checkCircle s={15} /> Abschl.</button>
                <button className="btn btn-secondary" style={{ color: 'var(--red-ink)' }} onClick={() => { setApptStatus(openAppt, 'cancelled'); toast('Termin abgesagt.', 'info'); setOpenAppt(null); }}><VNIcon.x s={15} /> Absage</button>
              </div>
            </React.Fragment>
          ) : (
            <div>
              <div className="ext-section-h" style={{ marginBottom: 6 }}>Notiz für Tierhalter:in</div>
              <textarea className="textarea" value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{ minHeight: 80, fontSize: 13.5 }} />
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setNoteMode(false)}>Zurück</button>
                <button className="btn btn-primary btn-sm" onClick={() => { if (!noteText.trim()) { toast('Bitte Notiz eingeben.', 'error'); return; } completeWithNote(openAppt, noteText.trim()); setNoteMode(false); setOpenAppt(null); }}><VNIcon.send s={14} /> Senden</button>
              </div>
            </div>
          )}
        </React.Fragment>
      );
    })() : null;

    const apptsView = openAppt != null ? apptDetail : (
      <React.Fragment>
        <div className="ext-daynav">
          <button className="cal-iconbtn" onClick={() => setDayIso((d) => addDays(d, -1))}><VNIcon.back s={16} /></button>
          <span className="dn-label">{dayLabel}</span>
          <button className="cal-iconbtn" onClick={() => setDayIso((d) => addDays(d, 1))}><VNIcon.chevronR s={16} /></button>
        </div>
        {dayList.length === 0 ? (
          <div className="cal-empty-day" style={{ padding: '24px 8px' }}><div className="ce-ic"><VNIcon.cal s={20} /></div><p className="vn-text">Keine Termine an diesem Tag.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayList.map((a, i) => {
              const st = D.APPT_STATUS[a.status];
              return (
                <button key={i} className="ext-item" onClick={() => { setOpenAppt(i); setNoteMode(false); }}>
                  <span className="ei-time">{a.time}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="ei-name" style={{ display: 'block' }}>{a.name}</span>
                    <span className="ei-sub" style={{ display: 'block' }}>{a.reason}</span>
                  </span>
                  <span className={'appt-tag ' + st.cls}>{st.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </React.Fragment>
    );

    // ---- MESSAGES VIEW ----
    const meta = (id) => D.CONVERSATIONS.find((c) => c.id === id);
    const sendReply = (text) => {
      if (!text.trim() || !openChat) return;
      setConvoStore((s) => ({ ...s, [openChat]: [...(s[openChat] || []), { from: 'clinic', text: text.trim(), time: 'jetzt' }] }));
      setDraft(''); toast('Antwort gesendet.', 'success');
    };
    const chatDetail = openChat ? (() => {
      const c = meta(openChat); const msgs = convoStore[openChat] || [];
      return (
        <React.Fragment>
          <button className="ext-back" onClick={() => setOpenChat(null)}><VNIcon.back s={16} /> Nachrichten</button>
          <div className="row gap-3" style={{ paddingBottom: 4 }}>
            <span className="convo-avatar" style={{ width: 34, height: 34 }}>{animalIcon(c.animal, 16)}</span>
            <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.owner}</div><div className="vn-meta">{D.ANIMAL_LABEL[c.animal]}</div></div>
          </div>
          <div className="ext-chat-scroll" ref={scrollRef}>
            {msgs.map((m, i) => m.type === 'note' ? (
              <div key={i} className="note-box" style={{ fontSize: 12.5 }}><span className="note-ic"><VNIcon.note s={15} /></span><div><div className="note-label">Abschlussnotiz</div>{m.text}</div></div>
            ) : m.type === 'image' ? (
              <div key={i} className={'ext-bubble-row' + (m.from === 'clinic' ? ' me' : '')}>
                <div><div className="ext-bubble-img"><img src={m.src} alt="Anhang" /></div><div className="ext-btime">{m.time}</div></div>
              </div>
            ) : (
              <div key={i} className={'ext-bubble-row' + (m.from === 'clinic' ? ' me' : '')}>
                <div><div className={'ext-bubble ' + m.from}>{m.text}</div><div className="ext-btime">{m.time}</div></div>
              </div>
            ))}
          </div>
          <div className="ext-quickreplies">
            {['Gerne, kommen Sie vorbei.', 'Bitte kurz anrufen.', 'Wir melden uns gleich.'].map((q) => (
              <button key={q} className="ext-qr" onClick={() => sendReply(q)}>{q}</button>
            ))}
          </div>
          <div className="ext-compose">
            <input className="input" value={draft} placeholder="Antwort schreiben …" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendReply(draft)} />
            <button className="chat-send" onClick={() => sendReply(draft)} aria-label="Senden"><VNIcon.send s={16} /></button>
          </div>
        </React.Fragment>
      );
    })() : null;

    const messagesView = openChat ? chatDetail : (
      <React.Fragment>
        <div className="ext-section-h" style={{ marginBottom: 4 }}><span>Konversationen</span>{totalUnread > 0 && <span className="vn-meta">{totalUnread} ungelesen</span>}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {D.CONVERSATIONS.map((c) => {
            const msgs = convoStore[c.id] || []; const last = msgs[msgs.length - 1];
            const lastText = last ? (last.type === 'note' ? 'Abschlussnotiz' : last.type === 'image' ? '📷 Bild' : last.text) : '';
            return (
              <button key={c.id} className="ext-item" onClick={() => { setOpenChat(c.id); setUnreadMap((u) => ({ ...u, [c.id]: 0 })); }}>
                <span className="convo-avatar" style={{ width: 34, height: 34 }}>{animalIcon(c.animal, 16)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="ei-name" style={{ display: 'block' }}>{c.owner}</span>
                  <span className="ei-sub" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lastText}</span>
                </span>
                {unreadMap[c.id] > 0 && <span className="unread-dot">{unreadMap[c.id]}</span>}
              </button>
            );
          })}
        </div>
      </React.Fragment>
    );

    return (
      <div className="ext-stage">
        <div className="ext-pop">
          <div className="ext-head">
            <span className="vn-brand-mark" style={{ width: 30, height: 30 }}><VNIcon.paw2 s={17} /></span>
            <span className="vn-brand-name">VetNow <span className="reg" style={{ color: 'var(--teal-600)' }}>Kärnten</span></span>
            <span className={'ext-status-mini ' + liveStatus}><span className="d" style={{ background: 'var(--' + (liveStatus === 'grey' ? 'grey' : liveStatus) + ')' }}></span>{liveLabel}</span>
          </div>

          <div className="ext-body">
            {view === 'status' && statusView}
            {view === 'appts' && apptsView}
            {view === 'messages' && messagesView}
            <div className="ext-divider"></div>
            <button className="btn btn-ghost btn-sm btn-block" onClick={() => nav('dashboard')}>Vollansicht öffnen <VNIcon.chevronR s={14} /></button>
          </div>

          <div className="ext-nav">
            <button className={view === 'status' ? 'is-on' : ''} onClick={() => setView('status')}><VNIcon.siren s={20} /> Status</button>
            <button className={view === 'appts' ? 'is-on' : ''} onClick={() => { setView('appts'); setOpenAppt(null); }}><VNIcon.cal s={20} /> Termine</button>
            <button className={view === 'messages' ? 'is-on' : ''} onClick={() => { setView('messages'); setOpenChat(null); }}>
              <span style={{ position: 'relative', display: 'grid', placeItems: 'center' }}><VNIcon.chat s={20} />{totalUnread > 0 && <span className="en-badge">{totalUnread}</span>}</span> Nachrichten
            </button>
          </div>
        </div>
      </div>
    );
  }

