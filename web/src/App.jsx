/* VetNow — App root: router, top bar, legal footer */
import React from 'react';
import { VNIcon, AccountChip, ToastHost } from './components.jsx';
import { useVNData } from './lib/adminContext.jsx';
import { useChats } from './lib/chats.jsx';
import { ScreenHome, ScreenSearch } from './screens-a.jsx';
import { ScreenResults, ScreenDetail } from './screens-b.jsx';
import { ScreenRequest } from './screens-c.jsx';
import { ScreenAuth, ScreenLogin, ScreenRegisterOwner, ScreenRegisterClinic } from './screens-d.jsx';
import { ScreenDashboard } from './screens-e.jsx';
import { ScreenExtension } from './screens-ext.jsx';
import { ScreenAdmin } from './screens-admin.jsx';
import { ScreenChats } from './screens-chats.jsx';

const SCREEN_META = {
  home:      { title: '', back: null },
  search:    { title: 'Notfall-Suche', sub: 'Schritt 1 von 2', back: 'home' },
  results:   { title: 'Ergebnisse', back: 'search' },
  detail:    { title: 'Praxis-Details', back: 'results' },
  request:   { title: 'Anfrage senden', back: 'detail' },
  dashboard: { title: 'Praxis-Dashboard', back: 'home' },
  'owner-messages': { title: 'Chats', back: 'home' },
  extension: { title: 'Extension-Vorschau', back: 'home' },
  admin:     { title: 'Admin', back: 'home' },
};
const CHROMELESS = ['auth', 'login', 'register-owner', 'register-clinic'];

function Brand() {
  return (
    <div className="vn-brand">
      <span className="vn-brand-mark"><VNIcon.paw2 s={20} /></span>
      <span className="vn-brand-name">VetNow <span className="reg">Kärnten</span></span>
    </div>
  );
}

function TopBar({ route, nav, auth }) {
  const meta = SCREEN_META[route.name];
  const loggedIn = auth && auth.role;
  if (route.name === 'home') {
    return (
      <header className="vn-topbar between">
        <Brand />
        <div className="row gap-2">
          <button className="vn-back m-hide" onClick={() => nav('owner-messages')} aria-label="Meine Nachrichten" style={{ color: 'var(--teal-700)' }}><VNIcon.chat s={20} /></button>
          {loggedIn && auth.role === 'clinic' && <button className="btn btn-secondary btn-sm m-hide" onClick={() => nav('dashboard')}>Dashboard</button>}
          {loggedIn
            ? <AccountChip auth={auth} onClick={() => nav(auth.role === 'clinic' ? 'dashboard' : 'owner-messages')} />
            : <button className="btn btn-secondary btn-sm" onClick={() => nav('auth')}>Anmelden</button>}
        </div>
      </header>
    );
  }
  return (
    <header className="vn-topbar">
      <button className="vn-back" onClick={() => nav(meta.back, route.backParams)} aria-label="Zurück"><VNIcon.back s={20} /></button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="vn-topbar-title">{meta.title}</div>
        {meta.sub && <div className="vn-topbar-sub">{meta.sub}</div>}
      </div>
      {loggedIn
        ? <AccountChip auth={auth} onClick={() => nav(auth.role === 'clinic' ? 'dashboard' : 'owner-messages')} />
        : (route.name !== 'dashboard' && <button className="vn-back" onClick={() => nav('home')} aria-label="Start" style={{ color: 'var(--teal-700)' }}><VNIcon.paw2 s={20} /></button>)}
    </header>
  );
}

