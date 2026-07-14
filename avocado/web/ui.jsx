/* ui.jsx — shared UI: icons, buttons, HUD, progress, speech bubble, bottom nav */

// ---------- inline icons (stroke, 24x24) ----------
function Icon({ name, size = 24, color = 'currentColor', sw = 2.4, fill = 'none', style }) {
  const p = { fill, stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    back: <path d="M15 5l-7 7 7 7" {...p} />,
    x: <path d="M6 6l12 12M18 6L6 18" {...p} />,
    heart: <path d="M12 20S4 14.5 4 9.2A4.2 4.2 0 0112 6a4.2 4.2 0 018 3.2C20 14.5 12 20 12 20z" fill={color} stroke="none" />,
    flame: <path d="M12 3c1 3 4 4 4 8a4 4 0 11-8 0c0-1 .4-2 1-2.6C8.8 9 9 5.5 12 3z" fill={color} stroke="none" />,
    gem: <path d="M6 4h12l3 5-9 11L3 9z" {...p} />,
    star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.8 6.6 20l1-6.1L3.2 9.5l6.1-.9z" fill={color} stroke="none" />,
    learn: <path d="M4 6.5A2.5 2.5 0 016.5 4H20v13H6.5A2.5 2.5 0 004 19.5zM20 17v3H6.5A2.5 2.5 0 014 17.5" {...p} />,
    trophy: <path d="M7 4h10v3a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M9 13h6l-1 4h-4zM8 21h8" {...p} />,
    person: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM5 20a7 7 0 0114 0" {...p} />,
    check: <path d="M5 12.5l4.5 4.5L19 7" {...p} />,
    lock: <path d="M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z" {...p} />,
    bell: <path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6zM10 21h4" {...p} />,
    speaker: <path d="M5 9v6h3l5 4V5L8 9zM16 9a3 3 0 010 6M18.5 7a6 6 0 010 10" {...p} />,
    chevR: <path d="M9 5l7 7-7 7" {...p} />,
    settings: <path d="M12 9a3 3 0 100 6 3 3 0 000-6zM3 12h2M19 12h2M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" {...p} />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" style={style}>{paths[name]}</svg>;
}

// ---------- chunky 3D button ----------
function Btn({ children, onClick, variant = 'primary', disabled, style, className = '' }) {
  const cls = ['btn3d'];
  if (variant === 'ghost') cls.push('ghost');
  if (variant === 'danger') cls.push('danger');
  if (variant === 'blue') cls.push('blue');
  if (variant === 'correct') cls.push('');
  if (disabled) cls.push('is-disabled');
  const extra = variant === 'correct' && !disabled
    ? { background: 'var(--correct)', boxShadow: '0 4px 0 var(--correct-shadow)', color: '#fff' } : {};
  return (
    <button className={cls.join(' ') + ' ' + className} onClick={disabled ? undefined : onClick}
      disabled={disabled} style={{ ...extra, ...style }}>{children}</button>
  );
}

// ---------- HUD pill (streak / gems / xp / hearts) ----------
function Hud({ icon, value, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 4px',
      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color,
    }}>
      <Icon name={icon} size={26} color={color} />
      <span>{value}</span>
    </button>
  );
}

function TopHud({ streak, gems, hearts, lang, onLang, onStreak }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 18px 8px' }}>
      <button onClick={onLang} title="DE / EN" style={{
        display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-display)',
        fontWeight: 800, fontSize: 15, color: 'var(--text-muted)',
        border: '2px solid var(--border)', borderRadius: 999, padding: '3px 10px',
      }}>
        <span style={{ fontSize: 17 }}>{lang === 'de' ? '\uD83C\uDDE6\uD83C\uDDF9' : '\uD83C\uDDEC\uD83C\uDDE7'}</span>
        {lang.toUpperCase()}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Hud icon="flame" value={streak} color="var(--streak)" onClick={onStreak} />
        <Hud icon="gem" value={gems} color="var(--blue)" />
        <Hud icon="heart" value={hearts} color="var(--wrong)" />
      </div>
    </div>
  );
}

// ---------- progress bar ----------
function Progress({ value, color = 'var(--correct)', height = 16, shine = false }) {
  return (
    <div style={{ flex: 1, height, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: color,
        borderRadius: 999, transition: 'width .45s cubic-bezier(.3,1,.4,1)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 3, left: 6, right: 6, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.4)' }} />
        {shine && value > 6 && <div className="bar-shine" />}
      </div>
    </div>
  );
}

// ---------- typing indicator (AI "thinking" dots) ----------
function TypingDots({ color = 'var(--text-muted)', size = 9 }) {
  return (
    <span className="typing-dots" aria-label="…" style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.5 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block', animation: `typingDot 1.1s ${i * 0.16}s ease-in-out infinite` }} />
      ))}
    </span>
  );
}

// ---------- speech bubble (mascot) ----------
function Speech({ children, dir = 'left', style }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: 240, ...style }}>
      <div style={{
        background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: 18,
        padding: '13px 16px', fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 17, lineHeight: 1.32, color: 'var(--text)', whiteSpace: 'pre-line',
      }}>{children}</div>
      <div style={{
        position: 'absolute', bottom: -9, [dir === 'left' ? 'left' : 'right']: 26,
        width: 18, height: 18, background: 'var(--surface)',
        borderLeft: '2px solid var(--border)', borderBottom: '2px solid var(--border)',
        transform: 'rotate(-45deg)',
      }} />
    </div>
  );
}

// ---------- bottom nav ----------
function BottomNav({ tab, onTab, lang }) {
  const items = [
    { id: 'learn', icon: 'learn', label: STR.tabLearn, color: 'var(--correct)' },
    { id: 'league', icon: 'trophy', label: STR.tabLeague, color: 'var(--gold)' },
    { id: 'profile', icon: 'person', label: STR.tabProfile, color: 'var(--blue)' },
  ];
  return (
    <div style={{
      display: 'flex', borderTop: '2px solid var(--border)', background: 'var(--surface)',
      padding: '8px 8px', flexShrink: 0,
    }}>
      {items.map(it => {
        const on = tab === it.id;
        return (
          <button key={it.id} onClick={() => onTab(it.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '6px 0', borderRadius: 14,
            background: on ? 'var(--primary-tint)' : 'transparent',
          }}>
            <Icon name={it.icon} size={28} color={on ? it.color : 'var(--text-muted)'} fill={on ? it.color : 'none'} sw={on ? 0 : 2.2} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, letterSpacing: .4,
              color: on ? it.color : 'var(--text-muted)', textTransform: 'uppercase' }}>{T(it.label, lang)}</span>
          </button>
        );
      })}
    </div>
  );
}

// confetti burst
function Confetti({ n = 28 }) {
  const cols = ['#58CC02', '#1CB0F6', '#FFC800', '#FF9600', '#CE82FF', '#FF4B4B'];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 30 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', top: -20, left: `${(i * 37) % 100}%`,
          width: 9, height: 14, background: cols[i % cols.length], borderRadius: 2,
          animation: `confettiFall ${1.4 + (i % 5) * 0.25}s linear ${(i % 7) * 0.12}s forwards`,
          transform: `rotate(${i * 40}deg)`,
        }} />
      ))}
    </div>
  );
}

Object.assign(window, { Icon, Btn, Hud, TopHud, Progress, Speech, BottomNav, Confetti, TypingDots });
