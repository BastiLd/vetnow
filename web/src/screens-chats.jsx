/* VetNow — Chats (Web): freie Chats mit Labels/Farben/Icons.
   Liste mit Label-Filter, Erstellen/Bearbeiten, Anpinnen, Löschen,
   Label-Verwaltung, Einstellungen und Thread-Ansicht. */
import React from 'react';
import { VNIcon, AnimalGlyph, Switch, toast } from './components.jsx';
import { CHAT_ROLES, botReply, botGreeting } from './data.js';
import { useChats } from './lib/chats.jsx';

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
function ChatEditor({ initial, labels, onSave, onClose }) {
  const [f, setF] = React.useState(() => ({
    title: initial?.title || '', sub: initial?.sub || '', role: initial?.role || 'owner',
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
            {CHAT_ROLES.map((r) => (
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

/* ---------- Thread ---------- */
function ChatThread({ chat, onBack, addMessage, labels, settings }) {
  const me = chat.role === 'owner' ? 'owner' : 'clinic';
  const other = me === 'owner' ? 'clinic' : 'owner';
  const [draft, setDraft] = React.useState('');
  const [pendingImg, setPendingImg] = React.useState(null);
  const [typing, setTyping] = React.useState(false);
  const fileRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const handledRef = React.useRef('');
  const timersRef = React.useRef([]);
  React.useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [chat.messages.length, typing]);

  // Auto-Antwort-Bot: reagiert, wenn die letzte Nachricht von MIR ist (oder Chat leer → Begrüßung).
  React.useEffect(() => {
    if (!settings || !settings.botEnabled) return;
    const msgs = chat.messages;
    const last = msgs[msgs.length - 1];
    const sig = chat.id + ':' + msgs.length + ':' + (last ? last.from + last.type : 'empty');
    if (handledRef.current === sig) return;

    const schedule = (fn, delay) => { const t = setTimeout(fn, delay); timersRef.current.push(t); };
    const withTyping = (produce) => {
      if (settings.botTyping) { setTyping(true); schedule(() => { setTyping(false); addMessage(chat.id, produce()); }, 1100 + Math.random() * 700); }
      else schedule(() => addMessage(chat.id, produce()), 500);
    };

    if (msgs.length === 0 && settings.botGreeting) {
      handledRef.current = sig;
      withTyping(() => ({ from: other, text: botGreeting(other), time: 'jetzt' }));
    } else if (last && last.from === me && last.type !== 'note') {
      handledRef.current = sig;
      const replyText = last.type === 'image' ? 'Danke fürs Bild! Wir sehen es uns an.' : botReply(last.text, other);
      withTyping(() => ({ from: other, text: replyText, time: 'jetzt' }));
    }
    return () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.messages.length, chat.id, settings && settings.botEnabled]);

  const send = () => {
    if (pendingImg) { addMessage(chat.id, { from: me, type: 'image', src: pendingImg, text: draft.trim(), time: 'jetzt' }); setPendingImg(null); setDraft(''); return; }
    if (!draft.trim()) return;
    addMessage(chat.id, { from: me, text: draft.trim(), time: 'jetzt' }); setDraft('');
  };
  const onPickFile = (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setPendingImg(reader.result); toast('Bild bereit zum Senden.', 'info'); };
    reader.readAsDataURL(file); e.target.value = '';
  };
  const chatLabels = (chat.labels || []).map((id) => labels.find((l) => l.id === id)).filter(Boolean);

  return (
    <div className="vn-page">
      <div className="vn-page-wide d-narrow">
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: 14 }}><VNIcon.back s={15} /> Alle Chats</button>
        <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 460 }}>
          <div className="chat-head">
            <span className="convo-avatar" style={{ width: 40, height: 40, background: chat.color + '22' }}><Icon name={chat.icon} s={20} c={chat.color} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{chat.title}</div>
              <div className="vn-meta">{chat.sub}</div>
            </div>
            <div className="row gap-2">{chatLabels.map((l) => <span key={l.id} className="tag" style={{ background: l.color + '22', color: l.color, borderColor: l.color }}><Icon name={l.icon} s={12} c={l.color} />{l.name}</span>)}</div>
          </div>
          <div className="chat-scroll" ref={scrollRef} style={{ flex: 1 }}>
            {chat.messages.map((m, i) => {
              if (m.type === 'note') return (
                <div key={i} className="note-msg"><div className="note-box"><span className="note-ic"><VNIcon.note s={16} /></span><div><div className="note-label">Abschlussnotiz der Praxis</div>{m.text}<div className="note-time">{m.time}</div></div></div></div>
              );
              if (m.type === 'image') return (
                <div key={i} className={'bubble-row' + (m.from === me ? ' me' : '')}>
                  <span className={'bubble-av ' + m.from}><VNIcon.paw2 s={14} /></span>
                  <div><div className={'bubble-img ' + m.from}><img src={m.src} alt="Anhang" />{m.text && <div className="cap">{m.text}</div>}</div><div className="bubble-time">{m.time}</div></div>
                </div>
              );
              return (
                <div key={i} className={'bubble-row' + (m.from === me ? ' me' : '')}>
                  <span className={'bubble-av ' + m.from}><VNIcon.paw2 s={14} /></span>
                  <div><div className={'bubble ' + m.from}>{m.text}</div><div className="bubble-time">{m.time}</div></div>
                </div>
              );
            })}
            {typing && (
              <div className="bubble-row">
                <span className={'bubble-av ' + other}><VNIcon.paw2 s={14} /></span>
                <div><div className={'bubble ' + other + ' typing-bubble'}><span className="dot"></span><span className="dot"></span><span className="dot"></span></div></div>
              </div>
            )}
          </div>
          {pendingImg && (
            <div className="img-preview"><img src={pendingImg} alt="Vorschau" /><span className="vn-meta">Bild angehängt</span><button className="vn-back ip-x" style={{ width: 32, height: 32 }} onClick={() => setPendingImg(null)}><VNIcon.x s={16} /></button></div>
          )}
          <div className="chat-compose">
            <input type="file" accept="image/*" ref={fileRef} onChange={onPickFile} style={{ display: 'none' }} />
            <button className="chat-attach" onClick={() => fileRef.current && fileRef.current.click()} aria-label="Bild anhängen"><VNIcon.camera s={20} /></button>
            <input className="input" value={draft} placeholder={pendingImg ? 'Bildunterschrift (optional) …' : 'Nachricht schreiben …'} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
            <button className="chat-send" onClick={send} aria-label="Senden"><VNIcon.send s={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Chat-Zeile ---------- */
function ChatRow({ chat, labels, onOpen, onEdit, onPin, onDelete }) {
  const [menu, setMenu] = React.useState(false);
  const last = chat.messages[chat.messages.length - 1];
  const lastText = last ? (last.type === 'note' ? 'Abschlussnotiz' : last.type === 'image' ? '📷 Bild' : last.text) : 'Noch keine Nachricht';
  const chatLabels = (chat.labels || []).map((id) => labels.find((l) => l.id === id)).filter(Boolean);
  return (
    <div className="convo-item" style={{ cursor: 'pointer', position: 'relative' }}>
      <button className="convo-avatar" onClick={onOpen} style={{ background: chat.color + '22', border: 0 }}><Icon name={chat.icon} s={20} c={chat.color} /></button>
      <div className="convo-main" onClick={onOpen} style={{ minWidth: 0 }}>
        <span className="convo-name">{chat.pinned && <VNIcon.star s={13} fill="var(--yellow)" c="var(--yellow)" />} {chat.title}</span>
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

/* ---------- Hauptscreen ---------- */
export function ScreenChats() {
  const { visibleChats, labels, settings, createChat, updateChat, deleteChat, togglePin, addMessage, markRead, createLabel, updateLabel, deleteLabel, setSetting, resetSeed, clearAll } = useChats();
  const [openId, setOpenId] = React.useState(null);
  const [filter, setFilter] = React.useState(null);
  const [editor, setEditor] = React.useState(null); // 'new' | chatObject
  const [labelMgr, setLabelMgr] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const openChat = visibleChats.find((c) => c.id === openId);
  React.useEffect(() => { if (openId) markRead(openId); /* eslint-disable-next-line */ }, [openId]);

  if (openChat) {
    return <ChatThread chat={openChat} labels={labels} addMessage={addMessage} settings={settings} onBack={() => setOpenId(null)} />;
  }

  let list = filter ? visibleChats.filter((c) => (c.labels || []).includes(filter) || c.role === filter) : visibleChats;
  if (settings.showPinned) list = [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div className="vn-page">
      <div className="vn-page-wide d-narrow stack-4">
        <div className="row between">
          <div>
            <h2 className="vn-h2">Chats</h2>
            <p className="vn-meta" style={{ marginTop: 2 }}>{visibleChats.length} {visibleChats.length === 1 ? 'Unterhaltung' : 'Unterhaltungen'}</p>
          </div>
          <div className="row gap-2">
            <button className="vn-back" style={{ width: 40, height: 40 }} title="Labels verwalten" onClick={() => setLabelMgr(true)}><VNIcon.filter s={18} /></button>
            <button className="vn-back" style={{ width: 40, height: 40 }} title="Einstellungen" onClick={() => setSettingsOpen(true)}><VNIcon.refresh s={18} /></button>
            <button className="btn btn-primary btn-sm" onClick={() => setEditor('new')}><VNIcon.plus s={16} /> Neu</button>
          </div>
        </div>

        {settings.showLabels && labels.length > 0 && (
          <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
            <button className={'tag' + (filter === null ? ' tag-accent' : '')} style={{ cursor: 'pointer' }} onClick={() => setFilter(null)}>Alle</button>
            {labels.map((l) => (
              <button key={l.id} className="tag" style={{ cursor: 'pointer', borderColor: filter === l.id ? l.color : 'var(--line-2)', background: filter === l.id ? l.color + '22' : 'var(--surface-3)', color: filter === l.id ? l.color : 'var(--ink-2)' }} onClick={() => setFilter(filter === l.id ? null : l.id)}>
                <Icon name={l.icon} s={13} c={filter === l.id ? l.color : 'var(--ink-3)'} /> {l.name}
              </button>
            ))}
          </div>
        )}

        {list.length === 0 ? (
          <div className="card card-pad" style={{ textAlign: 'center' }}>
            <p className="vn-text">Keine Chats {filter ? 'mit diesem Label' : 'vorhanden'}.</p>
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
      </div>

      {editor && (
        <ChatEditor initial={editor === 'new' ? null : editor} labels={labels}
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
