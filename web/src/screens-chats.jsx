/* VetNow — Chats (Web): freie Chats mit Labels/Farben/Icons.
   Liste mit Label-Filter, Erstellen/Bearbeiten, Anpinnen, Löschen,
   Label-Verwaltung, Einstellungen und Thread-Ansicht. */
import React from 'react';
import { VNIcon, Switch, toast } from './components.jsx';
import { CHAT_ROLES } from './data.js';
import { aiChat, vetSystemPrompt, toAiMessages, shrinkImage } from './lib/ai.js';
import { botConversationReply, botGreetingText, botImageReply } from './bot.js';
import { useChats } from './lib/chats.jsx';
import { useAdmin } from './lib/adminContext.jsx';

/* Welche Chat-Rubriken darf die angemeldete Rolle sehen und anlegen?
   Muss zum Filter in lib/chats.jsx passen. */
export function rolesForAuth(auth) {
  if (!auth || !auth.role) return [];
  return auth.role === 'owner' ? ['owner'] : ['clinic', 'network'];
}

const PALETTE = ['#0f9b8e', '#0c7d72', '#2e6f9e', '#16a34a', '#e3a008', '#dc2626', '#8a5d05', '#6c7d79', '#7c3aed', '#db2777'];
const ICON_CHOICES = ['chat', 'paw2', 'dog', 'cat', 'rabbit', 'horse', 'bird', 'turtle', 'siren', 'cal', 'building', 'shield', 'heart', 'star', 'phone', 'note', 'home', 'cross', 'mail', 'user'];

function Icon({ name, s, c }) {
  const I = VNIcon[name] || VNIcon.chat;
  return <I s={s} c={c} />;
}

/* ---------- Farb- & Icon-Picker ---------- */
function ColorPicker({ value, onChange }) {
  return (
    <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
      {PALETTE.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)}
          style={{ width: 30, height: 30, borderRadius: 8, background: c, border: value === c ? '3px solid var(--ink)' : '2px solid var(--line)', cursor: 'pointer' }}
          aria-label={c} />
      ))}
    </div>
  );
}
function IconPicker({ value, color, onChange }) {
  return (
    <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
      {ICON_CHOICES.map((name) => (
        <button key={name} type="button" onClick={() => onChange(name)}
          style={{ width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', cursor: 'pointer',
            background: value === name ? (color || 'var(--teal-600)') : 'var(--surface-3)',
            border: '1px solid var(--line)' }}>
          <Icon name={name} s={18} c={value === name ? '#fff' : 'var(--ink-2)'} />
        </button>
      ))}
    </div>
  );
}

