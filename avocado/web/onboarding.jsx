/* onboarding.jsx — Splash + onboarding question flow */

// typewriter text like Duo
function TypeText({ text, speed = 28 }) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => { setN(0); const id = setInterval(() => setN(k => { if (k >= text.length) { clearInterval(id); return k; } return k + 1; }), speed); return () => clearInterval(id); }, [text]);
  return <span>{text.slice(0, n)}<span style={{ opacity: 0 }}>{text.slice(n)}</span></span>;
}

// Avo's coaching lines read as AI-generated: show a typing indicator (three dots)
// while the line "loads", then reveal it (typewriter for monologue, instant for prompts).
function AiSpeech({ text, style, dir = 'left', thinkMs = 700, instant = false }) {
  const [thinking, setThinking] = React.useState(true);
  React.useEffect(() => { setThinking(true); const id = setTimeout(() => setThinking(false), thinkMs); return () => clearTimeout(id); }, [text]);
  return <Speech dir={dir} style={style}>{thinking ? <TypingDots /> : (instant ? text : <TypeText text={text} />)}</Speech>;
}

function Splash({ lang, acc, onStart, onLogin }) {
  return (
    <div className="scr" style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}>
      <div className="safe-top" />
      <div className="scr-scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px' }}>
        <div className="float"><Avocado size={210} mood="wave" accessory={acc} /></div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--disp-w)', fontSize: 42, lineHeight: 1.0, marginTop: 22, letterSpacing: .3, textAlign: 'center' }}>
          Avocado
          <div style={{ fontSize: 30, marginTop: 4 }}><span style={{ opacity: .7, fontWeight: 600 }}>at </span>Law</div>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, marginTop: 12, opacity: .92, maxWidth: 280 }}>
          {lang === 'de' ? 'Lerne deine Rechte \u2013 spielerisch, t\u00E4glich, in Mini-Lektionen.' : 'Learn your rights \u2013 playfully, daily, in bite-size lessons.'}
        </div>
      </div>
      <div style={{ padding: '0 22px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Btn variant="ghost" onClick={onStart} style={{ background: '#ffffff', color: 'var(--primary)', boxShadow: '0 4px 0 rgba(0,0,0,0.18)', border: 'none' }}>
          {T(STR.getStarted, lang)}
        </Btn>
        <button onClick={onLogin} style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, letterSpacing: .6, color: 'var(--primary-ink)', opacity: .9, padding: 8 }}>
          {T(STR.haveAccount, lang)}
        </button>
      </div>
      <div className="safe-bot" />
    </div>
  );
}

// option row used by choose-steps
function OptRow({ active, onClick, left, label, right }) {
  return (
    <button onClick={onClick} className="opt" style={active ? { borderColor: 'var(--blue)', background: 'var(--blue-tint)' } : null}>
      {left}
      <span style={{ flex: 1, fontWeight: 700, color: active ? 'var(--blue-ink)' : 'var(--text)' }}>{label}</span>
      {right}
    </button>
  );
}

const ONB_STEPS = [
  { kind: 'say', text: STR.hi, mood: 'wave' },
  { kind: 'say', text: STR.quick, mood: 'happy' },
  { kind: 'choose', q: STR.langQ, opts: 'langs', style: 'flag' },
  { kind: 'choose', q: STR.whyQ, opts: 'why', style: 'emoji' },
  { kind: 'choose', q: STR.knowQ, opts: 'know', style: 'bars' },
  { kind: 'say', text: STR.fresh, mood: 'happy' },
  { kind: 'choose', q: STR.hearQ, opts: 'hear', style: 'plain' },
  { kind: 'choose', q: STR.dailyGoalQ, opts: 'goals', style: 'tag' },
  { kind: 'notif' },
  { kind: 'achieve' },
  { kind: 'choose', q: STR.startWhereQ, opts: 'startWhere', style: 'start' },
];