function MobileTabBar({ route, nav, auth }) {
  const { totalUnread } = useChats();
  const n = route.name;
  const searchActive = ['search', 'results', 'detail', 'request'].includes(n);
  const unread = totalUnread;
  const accountTarget = auth && auth.role ? (auth.role === 'clinic' ? 'dashboard' : 'owner-messages') : 'auth';
  const tabs = [
    { key: 'home', label: 'Start', icon: 'home', active: n === 'home', go: 'home' },
    { key: 'search', label: 'Suchen', icon: 'siren', active: searchActive, go: 'search' },
    { key: 'msg', label: 'Nachrichten', icon: 'chat', active: n === 'owner-messages', go: 'owner-messages', badge: unread },
    { key: 'acct', label: auth && auth.role ? 'Konto' : 'Anmelden', icon: 'user', active: n === 'auth', go: accountTarget },
  ];
  return (
    <nav className="mobile-tabbar" aria-label="Hauptnavigation">
      {tabs.map((t) => {
        const I = VNIcon[t.icon];
        return (
          <button key={t.key} className={'mtab' + (t.active ? ' is-on' : '')} onClick={() => nav(t.go)}>
            <span className="mt-ic"><I s={22} />{t.badge > 0 && <span className="mt-badge">{t.badge}</span>}</span>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

function LegalFooter({ nav }) {
  return (
    <footer className="vn-footer">
      <div className="vn-page-wide">
        <div className="row gap-2" style={{ color: 'var(--ink-3)', marginBottom: 6 }}>
          <VNIcon.shield s={16} />
          <span className="section-label" style={{ color: 'var(--ink-2)' }}>Rechtliche Hinweise</span>
        </div>
        <ul className="legal">
          <li>Diese Plattform ersetzt keine medizinische Beratung.</li>
          <li>Angaben ohne Gewähr.</li>
          <li>Bitte bei Notfällen immer telefonisch bestätigen.</li>
          <li>Nur aktiv bestätigte Praxen werden als aktuell erreichbar markiert.</li>
          <li><strong>Bei lebensbedrohlichen Notfällen sofort anrufen.</strong></li>
        </ul>
        <div className="row gap-3" style={{ marginTop: 10 }}>
          <a className="link" style={{ color: 'var(--ink-3)', fontSize: 12.5, cursor: 'pointer' }} onClick={() => nav('admin')}>Admin</a>
          <a className="link" style={{ color: 'var(--ink-3)', fontSize: 12.5, cursor: 'pointer' }} onClick={() => nav('extension')}>Extension-Vorschau</a>
        </div>
      </div>
    </footer>
  );
}

export default function App({ initialScreen, initialId }) {
  const [route, setRoute] = React.useState({ name: initialScreen || 'home', practiceId: initialId });
  const [filters, setFilters] = React.useState({ animal: null, situation: null, district: null, specialties: [], onlyConfirmed: false });
  const [auth, setAuth] = React.useState({ role: null, name: '' });
  const bodyRef = React.useRef(null);

  const nav = (name, opts) => {
    setRoute({ name: name || 'home', ...(opts || {}) });
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  };

  const showFooter = ['home', 'search', 'results', 'request'].includes(route.name);
  const chromeless = CHROMELESS.includes(route.name);
  const showBottomNav = !chromeless && !['dashboard', 'admin'].includes(route.name);

  let screen = null;
  switch (route.name) {
    case 'search':    screen = <ScreenSearch nav={nav} filters={filters} setFilters={setFilters} />; break;
    case 'results':   screen = <ScreenResults nav={nav} filters={filters} setFilters={setFilters} />; break;
    case 'detail':    screen = <ScreenDetail nav={nav} practiceId={route.practiceId} />; break;
    case 'request':   screen = <ScreenRequest nav={nav} filters={filters} practiceId={route.practiceId} auth={auth} />; break;
    case 'dashboard': screen = <ScreenDashboard nav={nav} />; break;
    case 'owner-messages': screen = <ScreenChats />; break;
    case 'auth':      screen = <ScreenAuth nav={nav} />; break;
    case 'login':     screen = <ScreenLogin nav={nav} setAuth={setAuth} />; break;
    case 'register-owner':  screen = <ScreenRegisterOwner nav={nav} setAuth={setAuth} />; break;
    case 'register-clinic': screen = <ScreenRegisterClinic nav={nav} setAuth={setAuth} />; break;
    case 'extension': screen = <ScreenExtension nav={nav} />; break;
    case 'admin':     screen = <ScreenAdmin nav={nav} />; break;
    default:          screen = <ScreenHome nav={nav} filters={filters} setFilters={setFilters} />;
  }

  return (
    <div className="vn-viewport">
      {!chromeless && <TopBar route={route} nav={nav} auth={auth} />}
      <div className={'vn-body' + (showBottomNav ? ' has-bottomnav' : '')} ref={bodyRef}>
        {screen}
        {showFooter && <LegalFooter nav={nav} />}
      </div>
      {showBottomNav && <MobileTabBar route={route} nav={nav} auth={auth} />}
      <ToastHost />
    </div>
  );
}