/* ---------- Modal-Hülle ---------- */
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="vn-modal-bg" onClick={onClose}>
      <div className="vn-modal" style={{ maxWidth: wide ? 560 : 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <h3 className="vn-h3">{title}</h3>
          <button className="vn-back" style={{ width: 36, height: 36 }} onClick={onClose}><VNIcon.x s={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Chat-Editor (neu / bearbeiten) ---------- */
function ChatEditor({ initial, labels, roles, onSave, onClose }) {
  const choices = CHAT_ROLES.filter((r) => !roles || roles.includes(r.key));
  const [f, setF] = React.useState(() => ({
    title: initial?.title || '', sub: initial?.sub || '', role: initial?.role || (choices[0] ? choices[0].key : 'owner'),
    color: initial?.color || '#0f9b8e', icon: initial?.icon || 'chat', animal: initial?.animal || 'other',
    labels: initial?.labels ? [...initial.labels] : [],
  }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const toggleLabel = (id) => set('labels', f.labels.includes(id) ? f.labels.filter((x) => x !== id) : [...f.labels, id]);
  const submit = () => {
    if (!f.title.trim()) { toast('Bitte einen Namen eingeben.', 'error'); return; }
    onSave(f);
  };
  return (
    <Modal title={initial ? 'Chat bearbeiten' : 'Neuer Chat'} onClose={onClose}>
      <div className="stack-4">
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          <span style={{ width: 48, height: 48, borderRadius: 14, background: f.color, display: 'grid', placeItems: 'center', flex: 'none' }}>
            <Icon name={f.icon} s={24} c="#fff" />
          </span>
          <div style={{ flex: 1 }}>
            <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Name des Chats (z. B. Familie Berger)" />
          </div>
        </div>
        <div className="field"><label>Untertitel</label>
          <input className="input" value={f.sub} onChange={(e) => set('sub', e.target.value)} placeholder="z. B. Balu (Hund) · Notfall" />
        </div>
        <div className="field"><label>Bereich</label>
          <div className="choice-grid cols-3">
            {choices.map((r) => (
              <button key={r.key} type="button" className={'choice' + (f.role === r.key ? ' is-on' : '')} onClick={() => set('role', r.key)}>
                {r.label}{f.role === r.key && <VNIcon.check s={16} />}
              </button>
            ))}
          </div>
        </div>
        <div className="field"><label>Farbe</label><ColorPicker value={f.color} onChange={(v) => set('color', v)} /></div>
        <div className="field"><label>Icon</label><IconPicker value={f.icon} color={f.color} onChange={(v) => set('icon', v)} /></div>
        {labels.length > 0 && (
          <div className="field"><label>Labels</label>
            <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
              {labels.map((l) => {
                const on = f.labels.includes(l.id);
                return (
                  <button key={l.id} type="button" onClick={() => toggleLabel(l.id)}
                    className="tag" style={{ borderColor: on ? l.color : 'var(--line-2)', background: on ? l.color + '22' : 'var(--surface-3)', color: on ? l.color : 'var(--ink-2)', cursor: 'pointer' }}>
                    <Icon name={l.icon} s={13} c={on ? l.color : 'var(--ink-3)'} /> {l.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <button className="btn btn-primary btn-lg btn-block" onClick={submit}>{initial ? 'Speichern' : 'Chat erstellen'}</button>
      </div>
    </Modal>
  );
}

/* ---------- Label-Verwaltung ---------- */
function LabelManager({ labels, onClose, createLabel, updateLabel, deleteLabel }) {
  const [edit, setEdit] = React.useState(null); // labelId | 'new'
  const [f, setF] = React.useState({ name: '', color: '#0f9b8e', icon: 'tag' });
  const startNew = () => { setF({ name: '', color: '#7c3aed', icon: 'star' }); setEdit('new'); };
  const startEdit = (l) => { setF({ name: l.name, color: l.color, icon: l.icon }); setEdit(l.id); };
  const submit = () => {
    if (!f.name.trim()) { toast('Bitte einen Namen eingeben.', 'error'); return; }
    if (edit === 'new') { createLabel(f); toast('Label erstellt.', 'success'); }
    else { updateLabel(edit, f); toast('Label gespeichert.', 'success'); }
    setEdit(null);
  };
  return (
    <Modal title="Labels verwalten" onClose={onClose} wide>
      {edit ? (
        <div className="stack-4">
          <div className="row gap-3" style={{ alignItems: 'center' }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: f.color, display: 'grid', placeItems: 'center', flex: 'none' }}>
              <Icon name={f.icon} s={20} c="#fff" />
            </span>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Label-Name" style={{ flex: 1 }} />
          </div>
          <div className="field"><label>Farbe</label><ColorPicker value={f.color} onChange={(v) => setF({ ...f, color: v })} /></div>
          <div className="field"><label>Icon</label><IconPicker value={f.icon} color={f.color} onChange={(v) => setF({ ...f, icon: v })} /></div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setEdit(null)}>Zurück</button>
            <button className="btn btn-primary" onClick={submit}>Speichern</button>
          </div>
        </div>
      ) : (
        <div className="stack-3">
          {labels.length === 0 && <p className="vn-meta">Noch keine Labels. Erstelle dein erstes.</p>}
          {labels.map((l) => (
            <div key={l.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
              <div className="row gap-2">
                <span style={{ width: 30, height: 30, borderRadius: 8, background: l.color, display: 'grid', placeItems: 'center' }}><Icon name={l.icon} s={15} c="#fff" /></span>
                <span style={{ fontWeight: 600 }}>{l.name}</span>
              </div>
              <div className="row gap-2">
                <button className="btn btn-secondary btn-sm" onClick={() => startEdit(l)}><VNIcon.pencil s={14} /></button>
                <button className="btn btn-secondary btn-sm" onClick={() => { deleteLabel(l.id); toast('Label gelöscht.', 'info'); }} style={{ color: 'var(--red-ink)' }}><VNIcon.x s={14} /></button>
              </div>
            </div>
          ))}
          <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={startNew}><VNIcon.plus s={16} /> Neues Label</button>
        </div>
      )}
    </Modal>
  );
}

/* ---------- Einstellungen ---------- */
function ChatSettings({ settings, setSetting, onClose, resetSeed, clearAll }) {
  const rows = [
    ['showLabels', 'Labels & Filter anzeigen'],
    ['enableOwner', 'Bereich „Meine Tiere“'],
    ['enablePosteingang', 'Bereich „Praxis-Posteingang“'],
    ['enableNetwork', 'Bereich „Praxis-Netzwerk“'],
    ['showPinned', 'Angepinnte Chats oben'],
    ['autoSeed', 'Vorgefertigte Chats beim ersten Start'],
  ];
  return (
    <Modal title="Chat-Einstellungen" onClose={onClose}>
      <div className="stack-3">
        {rows.map(([k, label]) => (
          <button key={k} className="switch-row" onClick={() => setSetting(k, !settings[k])} style={{ width: '100%', textAlign: 'left' }}>
            <div style={{ flex: 1 }} className="section-label">{label}</div>
            <Switch on={settings[k]} />
          </button>
        ))}
        <div className="notice notice-info" style={{ marginTop: 4 }}>
          <span className="ni"><VNIcon.info s={16} /></span>
          <div>Alles wird lokal in diesem Browser gespeichert. Kein Konto, kein Server nötig.</div>
        </div>
        <div className="btn-row" style={{ marginTop: 4 }}>
          <button className="btn btn-secondary" onClick={() => { resetSeed(); toast('Vorlagen wiederhergestellt.', 'success'); onClose(); }}><VNIcon.refresh s={15} /> Vorlagen zurücksetzen</button>
          <button className="btn btn-secondary" onClick={() => { if (confirm('Wirklich alle Chats löschen?')) { clearAll(); toast('Alle Chats gelöscht.', 'info'); onClose(); } }} style={{ color: 'var(--red-ink)' }}>Alle löschen</button>
        </div>
      </div>
    </Modal>
  );
}

/* Kleines „…"-Menü je Nachricht — gleiches Markup wie das Menü in ChatRow. */
const REACTIONS = ['👍', '❤️', '😂', '😮'];
function MsgMenu({ mine, editable, onReact, onEdit, onDelete }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span style={{ position: 'relative' }}>
      <button className="vn-back" style={{ width: 26, height: 26, opacity: 0.75 }} onClick={() => setOpen((o) => !o)} aria-label="Nachrichten-Menü">…</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
          <div className="card card-pad" style={{ position: 'absolute', right: 0, top: 30, zIndex: 50, padding: 8, minWidth: 170, boxShadow: 'var(--sh-3)' }}>
            <div className="row gap-2" style={{ padding: '2px 4px 6px' }}>
              {REACTIONS.map((e) => (
                <button key={e} className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 16 }} onClick={() => { setOpen(false); onReact(e); }}>{e}</button>
              ))}
            </div>
            {mine && editable && <button className="btn btn-ghost btn-sm btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => { setOpen(false); onEdit(); }}><VNIcon.pencil s={15} /> Bearbeiten</button>}
            {mine && <button className="btn btn-ghost btn-sm btn-block" style={{ justifyContent: 'flex-start', color: 'var(--red-ink)' }} onClick={() => { setOpen(false); onDelete(); }}><VNIcon.x s={15} /> Löschen</button>}
          </div>
        </>
      )}
    </span>
  );
}

/* WhatsApp-Look: ein einziges kleines Badge, das auf der unteren Blasenkante
   sitzt (nicht als eigene Zeile darunter). Reagieren beide Seiten, stehen
   beide Emoji nebeneinander im selben Badge. */
function Reactions({ m, mine }) {
  const entries = Object.entries(m.reactions || {});
  if (!entries.length) return null;
  return (
    <span className={'reaction-badge ' + (mine ? 'on-right' : 'on-left')}>
      {entries.map(([side, emoji]) => <span key={side}>{emoji}</span>)}
    </span>
  );
}

/* Zeitzeile: Uhrzeit + optional „(bearbeitet)" + Herkunft der Antwort.
   `source` ist optional — alte Nachrichten zeigen wie bisher nur die Zeit. */
function messageStamp(m) {
  const src = m.source === 'ai-vision' ? ' · KI · Bild'
    : m.source === 'ai' ? ' · KI'
      : m.source === 'bot' ? ' · Bot'
        : m.source === 'error' ? ' · Hinweis' : '';
  return m.time + (m.editedAt ? ' · (bearbeitet)' : '') + src;
}

/* ---------- Thread ---------- */
function ChatThread({ chat, onBack, addMessage, labels, settings }) {
  const { editMessage, deleteMessage, toggleReaction } = useChats();
  const me = chat.role === 'owner' ? 'owner' : 'clinic';
  const other = me === 'owner' ? 'clinic' : 'owner';
  const [draft, setDraft] = React.useState('');
  const [pendingImg, setPendingImg] = React.useState(null);
  const [editIdx, setEditIdx] = React.useState(null); // Index der Nachricht im Bearbeiten-Modus
  const [typing, setTyping] = React.useState(false);
  const [attachMenu, setAttachMenu] = React.useState(false);
  const fileRef = React.useRef(null);
  const camRef = React.useRef(null);
  const docRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const handledRef = React.useRef('');
  const timersRef = React.useRef([]);
  const botTimersRef = React.useRef([]);
  React.useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [chat.messages.length, typing]);

  /* Mehrteilige Bot-Antworten nacheinander senden. Bewusst NICHT über
     timersRef: dessen Cleanup läuft schon beim nächsten Nachrichten-Update
     und würde die zweite Nachricht verschlucken. Diese Timer werden nur beim
     Chat-Wechsel/Verlassen abgeräumt. */
  const sendBotTexts = (targetId, from, texts) => {
    const list = (texts || []).filter(Boolean).slice(0, 3);
    if (!list.length) { setTyping(false); return; }
    list.forEach((tx, i) => {
      const t = setTimeout(() => {
        botTimersRef.current = botTimersRef.current.filter((x) => x !== t);
        if (i === 0) setTyping(false);
        addMessage(targetId, { from, text: tx, time: 'jetzt', source: 'bot' });
      }, 450 + i * 950);
      botTimersRef.current.push(t);
    });
  };
  React.useEffect(() => () => { botTimersRef.current.forEach(clearTimeout); botTimersRef.current = []; }, [chat.id]);

  // Auto-Antwort-Bot 2.0: reagiert, wenn die letzte Nachricht von MIR ist
  // (oder Chat leer → Begrüßung). Kann mehrteilige Antworten senden und
  // optional Ollama (über das Studio) als KI-Backend nutzen.
  React.useEffect(() => {
    if (!settings || !settings.botEnabled) return;
    const msgs = chat.messages;
    const last = msgs[msgs.length - 1];
    const sig = chat.id + ':' + msgs.length + ':' + (last ? last.from + last.type : 'empty');
    if (handledRef.current === sig) return;

    const isGreeting = msgs.length === 0 && settings.botGreeting;
    const isReply = last && last.from === me && last.type !== 'note';
    if (!isGreeting && !isReply) return;
    handledRef.current = sig;

    let alive = true;
    const practiceName = chat.role === 'owner' ? chat.title : 'Tierarztpraxis Drautal';

    // Zuerst die KI (Ollama über das Studio). Ist sie nicht erreichbar —
    // z. B. bei einer Vorführung ohne Netz —, übernimmt der eingebaute
    // Regel-Bot aus bot.js. Der Chat bleibt so nie stumm und zeigt nie eine
    // technische Fehlermeldung.
    (async () => {
      try {
        if (settings.botTyping) setTyping(true);
        const sys = { role: 'system', content: vetSystemPrompt(other, practiceName) };
        const history = isGreeting
          ? [sys, { role: 'user', content: '(Der Chat wurde gerade geöffnet — begrüße kurz und freundlich.)' }]
          : [sys, ...toAiMessages(msgs, other, null)];
        const r = await aiChat({ messages: history, model: settings.aiModel, aiBaseUrl: settings.aiBaseUrl });
        if (!alive) return;
        setTyping(false);
        addMessage(chat.id, { from: other, text: r.text, time: 'jetzt', source: r.vision ? 'ai-vision' : 'ai', aiModel: r.model });
      } catch (err) {
        if (!alive) return;
        /* Unterscheiden statt alles verschlucken: Ist die KI schlicht nicht
           erreichbar, übernimmt der Bot still (gut für die Vorführung).
           Ist aber das BILD das Problem, muss das sichtbar sein — sonst sieht
           man eine plausible Bot-Antwort und erfährt nie, dass das Foto nie
           angekommen ist. */
        if (err && err.visible) {
          setTyping(false);
          addMessage(chat.id, { from: other, text: '⚠️ ' + err.message, time: 'jetzt', source: 'error' });
          return;
        }
        let texts;
        if (isGreeting) texts = [botGreetingText(other, practiceName)];
        else if (last && last.type === 'image') texts = [botImageReply(other)];
        else texts = botConversationReply({ messages: msgs, userText: (last && last.text) || '', fromRole: other, practiceName }).texts;
        sendBotTexts(chat.id, other, texts);
      }
    })();

    return () => { alive = false; setTyping(false); timersRef.current.forEach(clearTimeout); timersRef.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.messages.length, chat.id, settings && settings.botEnabled]);

  const send = () => {
    if (editIdx != null) {
      if (!draft.trim()) { toast('Text darf nicht leer sein.', 'error'); return; }
      editMessage(chat.id, editIdx, draft.trim()); setEditIdx(null); setDraft(''); toast('Nachricht bearbeitet.', 'success'); return;
    }
    if (pendingImg) { addMessage(chat.id, { from: me, type: 'image', src: pendingImg, text: draft.trim(), time: 'jetzt' }); setPendingImg(null); setDraft(''); return; }
    if (!draft.trim()) return;
    addMessage(chat.id, { from: me, text: draft.trim(), time: 'jetzt' }); setDraft('');
  };
  const cancelEdit = () => { setEditIdx(null); setDraft(''); };
  const removeMsg = (i) => {
    if (!confirm('Diese Nachricht löschen?')) return;
    deleteMessage(chat.id, i); if (editIdx === i) cancelEdit(); toast('Nachricht gelöscht.', 'info');
  };
  /* Anhänge landen als Base64 im localStorage. Ohne Obergrenze sprengt schon
     ein PDF oder Video das Kontingent — und dann wären ALLE Chats weg. */
  const MAX_BYTES = 4 * 1024 * 1024;
  const onPickFile = async (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    /* Bilder werden VOR dem Speichern auf 1024 px heruntergerechnet — das spart
       Speicher UND ist die Voraussetzung dafür, dass sie an die KI gehen können
       (ein 4-MB-Foto wäre als Base64 ~5,3 MB und liefe in ein HTTP 413). */
    if (file.type && file.type.startsWith('image/')) {
      try {
        const img = await shrinkImage(file, 1024, 0.7);
        setPendingImg(img.dataUrl);
        toast(`Bild bereit (${img.w}×${img.h}).`, 'info');
      } catch {
        toast('Bild konnte nicht gelesen werden.', 'error');
      }
      return;
    }
    if (file.size > MAX_BYTES) { toast('Datei zu groß (max. 4 MB) — bitte kleinere Datei wählen.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      addMessage(chat.id, { from: me, type: 'file', src: reader.result, fileName: file.name, fileMime: file.type || '', text: '', time: 'jetzt' });
      toast('Datei gesendet.', 'success');
    };
    reader.onerror = () => toast('Datei konnte nicht gelesen werden.', 'error');
    reader.readAsDataURL(file);
  };
  const chatLabels = (chat.labels || []).map((id) => labels.find((l) => l.id === id)).filter(Boolean);

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: 14 }}><VNIcon.back s={15} /> Alle Chats</button>
      <div className="card chat-thread-card">
          <div className="chat-head">
            <span className="convo-avatar" style={{ width: 40, height: 40, background: chat.color + '22' }}><Icon name={chat.icon} s={20} c={chat.color} /></span>
            <div className="chat-head-main">
              <div className="chat-head-title">{chat.title}</div>
              <div className="vn-meta">{chat.sub}</div>
            </div>
            <div className="row gap-2 m-hide" style={{ flex: 'none' }}>{chatLabels.map((l) => <span key={l.id} className="tag" style={{ background: l.color + '22', color: l.color, borderColor: l.color }}><Icon name={l.icon} s={12} c={l.color} />{l.name}</span>)}</div>
          </div>
          <div className="chat-scroll" ref={scrollRef} style={{ flex: 1 }}>
            {chat.messages.map((m, i) => {
              if (m.type === 'note') return (
                <div key={i} className="note-msg"><div className="note-box"><span className="note-ic"><VNIcon.note s={16} /></span><div><div className="note-label">Abschlussnotiz der Praxis</div>{m.text}<div className="note-time">{m.time}</div></div></div></div>
              );
              const mine = m.from === me;
              if (m.deleted) return (
                <div key={i} className={'bubble-row' + (mine ? ' me' : '')}>
                  <span className={'bubble-av ' + m.from}><VNIcon.paw2 s={14} /></span>
                  <div className="bubble-col"><div className={'bubble ' + m.from} style={{ background: 'var(--surface-3)', color: 'var(--ink-3)', fontStyle: 'italic', border: '1px solid var(--line)' }}>Nachricht gelöscht</div><div className="bubble-time">{m.time}</div></div>
                </div>
              );
              const hasReaction = Object.keys(m.reactions || {}).length > 0;
              const menu = (
                <MsgMenu mine={mine} editable={!m.type}
                  onReact={(e) => toggleReaction(chat.id, i, me, e)}
                  onEdit={() => { setEditIdx(i); setDraft(m.text || ''); }}
                  onDelete={() => removeMsg(i)} />
              );
              let body;
              if (m.type === 'image') body = <div className={'bubble-img ' + m.from}><img src={m.src} alt="Anhang" />{m.text && <div className="cap">{m.text}</div>}</div>;
              else if (m.type === 'file') body = (
                <a className={'bubble bubble-file ' + m.from} href={m.src} download={m.fileName || 'anhang'}>
                  <VNIcon.note s={16} /> <span className="bf-name">{m.fileName || 'Datei'}</span>
                </a>
              );
              else body = <div className={'bubble ' + m.from} style={editIdx === i ? { outline: '2px solid var(--yellow)' } : undefined}>{m.text}</div>;
              return (
                <div key={i} className={'bubble-row' + (mine ? ' me' : '')}>
                  <span className={'bubble-av ' + m.from}><VNIcon.paw2 s={14} /></span>
                  <div className="bubble-col">
                    <div className="bubble-line">
                      {mine && menu}
                      <span className={'bubble-wrap' + (hasReaction ? ' has-reaction' : '')}>
                        {body}
                        <Reactions m={m} mine={mine} />
                      </span>
                      {!mine && menu}
                    </div>
                    <div className="bubble-time">{messageStamp(m)}</div>
                  </div>
                </div>
              );
            })}
            {typing && (
              <div className="bubble-row">
                <span className={'bubble-av ' + other}><VNIcon.paw2 s={14} /></span>
                <div className="bubble-col"><div className={'bubble ' + other + ' typing-bubble'}><span className="dot"></span><span className="dot"></span><span className="dot"></span></div></div>
              </div>
            )}
          </div>
          {editIdx != null && (
            <div className="img-preview"><span style={{ color: 'var(--teal-700)' }}><VNIcon.pencil s={16} /></span><span className="vn-meta" style={{ flex: 1 }}>Nachricht bearbeiten</span><button className="vn-back ip-x" style={{ width: 32, height: 32 }} onClick={cancelEdit} aria-label="Abbrechen"><VNIcon.x s={16} /></button></div>
          )}
          {pendingImg && (
            <div className="img-preview"><img src={pendingImg} alt="Vorschau" /><span className="vn-meta">Bild angehängt</span><button className="vn-back ip-x" style={{ width: 32, height: 32 }} onClick={() => setPendingImg(null)}><VNIcon.x s={16} /></button></div>
          )}
          <div className="chat-compose">
            {/* Drei Varianten, reine Browser-Mittel — kein zusätzliches Paket.
                „capture" öffnet am Handy direkt die Kamera, am PC den normalen Dialog. */}
            <input type="file" accept="image/*" ref={fileRef} onChange={onPickFile} style={{ display: 'none' }} />
            <input type="file" accept="image/*" capture="environment" ref={camRef} onChange={onPickFile} style={{ display: 'none' }} />
            <input type="file" ref={docRef} onChange={onPickFile} style={{ display: 'none' }} />
            <span style={{ position: 'relative' }}>
              <button className="chat-attach" onClick={() => setAttachMenu((o) => !o)} aria-label="Anhang"><VNIcon.camera s={20} /></button>
              {attachMenu && (
                <>
                  <div onClick={() => setAttachMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                  <div className="card card-pad" style={{ position: 'absolute', left: 0, bottom: 46, zIndex: 50, padding: 8, minWidth: 150, boxShadow: 'var(--sh-3)' }}>
                    <button className="btn btn-ghost btn-sm btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => { setAttachMenu(false); camRef.current && camRef.current.click(); }}>📷 Kamera</button>
                    <button className="btn btn-ghost btn-sm btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => { setAttachMenu(false); fileRef.current && fileRef.current.click(); }}>🖼️ Bild</button>
                    <button className="btn btn-ghost btn-sm btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => { setAttachMenu(false); docRef.current && docRef.current.click(); }}>📎 Datei</button>
                  </div>
                </>
              )}
            </span>
            <input className="input" value={draft} placeholder={editIdx != null ? 'Nachricht bearbeiten …' : pendingImg ? 'Bildunterschrift (optional) …' : 'Nachricht schreiben …'} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
            <button className="chat-send" onClick={send} aria-label="Senden"><VNIcon.send s={18} /></button>
          </div>
      </div>
    </>
  );
}

/* ---------- Chat-Zeile ---------- */
function ChatRow({ chat, labels, onOpen, onEdit, onPin, onDelete }) {
  const [menu, setMenu] = React.useState(false);
  const last = chat.messages[chat.messages.length - 1];
  const lastText = last ? (last.deleted ? 'Nachricht gelöscht' : last.type === 'note' ? 'Abschlussnotiz' : last.type === 'image' ? '📷 Bild' : last.type === 'file' ? '📎 ' + (last.fileName || 'Datei') : last.text) : 'Noch keine Nachricht';
  const chatLabels = (chat.labels || []).map((id) => labels.find((l) => l.id === id)).filter(Boolean);
  return (
    <div className="convo-item" style={{ cursor: 'pointer', position: 'relative' }}>
      <button className="convo-avatar" onClick={onOpen} style={{ background: chat.color + '22', border: 0 }}><Icon name={chat.icon} s={20} c={chat.color} /></button>
      <div className="convo-main" onClick={onOpen} style={{ minWidth: 0 }}>
        <span className="convo-name">
          {chat.pinned && <VNIcon.star s={13} fill="var(--yellow)" c="var(--yellow)" />}
          <span className="convo-title">{chat.title}</span>
        </span>
        <span className="convo-snippet">{lastText}</span>
        {chatLabels.length > 0 && (
          <span className="row gap-2" style={{ marginTop: 4, flexWrap: 'wrap' }}>
            {chatLabels.map((l) => <span key={l.id} style={{ fontSize: 10.5, fontWeight: 700, color: l.color, background: l.color + '1a', padding: '2px 7px', borderRadius: 999 }}>{l.name}</span>)}
          </span>
        )}
      </div>
      <div className="convo-meta">
        {chat.unread > 0 && <span className="unread-dot">{chat.unread}</span>}
        <button className="vn-back" style={{ width: 32, height: 32, marginTop: 4 }} onClick={() => setMenu((o) => !o)}><VNIcon.chevron s={16} /></button>
      </div>
      {menu && (
        <>
          <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
          <div className="card card-pad" style={{ position: 'absolute', right: 8, top: 52, zIndex: 50, padding: 8, minWidth: 160, boxShadow: 'var(--sh-3)' }}>
            <button className="btn btn-ghost btn-sm btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => { setMenu(false); onEdit(); }}><VNIcon.pencil s={15} /> Bearbeiten</button>
            <button className="btn btn-ghost btn-sm btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => { setMenu(false); onPin(); }}><VNIcon.star s={15} /> {chat.pinned ? 'Loslösen' : 'Anpinnen'}</button>
            <button className="btn btn-ghost btn-sm btn-block" style={{ justifyContent: 'flex-start', color: 'var(--red-ink)' }} onClick={() => { setMenu(false); onDelete(); }}><VNIcon.x s={15} /> Löschen</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Liste + Thread als wiederverwendbares Panel ----------
   Wird an zwei Stellen eingesetzt: als eigene Seite (ScreenChats) und im
   Nachrichten-Tab des Praxis-Dashboards. Dadurch gibt es nur EINEN Code-Pfad
   und beide Ansichten zeigen garantiert dieselben Chats aus demselben Store. */
export function ChatsPanel({ nav, title }) {
  const { auth } = useAdmin();
  const { visibleChats, labels, settings, createChat, updateChat, deleteChat, togglePin, addMessage, markRead, createLabel, updateLabel, deleteLabel, setSetting, resetSeed, clearAll } = useChats();
  const [openId, setOpenId] = React.useState(null);
  const [filter, setFilter] = React.useState(null);
  const [editor, setEditor] = React.useState(null); // 'new' | chatObject
  const [labelMgr, setLabelMgr] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const openChat = visibleChats.find((c) => c.id === openId);
  React.useEffect(() => { if (openId) markRead(openId); /* eslint-disable-next-line */ }, [openId]);

  // Ohne Anmeldung keine Chats — siehe Filter in lib/chats.jsx.
  if (!auth.role) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center' }}>
        <span style={{ color: 'var(--teal-700)' }}><VNIcon.lock s={26} /></span>
        <h2 className="vn-h2" style={{ marginTop: 8 }}>Bitte anmelden</h2>
        <p className="vn-text" style={{ marginTop: 6 }}>Melden Sie sich an, um Ihre Chats zu sehen.</p>
        {nav && <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => nav('auth')}>Zur Anmeldung</button>}
      </div>
    );
  }

  if (openChat) {
    return (
      <div className="chat-panel">
        <ChatThread chat={openChat} labels={labels} addMessage={addMessage} settings={settings} onBack={() => setOpenId(null)} />
      </div>
    );
  }

  const roles = rolesForAuth(auth);
  /* Rubrik-Chips nur dort, wo es mehr als eine gibt (also für Praxen:
     Posteingang / Netzwerk). Die Mechanik steckt schon im filter-State. */
  const roleChips = roles.length > 1 ? CHAT_ROLES.filter((r) => roles.includes(r.key)) : [];
  const labelChips = settings.showLabels ? labels : [];

  let list = filter ? visibleChats.filter((c) => (c.labels || []).includes(filter) || c.role === filter) : visibleChats;
  if (settings.showPinned) list = [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div className="stack-4 chat-panel">
      <div className="row between">
        <div>
          <h2 className="vn-h2">{title || 'Chats'}</h2>
          <p className="vn-meta" style={{ marginTop: 2 }}>{visibleChats.length} {visibleChats.length === 1 ? 'Unterhaltung' : 'Unterhaltungen'}</p>
        </div>
        <div className="row gap-2">
          <button className="vn-back" style={{ width: 40, height: 40 }} title="Labels verwalten" onClick={() => setLabelMgr(true)}><VNIcon.filter s={18} /></button>
          <button className="vn-back" style={{ width: 40, height: 40 }} title="Einstellungen" onClick={() => setSettingsOpen(true)}><VNIcon.refresh s={18} /></button>
          <button className="btn btn-primary btn-sm" onClick={() => setEditor('new')}><VNIcon.plus s={16} /> Neu</button>
        </div>
      </div>

      {(roleChips.length > 0 || labelChips.length > 0) && (
        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          <button className={'tag' + (filter === null ? ' tag-accent' : '')} style={{ cursor: 'pointer' }} onClick={() => setFilter(null)}>Alle</button>
          {roleChips.map((r) => (
            <button key={r.key} className={'tag' + (filter === r.key ? ' tag-accent' : '')} style={{ cursor: 'pointer' }} onClick={() => setFilter(filter === r.key ? null : r.key)}>
              {r.key === 'clinic' ? 'Posteingang' : 'Netzwerk'}
            </button>
          ))}
          {labelChips.map((l) => (
            <button key={l.id} className="tag" style={{ cursor: 'pointer', borderColor: filter === l.id ? l.color : 'var(--line-2)', background: filter === l.id ? l.color + '22' : 'var(--surface-3)', color: filter === l.id ? l.color : 'var(--ink-2)' }} onClick={() => setFilter(filter === l.id ? null : l.id)}>
              <Icon name={l.icon} s={13} c={filter === l.id ? l.color : 'var(--ink-3)'} /> {l.name}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <p className="vn-text">Keine Chats {filter ? 'mit diesem Filter' : 'vorhanden'}.</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setEditor('new')}><VNIcon.plus s={15} /> Chat erstellen</button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'visible' }}>
          <div className="convo-list">
            {list.map((c) => (
              <ChatRow key={c.id} chat={c} labels={labels}
                onOpen={() => setOpenId(c.id)}
                onEdit={() => setEditor(c)}
                onPin={() => togglePin(c.id)}
                onDelete={() => { if (confirm('Chat „' + c.title + '“ löschen?')) { deleteChat(c.id); toast('Chat gelöscht.', 'info'); } }} />
            ))}
          </div>
        </div>
      )}

      {editor && (
        <ChatEditor initial={editor === 'new' ? null : editor} labels={labels} roles={roles}
          onClose={() => setEditor(null)}
          onSave={(data) => {
            if (editor === 'new') { createChat(data); toast('Chat erstellt.', 'success'); }
            else { updateChat(editor.id, data); toast('Chat gespeichert.', 'success'); }
            setEditor(null);
          }} />
      )}
      {labelMgr && <LabelManager labels={labels} onClose={() => setLabelMgr(false)} createLabel={createLabel} updateLabel={updateLabel} deleteLabel={deleteLabel} />}
      {settingsOpen && <ChatSettings settings={settings} setSetting={setSetting} onClose={() => setSettingsOpen(false)} resetSeed={resetSeed} clearAll={clearAll} />}
    </div>
  );
}

/* ---------- Hauptscreen ---------- */
export function ScreenChats({ nav }) {
  return (
    <div className="vn-page">
      <div className="vn-page-wide d-narrow">
        <ChatsPanel nav={nav} />
      </div>
    </div>
  );
}