function Onboarding({ lang, acc, onDone }) {
  const [i, setI] = React.useState(0);
  const [sel, setSel] = React.useState({});
  const [phase, setPhase] = React.useState('onb'); // 'onb' | 'placement'
  const CAT_STEP = ONB_STEPS.findIndex(s => s.opts === 'langs');
  const category = sel[CAT_STEP] != null ? CAT_UNIT[sel[CAT_STEP]] : null;
  const step = ONB_STEPS[i];
  const pct = (i / (ONB_STEPS.length - 1)) * 100;
  const finishOnb = () => {
    const lastIdx = ONB_STEPS.length - 1; // "Wo möchtest du starten?" step
    const mode = sel[lastIdx]; // 0 = Bei Null anfangen, 1 = Mein Level finden
    if (mode === 1) { setPhase('placement'); return; }
    onDone({ category, mode: 'scratch', score: 0 });
  };
  const next = () => { if (i >= ONB_STEPS.length - 1) finishOnb(); else setI(i + 1); };
  const back = () => { if (i > 0) setI(i - 1); };
  const choose = (idx) => setSel(s => ({ ...s, [i]: idx }));
  const needsChoice = (step.kind === 'choose') && sel[i] == null;

  if (phase === 'placement') {
    return <Placement lang={lang} acc={acc}
      onBack={() => setPhase('onb')}
      onDone={(score) => onDone({ category, mode: 'level', score })} />;
  }

  const bars = (lvl) => (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'flex-end', width: 26, height: 22 }}>
      {[1, 2, 3, 4].map(b => <span key={b} style={{ width: 5, height: 5 + b * 4, borderRadius: 2, background: b <= lvl ? 'var(--correct)' : 'var(--border)' }} />)}
    </span>
  );

  let body;
  if (step.kind === 'say') {
    body = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          <div className="float" style={{ flexShrink: 0, marginLeft: -6 }}><Avocado size={148} mood={step.mood} accessory={acc} /></div>
          <AiSpeech key={i} text={T(step.text, lang)} style={{ marginBottom: 42 }} />
        </div>
      </div>
    );
  } else if (step.kind === 'notif') {
    body = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          <Avocado size={92} mood="happy" accessory={acc} />
          <AiSpeech text={T(STR.reminder, lang)} instant style={{ marginBottom: 22 }} />
        </div>
        {/* iOS-native permission alert, like the Duolingo flow */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 30 }}>
          <div style={{ width: 276, borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 16px 44px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 18px 14px', textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15.5, lineHeight: 1.3, color: 'var(--text)' }}>
                {lang === 'de' ? '\u201EAvocado at Law\u201C m\u00F6chte dir Mitteilungen senden' : '\u201CAvocado at Law\u201D Would Like to Send You Notifications'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.35, marginTop: 6 }}>
                {lang === 'de' ? 'Mitteilungen k\u00F6nnen Hinweise, T\u00F6ne und Symbol-Badges sein. Anpassbar in den Einstellungen.' : 'Notifications may include alerts, sounds and icon badges. Configurable in Settings.'}
              </div>
            </div>
            <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
              <button onClick={next} style={{ flex: 1, padding: '12px 0', color: 'var(--blue)', fontWeight: 600, fontSize: 15.5, borderRight: '1px solid var(--border)' }}>{lang === 'de' ? 'Nicht erlauben' : 'Don\u2019t Allow'}</button>
              <button onClick={next} style={{ flex: 1, padding: '12px 0', color: 'var(--blue)', fontWeight: 800, fontSize: 15.5 }}>{lang === 'de' ? 'Erlauben' : 'Allow'}</button>
            </div>
          </div>
        </div>
        {/* arrow nudging toward Allow */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <div style={{ width: 276, display: 'flex', justifyContent: 'flex-end', paddingRight: 56 }}>
            <div className="float">
              <svg width="28" height="40" viewBox="0 0 28 40" fill="none" stroke="var(--blue)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 38V7M14 7l-8 9M14 7l8 9" /></svg>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (step.kind === 'achieve') {
    body = (
      <div style={{ flex: 1, padding: '8px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Avocado size={88} mood="celebrate" accessory={acc} />
          <AiSpeech text={lang === 'de' ? 'Das schaffst du\nin 3 Monaten!' : 'Here\u2019s what you\u2019ll\nreach in 3 months!'} instant style={{ marginTop: 6 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 26 }}>
          {ONB.achieve3.map((a, k) => (
            <div key={k} className="slide-up" style={{ display: 'flex', gap: 14, alignItems: 'center', animationDelay: `${k * .1}s` }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: a.c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={['heart', 'learn', 'flame'][k]} size={26} color="#fff" fill="#fff" sw={0} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17 }}>{T(a, lang)}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{T(a.sub, lang)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } else { // choose
    const opts = step.opts === 'startWhere'
      ? [{ rec: true, t: { de: 'Bei Null anfangen', en: 'Start from scratch' }, s: { de: 'Die leichteste Lektion zuerst', en: 'The easiest lesson first' } },
         { t: { de: 'Mein Level finden', en: 'Find my level' }, s: { de: 'Avo platziert dich passend', en: 'Avo places you right' } }]
      : ONB[step.opts];
    body = (
      <div style={{ flex: 1, padding: '4px 22px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18 }}>
          <Avocado size={76} mood="happy" accessory={acc} />
          <AiSpeech text={T(step.q, lang)} instant style={{ marginTop: 4 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {opts.map((o, k) => {
            const active = sel[i] === k;
            let left = null, right = null, label = T(o, lang);
            if (step.style === 'flag') left = <span style={{ fontSize: 26 }}>{o.flag}</span>;
            else if (step.style === 'emoji') left = <span style={{ fontSize: 24 }}>{o.emoji}</span>;
            else if (step.style === 'bars') left = bars(o.lvl);
            else if (step.style === 'tag') right = <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, color: active ? 'var(--blue-ink)' : 'var(--text-muted)' }}>{T(o.tag, lang)}</span>;
            else if (step.style === 'start') {
              label = T(o.t, lang);
              left = <div style={{ width: 40, height: 40, borderRadius: 10, background: o.rec ? 'var(--gold)' : 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={o.rec ? 'star' : 'learn'} size={24} color="#fff" fill="#fff" sw={0} /></div>;
              right = o.rec ? <span className="pill" style={{ background: 'var(--blue)', color: '#fff', fontSize: 11, padding: '4px 8px' }}>{lang === 'de' ? 'EMPFOHLEN' : 'PICK'}</span> : null;
            }
            if (step.style === 'start') {
              return (
                <button key={k} onClick={() => choose(k)} className="opt" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, ...(active ? { borderColor: 'var(--blue)', background: 'var(--blue-tint)' } : {}) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>{left}<span style={{ flex: 1, fontWeight: 800 }}>{label}</span>{right}</div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', paddingLeft: 54 }}>{T(o.s, lang)}</span>
                </button>
              );
            }
            return <OptRow key={k} active={active} onClick={() => choose(k)} left={left} label={label} right={right} />;
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="scr">
      <div className="safe-top" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 18px 10px' }}>
        <button onClick={back} style={{ padding: 4, opacity: i === 0 ? .3 : 1 }}><Icon name="x" size={26} color="var(--text-muted)" /></button>
        <Progress value={pct} />
      </div>
      <div className="scr-scroll" style={{ display: 'flex', flexDirection: 'column' }}>{body}</div>
      <div style={{ padding: '12px 22px', borderTop: step.kind === 'choose' ? '2px solid var(--border)' : 'none' }}>
        <Btn onClick={next} disabled={needsChoice}>{T(STR.continue, lang)}</Btn>
      </div>
      <div className="safe-bot" />
    </div>
  );
}

// ── Placement mini-test ("Mein Level finden") ──────────────────────────────
function Placement({ lang, acc, onBack, onDone }) {
  const qs = PLACEMENT;
  const [started, setStarted] = React.useState(false);
  const [idx, setIdx] = React.useState(0);
  const [sel, setSel] = React.useState(null);
  const [score, setScore] = React.useState(0);
  const q = qs[idx];

  if (!started) {
    return (
      <div className="scr">
        <div className="safe-top" />
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 18px 10px' }}>
          <button onClick={onBack} style={{ padding: 4 }}><Icon name="back" size={26} color="var(--text-muted)" /></button>
        </div>
        <div className="scr-scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px' }}>
          <div className="float"><Avocado size={170} mood="happy" accessory={acc} /></div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--disp-w)', fontSize: 26, marginTop: 14 }}>{T(STR.placeTitle, lang)}</div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-muted)', marginTop: 8, maxWidth: 280 }}>{T(STR.placeSub, lang)}</div>
        </div>
        <div style={{ padding: '12px 22px' }}>
          <Btn variant="correct" onClick={() => setStarted(true)}>{T(STR.placeStart, lang)}</Btn>
        </div>
        <div className="safe-bot" />
      </div>
    );
  }

  const submit = () => {
    const ok = sel === q.answer;
    const ns = score + (ok ? 1 : 0);
    if (idx >= qs.length - 1) { onDone(ns); return; }
    setScore(ns); setIdx(idx + 1); setSel(null);
  };
  const pct = (idx / qs.length) * 100;

  return (
    <div className="scr">
      <div className="safe-top" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 18px 10px' }}>
        <button onClick={() => (idx === 0 ? setStarted(false) : (setIdx(idx - 1), setSel(null)))} style={{ padding: 4 }}><Icon name="x" size={26} color="var(--text-muted)" /></button>
        <Progress value={pct} />
      </div>
      <div className="scr-scroll" style={{ padding: '6px 22px 20px', display: 'flex', flexDirection: 'column' }}>
        <div key={idx} className="slide-up">
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--disp-w)', fontSize: 22, lineHeight: 1.22, color: 'var(--text)', margin: '4px 0 20px' }}>{T(q.q, lang)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {q.options.map((o, k) => (
              <button key={k} className={'opt' + (sel === k ? ' sel' : '')} onClick={() => setSel(k)}>
                <span style={{ width: 26, height: 26, borderRadius: 8, border: '2px solid currentColor', opacity: .4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{k + 1}</span>
                <span style={{ flex: 1 }}>{T(o, lang)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 22px', borderTop: '2px solid var(--border)' }}>
        <Btn onClick={submit} disabled={sel == null} variant={sel == null ? 'primary' : 'correct'}>{T(STR.continue, lang)}</Btn>
      </div>
      <div className="safe-bot" />
    </div>
  );
}

// ── Login (existing account) ───────────────────────────────────────────────
function LoginField({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: .6 }}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', padding: '13px 14px', borderRadius: 'var(--r-card)', border: '2px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-body)', outline: 'none' }} />
    </label>
  );
}

function Login({ lang, acc, onBack, onDone }) {
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const sso = (mark, color, label) => (
    <button className="btn3d ghost" onClick={onDone} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 15, gap: 12 }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{mark}</span>
      {label}
    </button>
  );
  const appleMark = (
    <svg viewBox="0 0 384 512" width="13" height="15" fill="#fff"><path d="M318.7 268c-.3-37 16.4-65 50.3-85-19-27-47.5-42-85-45-36-3-75 21-89 21-15 0-47-20-78-19-40 .6-77 23-98 59-42 73-11 181 30 240 20 29 44 61 75 60 30-1 42-19 78-19 36 0 46 19 78 19 32-1 53-29 73-58 23-33 32-65 33-67-1-1-63-24-63-100z"/><path d="M257 84c17-21 28-49 25-78-25 1-55 17-73 38-16 18-30 47-26 75 28 2 57-14 74-35z"/></svg>
  );
  return (
    <div className="scr">
      <div className="safe-top" />
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 18px 4px' }}>
        <button onClick={onBack} style={{ padding: 4 }}><Icon name="back" size={26} color="var(--text-muted)" /></button>
      </div>
      <div className="scr-scroll" style={{ padding: '4px 26px 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div className="float"><Avocado size={116} mood="wave" accessory={acc} /></div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--disp-w)', fontSize: 26, marginTop: 8 }}>{T(STR.loginTitle, lang)}</div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>{T(STR.loginSub, lang)}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 22 }}>
          <LoginField label={T(STR.emailLabel, lang)} type="email" value={email} onChange={setEmail} placeholder={lang === 'de' ? 'du@beispiel.at' : 'you@example.com'} />
          <LoginField label={T(STR.pwLabel, lang)} type="password" value={pw} onChange={setPw} placeholder={'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'} />
          <button onClick={onDone} style={{ alignSelf: 'flex-end', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, color: 'var(--blue)' }}>{T(STR.forgotPw, lang)}</button>
        </div>
        <div style={{ marginTop: 8 }}><Btn variant="correct" onClick={onDone}>{T(STR.signIn, lang)}</Btn></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 16px' }}>
          <div style={{ flex: 1, height: 2, background: 'var(--border)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 11.5, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: .6 }}>{T(STR.orWith, lang)}</span>
          <div style={{ flex: 1, height: 2, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sso('G', '#4285F4', lang === 'de' ? 'Mit Google fortfahren' : 'Continue with Google')}
          {sso(appleMark, '#111', lang === 'de' ? 'Mit Apple fortfahren' : 'Continue with Apple')}
        </div>
      </div>
      <div className="safe-bot" />
    </div>
  );
}

Object.assign(window, { Splash, Onboarding, Placement, Login });
