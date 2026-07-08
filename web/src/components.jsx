/* VetNow — Icons + shared UI primitives */
import React from 'react';
import { STATUS, ANIMAL_LABEL, SERVICE_LABEL, SPECIALTY_LABEL } from './data.js';

export const VNIcon = {
  back: (p) => (<svg width={p?.s||22} height={p?.s||22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>),
  chevron: (p) => (<svg width={p?.s||18} height={p?.s||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>),
  phone: (p) => (<svg width={p?.s||20} height={p?.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>),
  route: (p) => (<svg width={p?.s||20} height={p?.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>),
  pin: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>),
  clock: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>),
  check: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>),
  alert: (p) => (<svg width={p?.s||18} height={p?.s||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>),
  info: (p) => (<svg width={p?.s||18} height={p?.s||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>),
  siren: (p) => (<svg width={p?.s||18} height={p?.s||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21h14"/><path d="M21 12h1M18.5 4.5 18 5M2 12h1M12 2v1M4.929 4.929l.707.707"/></svg>),
  send: (p) => (<svg width={p?.s||20} height={p?.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>),
  shield: (p) => (<svg width={p?.s||18} height={p?.s||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>),
  cat: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3.1-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/></svg>),
  dog: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"/><path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"/></svg>),
  paw: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="6.5" cy="14.5" r="2"/><path d="M16.5 14.5c1.5 0 2.5 1.2 2.5 2.7 0 2.3-2.3 4.3-7 4.3s-7-2-7-4.3c0-1.5 1-2.7 2.5-2.7"/></svg>),
  home: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>),
  heart: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>),
  cal: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>),
  filter: (p) => (<svg width={p?.s||18} height={p?.s||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h18l-7 8v6l-4 2v-8z"/></svg>),
  pencil: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>),
  refresh: (p) => (<svg width={p?.s||18} height={p?.s||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>),
  paw2: (p) => (<svg width={p?.s||20} height={p?.s||20} viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="9" r="2.1"/><circle cx="11" cy="6" r="2.1"/><circle cx="16.5" cy="8" r="2.1"/><path d="M11 11.5c2.6 0 4.8 1.9 4.8 4.3 0 1.8-1.5 2.7-3.2 2.7-1 0-1.1-.4-1.6-.4s-.6.4-1.6.4c-1.7 0-3.2-.9-3.2-2.7 0-2.4 2.2-4.3 4.8-4.3Z"/></svg>),
  user: (p) => (<svg width={p?.s||20} height={p?.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  building: (p) => (<svg width={p?.s||20} height={p?.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10"/><path d="M3 21h18"/><path d="M8 7h2M8 11h2M8 15h2"/></svg>),
  chat: (p) => (<svg width={p?.s||20} height={p?.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>),
  lock: (p) => (<svg width={p?.s||18} height={p?.s||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>),
  mail: (p) => (<svg width={p?.s||18} height={p?.s||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>),
  plus: (p) => (<svg width={p?.s||20} height={p?.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>),
  x: (p) => (<svg width={p?.s||20} height={p?.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>),
  logout: (p) => (<svg width={p?.s||18} height={p?.s||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>),
  note: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9z"/><path d="M15 3v6h6"/><path d="M9 13h6M9 17h4"/></svg>),
  checkCircle: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.8 10A10 10 0 1 1 17 3.3"/><path d="m9 11 3 3L22 4"/></svg>),
  star: (p) => (<svg width={p?.s||20} height={p?.s||20} viewBox="0 0 24 24" fill={p?.fill||'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.5 2.6a.6.6 0 0 1 1 0l2.4 5a.6.6 0 0 0 .5.3l5.4.8a.6.6 0 0 1 .3 1l-3.9 3.8a.6.6 0 0 0-.2.6l1 5.4a.6.6 0 0 1-.9.6l-4.8-2.5a.6.6 0 0 0-.6 0L7.4 19.7a.6.6 0 0 1-.9-.6l1-5.4a.6.6 0 0 0-.2-.6L3.4 9.3a.6.6 0 0 1 .3-1l5.4-.8a.6.6 0 0 0 .5-.3z"/></svg>),
  chevronR: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>),
  horse: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21c0-4.8 1.7-8.2 4.6-10.3"/><path d="M8.6 10.7 6.8 5.2c-.2-.5.4-1 .9-.7l4.5 2.6c.6-.1 1.2-.1 1.8-.1"/><path d="M14 7c3.9.5 6.6 3.6 6.9 7.6l.3 3.5c.1.6-.4 1.1-1 1.1h-2.4c-.5 0-.9-.3-1-.8l-.4-1.7c-.3-1.2-1.3-2-2.5-2-1.5 0-2.9.9-3.5 2.3l-1.5 3.4c-.2.4-.5.6-.9.6H5"/><path d="M14.5 10.5h.01"/></svg>),
  bird: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5"/><path d="M10 18v3"/><path d="M14 17.75V21"/><path d="M7 18a6 6 0 0 0 3.84-10.61"/></svg>),
  turtle: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 10 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a8 8 0 1 0-16 0v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3l2-4h4Z"/><path d="M4.82 7.9 8 10"/><path d="M15.18 7.9 12 10"/><path d="M16.93 10H20a2 2 0 0 1 0 4H2"/></svg>),
  rabbit: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 16a3 3 0 0 1 2.24 5"/><path d="M18 12h.01"/><path d="M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2L9.6 6.4a1 1 0 1 1 2.8-2.8L15.8 7h.2c3.3 0 6 2.7 6 6v1a2 2 0 0 1-2 2h-1a3 3 0 0 0-3 3"/><path d="M20 8.54V4a2 2 0 1 0-4 0v3"/><path d="M7.612 12.524a3 3 0 1 0-1.6 4.3"/></svg>),
  camera: (p) => (<svg width={p?.s||20} height={p?.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/></svg>),
  cross: (p) => (<svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>),
  sun: (p) => (<svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>),
  help: (p) => (<svg width={p?.s||15} height={p?.s||15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>),
};
VNIcon.reptile = VNIcon.turtle; // Rückwärtskompatibilität (Alias auf neues Schildkröten-Icon)

export const ANIMAL_ICON = { cat: 'cat', dog: 'dog', small: 'rabbit', horse: 'horse', bird: 'bird', exotic: 'turtle', other: 'paw' };
export const SERVICE_ICON = { emergency: 'siren', regular: 'cal', euthanasia: 'heart', housecall: 'home' };

/* Einheitliches Tier-Icon — nutzt überall dieselbe Zuordnung (ANIMAL_ICON), damit
   Pferd/Vogel/Exoten/Kleintiere in Chat, Terminen & Tags korrekt erscheinen. */
export function AnimalGlyph({ animal, s }) {
  const I = VNIcon[ANIMAL_ICON[animal] || 'paw'] || VNIcon.paw;
  return <I s={s || 16} />;
}

export function StatusBadge({ status, size }) {
  const S = STATUS[status];
  const big = size === 'lg';
  return (
    <span className={'badge badge-' + S.cls + (big ? ' lg' : '')}>
      <span className={'dot dot-' + S.cls + (status === 'green' ? ' pulse' : '') + (big ? ' lg' : '')}></span>
      {S.label}
    </span>
  );
}

export function Tag({ icon, children, accent }) {
  const I = icon ? VNIcon[icon] : null;
  return (
    <span className={'tag' + (accent ? ' tag-accent' : '')}>
      {I && <I s={13} />}
      {children}
    </span>
  );
}

export function AnimalTags({ animals }) {
  const L = ANIMAL_LABEL;
  return animals.map((a) => <Tag key={a} icon={ANIMAL_ICON[a]}>{L[a]}</Tag>);
}
export function SpecialtyTags({ specialties }) {
  const L = SPECIALTY_LABEL;
  return (specialties || []).map((s) => <span key={s} className="tag tag-spec"><VNIcon.cross s={12} />{L[s] || s}</span>);
}
export function Tooltip({ text, children }) {
  return (
    <span className="tt" tabIndex="0">
      {children || <span className="tt-trigger"><VNIcon.help s={15} /></span>}
      <span className="tt-bubble" role="tooltip">{text}</span>
    </span>
  );
}

export function MultiSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen] = React.useState(false);
  const val = value || [];
  const toggle = (k) => { const s = new Set(val); s.has(k) ? s.delete(k) : s.add(k); onChange([...s]); };
  const label = val.length === 0 ? (placeholder || 'Alle') : val.length === 1
    ? (options.find((o) => o.key === val[0]) || {}).label
    : val.length + ' ausgewählt';
  return (
    <div className="ms" style={{ position: 'relative' }}>
      <button type="button" className="selectbox ms-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: val.length ? 'var(--ink)' : 'var(--ink-3)' }}>{label}</span>
      </button>
      {open && (
        <React.Fragment>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }}></div>
          <div className="ms-panel">
            {options.map((o) => {
              const on = val.includes(o.key);
              return (
                <button type="button" key={o.key} className={'ms-opt' + (on ? ' is-on' : '')} onClick={() => toggle(o.key)}>
                  <span className="ms-box">{on && <VNIcon.check s={12} />}</span>{o.label}
                </button>
              );
            })}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}
export function ServiceTags({ services, accent }) {
  const L = SERVICE_LABEL;
  return services.map((s) => <Tag key={s} icon={SERVICE_ICON[s]} accent={accent}>{L[s]}</Tag>);
}

export function Switch({ on }) {
  return <span className={'switch' + (on ? ' is-on' : '')}></span>;
}

export function Checkbox({ on }) {
  return (
    <span className={'box'}>
      <VNIcon.check s={15} />
    </span>
  );
}

export function ConfirmLine({ practice }) {
  const grey = practice.status === 'grey';
  return (
    <span className="confirm-line" style={{ color: grey ? 'var(--grey-ink)' : 'var(--ink-3)' }}>
      <VNIcon.clock s={13} />
      Zuletzt bestätigt: <b style={{ fontWeight: 650, color: grey ? 'var(--grey-ink)' : 'var(--ink-2)' }}>{practice.confirmedAt}</b>
    </span>
  );
}

/* ---- Toast system (Modul-Singleton statt window) ---- */
let toastFn = null;
export function ToastHost() {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => {
    toastFn = (msg, type) => {
      const id = Math.random().toString(36).slice(2);
      setItems((x) => [...x, { id, msg, type: type || 'info' }]);
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3400);
    };
    return () => { toastFn = null; };
  }, []);
  const icon = (t) => t === 'success' ? <VNIcon.checkCircle s={18} /> : t === 'error' ? <VNIcon.alert s={18} /> : <VNIcon.info s={18} />;
  return (
    <div className="toast-host" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={'toast toast-' + t.type}>
          <span className="toast-ic">{icon(t.type)}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
export function toast(msg, type) { if (toastFn) toastFn(msg, type); }

/* ---- Account avatar (eingeloggt) ---- */
export function AccountChip({ auth, onClick }) {
  if (!auth || !auth.role) return null;
  const initials = (auth.name || (auth.role === 'clinic' ? 'Praxis' : 'Konto')).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <button className="acct-chip" onClick={onClick} title="Sie sind eingeloggt">
      <span className="acct-av">{initials}</span>
      <span className="acct-meta m-hide">
        <span className="acct-role">{auth.role === 'clinic' ? 'Praxis' : 'Tierhalter:in'}</span>
        <span className="acct-on"><span className="acct-dot"></span> eingeloggt</span>
      </span>
    </button>
  );
}

/* ---- Star rating ---- */
export function StarRating({ value, onChange, readOnly }) {
  const [hover, setHover] = React.useState(0);
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (hover || value) >= n;
        return (
          <button key={n} className="star-btn" disabled={readOnly}
            onMouseEnter={() => !readOnly && setHover(n)} onMouseLeave={() => !readOnly && setHover(0)}
            onClick={() => !readOnly && onChange && onChange(n)} aria-label={n + ' Sterne'}>
            <VNIcon.star s={22} fill={on ? 'currentColor' : 'none'} />
          </button>
        );
      })}
    </span>
  );
}

