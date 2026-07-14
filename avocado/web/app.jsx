/* app.jsx — root: navigation, theming, scaling, tweaks */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "direction": "klassik",
  "dark": false,
  "accent": "#58CC02",
  "font": "rounded",
  "radius": "soft",
  "mascot": "tie",
  "lang": "de"
}/*EDITMODE-END*/;

// ---- persistence (localStorage) ----
function avoLoad(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } }
function avoSave(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
function avoClear() { ['avo.tweaks', 'avo.prog', 'avo.profile', 'avo.set', 'avo.pref'].forEach(k => { try { localStorage.removeItem(k); } catch { } }); }

const DIR_LABEL = { klassik: { de: 'Klassik (hell)', en: 'Classic (light)' }, mitternacht: { de: 'Mitternacht (dunkel)', en: 'Midnight (dark)' }, kanzlei: { de: 'Kanzlei (edel)', en: 'Chambers (refined)' } };

// Custom dropdown for the tweaks panel. Native <select> doesn't reliably commit
// inside the editor host (selection visually reverts) — this button-based picker
// uses the same interaction pattern as the toggle/color/radio controls that work.
function TweakPick({ label, value, options, onChange }) {
  const [open, setOpen] = React.useState(false);
  const opts = options.map(o => (typeof o === 'object' ? o : { value: o, label: o }));
  const cur = opts.find(o => o.value === value) || opts[0];
  return (
    <TweakRow label={label}>
      <div style={{ position: 'relative' }}>
        <button type="button" onClick={() => setOpen(o => !o)}
          style={{ boxSizing: 'border-box', width: '100%', height: 26, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, border: '.5px solid rgba(0,0,0,.12)', borderRadius: 7, background: 'rgba(255,255,255,.65)', color: '#29261b', font: 'inherit', cursor: 'default', textAlign: 'left' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur ? cur.label : ''}</span>
          <span style={{ opacity: .5, fontSize: 8, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .12s' }}>▼</span>
        </button>
        {open && (
          <React.Fragment>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 30, zIndex: 41, background: 'rgba(252,251,249,.99)', border: '.5px solid rgba(0,0,0,.12)', borderRadius: 8, boxShadow: '0 10px 28px rgba(0,0,0,.2)', padding: 4, maxHeight: 184, overflowY: 'auto' }}>
              {opts.map(o => {
                const on = o.value === value;
                return (
                  <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                    style={{ width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 6, font: 'inherit', fontWeight: on ? 600 : 400, color: '#29261b', background: on ? 'rgba(0,0,0,.07)' : 'transparent', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span>{o.label}</span>{on && <span style={{ fontSize: 11 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </React.Fragment>
        )}
      </div>
    </TweakRow>
  );
}

function Stage({ children }) {
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const fit = () => {
      const pad = 24;
      const s = Math.min((window.innerWidth - pad) / 402, (window.innerHeight - pad) / 874, 1.15);
      setScale(s);
    };
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center', width: 402, height: 874 }}>{children}</div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks({ ...TWEAK_DEFAULTS, ...avoLoad('avo.tweaks', {}) });
  const lang = t.lang;
  const acc = t.mascot === 'plain' ? 'none' : t.mascot;
  const theme = React.useMemo(() => AvoTheme.buildTheme(t), [t.direction, t.dark, t.accent, t.font, t.radius]);

  const savedProg = avoLoad('avo.prog', null);
  const [screen, setScreen] = React.useState(savedProg ? 'main' : 'splash');
  const [tab, setTab] = React.useState('learn');
  const [active, setActive] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [pref, setPref] = React.useState(avoLoad('avo.pref', null)); // onboarding-chosen course unit id
  const [prog, setProg] = React.useState(() => savedProg
    ? { ...savedProg, done: new Set(savedProg.done) }
    : { done: new Set(), xp: 0, gems: 500, hearts: 5, streak: 0, today: null });
  const [profile, setProfile] = React.useState(avoLoad('avo.profile', { name: '', user: 'avocado_rookie' }));
  const [appSet, setAppSet] = React.useState(avoLoad('avo.set', { goal: 20, reminders: true, sound: true }));
  const LESSON_GEM_BONUS = 5;
  // Echtes Handy / WebView → Vollbild als echte App, ohne gezeichneten iPhone-Rahmen
  const isPhone = window.innerWidth < 520;

  // persist everything
  React.useEffect(() => { avoSave('avo.tweaks', t); }, [t]);
  React.useEffect(() => { avoSave('avo.prog', { ...prog, done: Array.from(prog.done) }); }, [prog]);
  React.useEffect(() => { avoSave('avo.profile', profile); }, [profile]);
  React.useEffect(() => { avoSave('avo.set', appSet); }, [appSet]);
  React.useEffect(() => { avoSave('avo.pref', pref); }, [pref]);

  // add XP to today's counter; bump streak once per day when the goal is hit
  const addDailyXp = (p, gained) => {
    const date = new Date().toISOString().slice(0, 10);
    const t0 = p.today && p.today.date === date ? p.today : { date, xp: 0, goalHit: false };
    const nt = { ...t0, xp: t0.xp + gained };
    let streak = p.streak;
    if (!t0.goalHit && nt.xp >= appSet.goal) { nt.goalHit = true; streak = p.streak + 1; }
    return { today: nt, streak };
  };

  const resetAll = () => {
    avoClear();
    setProg({ done: new Set(), xp: 0, gems: 500, hearts: 5, streak: 0, today: null });
    setProfile({ name: '', user: 'avocado_rookie' });
    setPref(null);
    setScreen('splash');
  };

  React.useEffect(() => { window.__nav = (s, tb) => { setScreen(s); if (tb) setTab(tb); }; window.__setActive = setActive; window.__setResult = setResult; window.__setTweak = setTweak; window.__setDir = setDirection; }, []);
  const setDirection = (dir) => setTweak({ direction: dir, accent: AvoTheme.ACCENT_DEFAULT[dir], dark: dir === 'mitternacht' });
  const toggleLang = () => setTweak('lang', lang === 'de' ? 'en' : 'de');

  const startLesson = (unit, lesson) => { setActive({ unit, lesson }); setScreen('lesson'); };
  // TEST: skip a level for 10 gems — still awards full XP
  const skipLesson = (unit, lesson) => {
    setProg(p => {
      if (p.gems < 10 || p.done.has(lesson.id)) return p;
      const d = new Set(p.done); d.add(lesson.id);
      return { ...p, done: d, xp: p.xp + lesson.xp, gems: p.gems - 10, ...addDailyXp(p, lesson.xp) };
    });
  };
  const completeLesson = (res) => {
    setProg(p => {
      const d = new Set(p.done); d.add(active.lesson.id);
      return { ...p, done: d, xp: p.xp + res.xp, gems: p.gems + LESSON_GEM_BONUS, hearts: res.hearts != null ? res.hearts : p.hearts, ...addDailyXp(p, res.xp) };
    });
    setResult({ ...res, gems: LESSON_GEM_BONUS }); setScreen('complete');
  };
  const exitLesson = (hearts) => {
    if (hearts != null) setProg(p => ({ ...p, hearts }));
    setScreen('main');
  };
  const refillHearts = () => {
    if (prog.gems < 350) return false;
    setProg(p => ({ ...p, gems: p.gems - 350, hearts: 5 }));
    return true;
  };

  // apply onboarding choices: preferred topic + optional placement-test start position
  const finishOnboarding = (res = {}) => {
    if (res.category) setPref(res.category);
    if (res.mode === 'level' && res.score > 0) {
      const unit = COURSE.find(u => u.id === res.category) || COURSE[0];
      const done = new Set(); let xp = 0;
      const n = Math.min(res.score, unit.lessons.length);
      for (let k = 0; k < n; k++) { const l = unit.lessons[k]; if (l.exercises && l.exercises.length) { done.add(l.id); xp += l.xp; } }
      setProg(p => ({ ...p, done, xp }));
    }
    setScreen('main'); setTab('learn');
  };

  const statusLight = (screen === 'splash' || screen === 'streak') ? true : theme.meta.isDark;

  let body;
  if (screen === 'splash') body = <Splash lang={lang} acc={acc} onStart={() => setScreen('onboarding')} onLogin={() => setScreen('login')} />;
  else if (screen === 'login') body = <Login lang={lang} acc={acc} onBack={() => setScreen('splash')} onDone={() => { setScreen('main'); setTab('learn'); }} />;
  else if (screen === 'onboarding') body = <Onboarding lang={lang} acc={acc} onDone={finishOnboarding} />;
  else if (screen === 'lesson') body = <Lesson unit={active.unit} lesson={active.lesson} lang={lang} acc={acc} state={prog} onExit={exitLesson} onComplete={completeLesson} onRefill={refillHearts} canRefill={prog.gems >= 350} />;
  else if (screen === 'complete') body = <LessonComplete result={result} lang={lang} acc={acc} onContinue={() => { setScreen('main'); setTab('learn'); }} />;
  else if (screen === 'streak') body = <Streak state={prog} lang={lang} acc={acc} onBack={() => setScreen('main')} />;
  else if (screen === 'settings') body = <Settings t={t} setTweak={setTweak} setDirection={setDirection} lang={lang} acc={acc}
    profile={profile} setProfile={setProfile} appSet={appSet} setAppSet={setAppSet} onReset={resetAll}
    onBack={() => { setScreen('main'); setTab('profile'); }} />;
  else { // main with tabs
    const common = { state: prog, lang, acc, onLang: toggleLang, onStreak: () => setScreen('streak') };
    const inner = tab === 'learn' ? <Home {...common} pref={pref} goal={appSet.goal} onStartLesson={startLesson} onSkipLesson={skipLesson} />
      : tab === 'league' ? <Leaderboard {...common} />
        : <Profile {...common} profile={profile} onSettings={() => setScreen('settings')} onTweaks={() => window.postMessage({ type: '__activate_edit_mode' }, '*')} />;
    body = (
      <div className="scr" style={{ background: 'var(--bg)' }}>
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>{inner}</div>
        <BottomNav tab={tab} onTab={setTab} lang={lang} />
        <div className="safe-bot" style={{ background: 'var(--surface)' }} />
      </div>
    );
  }

  if (isPhone) {
    return (
      <div ref={el => el && AvoTheme.applyVars(el, theme.vars)} className="phone-root"
        style={{ position: 'fixed', inset: 0, background: 'var(--bg)', fontFamily: 'var(--font-body)', overflow: 'hidden' }}>
        {body}
      </div>
    );
  }

  return (
    <React.Fragment>
      <Stage>
        <IOSDevice dark={statusLight}>
          <div ref={el => el && AvoTheme.applyVars(el, theme.vars)} style={{ position: 'relative', height: '100%', width: '100%', background: 'var(--bg)', fontFamily: 'var(--font-body)' }}>
            {body}
          </div>
        </IOSDevice>
      </Stage>

      <TweaksPanel title="Tweaks">
        <TweakSection label={lang === 'de' ? 'Design-Richtung' : 'Design direction'} />
        <TweakPick label={lang === 'de' ? 'Stil' : 'Style'} value={t.direction}
          options={Object.keys(DIR_LABEL).map(k => ({ value: k, label: T(DIR_LABEL[k], lang) }))}
          onChange={setDirection} />
        <TweakToggle label={lang === 'de' ? 'Dunkel-Modus' : 'Dark mode'} value={t.dark} onChange={v => setTweak('dark', v)} />

        <TweakSection label={lang === 'de' ? 'Marke' : 'Brand'} />
        <TweakColor label={lang === 'de' ? 'Akzentfarbe' : 'Accent'} value={t.accent}
          options={['#58CC02', '#2F7D4F', '#46D17A', '#E6A700', '#1CB0F6', '#CE82FF', '#FF6B57']}
          onChange={v => setTweak('accent', v)} />

        <TweakSection label={lang === 'de' ? 'Typografie & Form' : 'Type & shape'} />
        <TweakRadio label={lang === 'de' ? 'Schrift' : 'Font'} value={t.font}
          options={[{ value: 'rounded', label: lang === 'de' ? 'Rund' : 'Round' }, { value: 'clean', label: 'Clean' }, { value: 'serif', label: 'Serif' }]}
          onChange={v => setTweak('font', v)} />
        <TweakRadio label={lang === 'de' ? 'Ecken' : 'Corners'} value={t.radius}
          options={[{ value: 'sharp', label: lang === 'de' ? 'Eckig' : 'Sharp' }, { value: 'soft', label: 'Soft' }, { value: 'round', label: lang === 'de' ? 'Rund' : 'Round' }]}
          onChange={v => setTweak('radius', v)} />

        <TweakSection label={lang === 'de' ? 'Figur & Sprache' : 'Mascot & language'} />
        <TweakPick label={lang === 'de' ? 'Avo-Stil' : 'Avo style'} value={t.mascot}
          options={[{ value: 'tie', label: lang === 'de' ? 'Krawatte' : 'Necktie' }, { value: 'gavel', label: lang === 'de' ? 'Richterhammer' : 'Gavel' }, { value: 'glasses', label: lang === 'de' ? 'Brille' : 'Glasses' }, { value: 'bowtie', label: lang === 'de' ? 'Fliege' : 'Bow tie' }, { value: 'plain', label: lang === 'de' ? 'Pur' : 'Plain' }]}
          onChange={v => setTweak('mascot', v)} />
        <TweakRadio label={lang === 'de' ? 'Sprache' : 'Language'} value={lang}
          options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]}
          onChange={v => setTweak('lang', v)} />

        <TweakSection label={lang === 'de' ? 'Bildschirm anspringen' : 'Jump to screen'} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <TweakButton label="Splash" secondary onClick={() => setScreen('splash')} />
          <TweakButton label="Onboarding" secondary onClick={() => setScreen('onboarding')} />
          <TweakButton label={lang === 'de' ? 'Lernpfad' : 'Path'} secondary onClick={() => { setScreen('main'); setTab('learn'); }} />
          <TweakButton label={lang === 'de' ? 'Streak' : 'Streak'} secondary onClick={() => setScreen('streak')} />
          <TweakButton label={lang === 'de' ? 'Liga' : 'League'} secondary onClick={() => { setScreen('main'); setTab('league'); }} />
          <TweakButton label={lang === 'de' ? 'Profil' : 'Profile'} secondary onClick={() => { setScreen('main'); setTab('profile'); }} />
        </div>
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
