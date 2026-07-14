/* home.jsx — Lernpfad (winding learning path) */

const OFFS = [0, 42, 70, 42, 0, -42, -70, -42];
// cast guide that stands beside each unit on the path (avo is the player)
const UNIT_CAST = { u1: 'olive', u2: 'lemon', u3: 'gurke', u4: 'tomato', u5: 'pepper', u6: 'lemon' };
const CAST_LINE = {
  olive:   { de: 'Willkommen, Kollege!', en: 'Welcome, colleague!' },
  lemon:   { de: 'Recht gesprochen!', en: 'Order in the court!' },
  gurke:   { de: '…weiter geht’s.', en: '…carry on.' },
  tomato:  { de: 'Du schaffst das!', en: 'You’ve got this!' },
  pepper:  { de: 'Jetzt wird’s heiß!', en: 'Things heat up!' },
};
const CAST_NAME = {
  olive:  { n: 'Prof. Olive', c: '#76893F' },
  lemon:  { n: 'Richterin Justizia', c: '#D7A80C' },
  gurke:  { n: 'Lila', c: '#3E9B4F' },
  tomato: { n: 'Toni', c: '#E8442F' },
  pepper: { n: 'Chili', c: '#E23023' },
};

function PathCompanion({ unitId, side, lang }) {
  const name = UNIT_CAST[unitId];
  const [wiggle, setWiggle] = React.useState(0);
  if (!name) return null;
  const line = CAST_LINE[name];
  const poke = () => setWiggle(w => w + 1);
  return (
    <div style={{ display: 'flex', justifyContent: side === 'left' ? 'flex-start' : 'flex-end', alignItems: 'flex-end', gap: 8, padding: '2px 22px 4px' }}>
      {side === 'right' && line && <CompanionBubble lang={lang} line={line} who={name} />}
      <button onClick={poke} style={{ padding: 0 }} aria-label={name}>
        <div key={wiggle} className={wiggle ? 'hop' : 'float'}><Mascot name={name} size={86} idle={true} /></div>
      </button>
      {side === 'left' && line && <CompanionBubble lang={lang} line={line} who={name} />}
    </div>
  );
}

/* Tagesziel-Karte über dem Pfad */
function DailyGoalCard({ state, goal, lang }) {
  const date = new Date().toISOString().slice(0, 10);
  const xp = state.today && state.today.date === date ? state.today.xp : 0;
  const hit = xp >= goal;
  return (
    <div className="card" style={{ margin: '0 16px 14px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: hit ? 'var(--correct-tint)' : 'var(--primary-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={hit ? 'check' : 'star'} size={26} color={hit ? 'var(--correct)' : 'var(--primary)'} fill={hit ? 'none' : 'var(--primary)'} sw={hit ? 3 : 0} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14.5 }}>{hit ? T(STR.goalDone, lang) : T(STR.dailyGoal, lang)}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, color: hit ? 'var(--correct-ink)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{Math.min(xp, goal)} / {goal} XP</span>
        </div>
        <div style={{ display: 'flex', marginTop: 7 }}>
          <Progress value={(xp / goal) * 100} color={hit ? 'var(--correct)' : 'var(--gold)'} height={12} />
        </div>
      </div>
    </div>
  );
}
function CompanionBubble({ line, lang, who }) {
  const id = CAST_NAME[who];
  return (
    <div style={{ background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: 16, color: 'var(--text)', padding: '7px 13px 8px', boxShadow: '0 3px 0 var(--border)', marginBottom: 22, whiteSpace: 'nowrap' }}>
      {id && <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, letterSpacing: .7, textTransform: 'uppercase', color: id.c, marginBottom: 1 }}>{id.n}</div>}
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12.5 }}>{T(line, lang)}</div>
    </div>
  );
}

function PathNode({ state, color, icon, big, offset, onClick, lang, label }) {
  const isLocked = state === 'locked' || state === 'soon';
  const base = isLocked ? 'var(--locked)' : color;
  const shadow = isLocked ? 'var(--locked-shadow)' : AvoColor.darken(color, 0.2);
  const cur = state === 'current';
  return (
    <div style={{ position: 'relative', transform: `translateX(${offset}px)`, margin: '0 auto', width: big ? 96 : 80 }}>
      {cur && (
        <div style={{ position: 'absolute', top: -46, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
          <div className="float">
          <div className="pill" style={{ background: 'var(--surface)', border: '2px solid var(--border)', color: color, fontSize: 13, padding: '6px 13px', boxShadow: '0 4px 0 var(--border)', whiteSpace: 'nowrap', position: 'relative' }}>
            {T(label || STR.start, lang)}
            <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 12, height: 12, background: 'var(--surface)', borderRight: '2px solid var(--border)', borderBottom: '2px solid var(--border)' }} />
          </div>
          </div>
        </div>
      )}
      <button onClick={isLocked ? undefined : onClick} className="node" style={{ width: big ? 96 : 80, height: big ? 86 : 72, cursor: isLocked ? 'default' : 'pointer' }}>
        {cur && <span style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: `4px solid ${color}`, animation: 'ringPulse 1.6s ease-out infinite' }} />}
        <span className="node-base" style={{ background: shadow, inset: big ? '12px 0 0 0' : '10px 0 0 0' }} />
        <span className="node-top" style={{ background: base, inset: big ? '0 0 12px 0' : '0 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: cur ? 'inset 0 -3px 0 rgba(0,0,0,0.08)' : 'inset 0 -3px 0 rgba(0,0,0,0.12)' }}>
          <span style={cur ? { animation: 'nodeBounce 1.2s ease-in-out infinite' } : undefined}>
          {state === 'soon'
            ? <Icon name="lock" size={big ? 34 : 28} color="var(--locked-ink)" />
            : state === 'locked'
              ? <Icon name="lock" size={28} color="var(--locked-ink)" />
              : <Icon name={icon} size={big ? 42 : 34} color="#fff" fill="#fff" sw={0} />}
          </span>
        </span>
      </button>
    </div>
  );
}

function UnitBanner({ unit, index, lang }) {
  return (
    <div style={{ background: unit.color, borderRadius: 'var(--r-card)', padding: '16px 18px', margin: '6px 16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', boxShadow: `0 5px 0 ${AvoColor.darken(unit.color, 0.18)}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, letterSpacing: 1.2, opacity: .85, textTransform: 'uppercase' }}>{T(STR.unit, lang)} {index + 1}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--disp-w)', fontSize: 21, lineHeight: 1.1, marginTop: 2 }}>{T(unit.title, lang)}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, opacity: .92, marginTop: 3 }}>{T(unit.blurb, lang)}</div>
      </div>
      <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.16)', borderRadius: 12, padding: '9px 11px', color: '#fff', flexShrink: 0 }}>
        <Icon name="learn" size={22} color="#fff" />
      </button>
    </div>
  );
}

function Home({ state, lang, acc, pref, goal, onLang, onStreak, onStartLesson, onSkipLesson }) {
  const { done } = state;
  // onboarding-chosen topic floats to the top of the path
  const units = React.useMemo(() => {
    const i = pref ? COURSE.findIndex(u => u.id === pref) : -1;
    return i > 0 ? [COURSE[i], ...COURSE.filter((_, k) => k !== i)] : COURSE;
  }, [pref]);
  // find current lesson id (first playable not-done)
  let currentId = null;
  for (const u of units) for (const l of u.lessons) {
    if (currentId) break;
    if (!done.has(l.id) && !l.locked && l.exercises.length) currentId = l.id;
  }
  const lessonState = (l) => {
    if (done.has(l.id)) return 'done';
    if (l.locked || !l.exercises.length) return 'soon';
    if (l.id === currentId) return 'current';
    return 'locked';
  };
  let nodeCounter = 0;
  const curUnit = units.find(u => u.lessons.some(l => l.id === currentId));

  return (
    <div className="scr">
      <div className="safe-top" />
      <TopHud streak={state.streak} gems={state.gems} hearts={state.hearts} lang={lang} onLang={onLang} onStreak={onStreak} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px 8px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {lang === 'de' ? '\u{1F951} Demo \u2013 keine Rechtsberatung' : '\u{1F951} Demo \u2013 not legal advice'}
        </span>
      </div>
      <div className="scr-scroll" style={{ paddingBottom: 30 }}>
        {goal != null && <DailyGoalCard state={state} goal={goal} lang={lang} />}
        {units.map((unit, ui) => (
          <div key={unit.id}>
            <UnitBanner unit={unit} index={ui} lang={lang} />
            {/* Abschnitts-Maskottchen bleibt IMMER da — Avo ersetzt es nicht */}
            <PathCompanion unitId={unit.id} side={ui % 2 === 0 ? 'right' : 'left'} lang={lang} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', paddingTop: (curUnit && unit.id === curUnit.id) ? 34 : 6, paddingBottom: 10 }}>
              {unit.lessons.map((l, li) => {
                const st = lessonState(l);
                const off = OFFS[nodeCounter % OFFS.length];
                nodeCounter++;
                const big = ui === 0 && li === 0;
                const icon = st === 'done' ? (li === 0 ? 'star' : 'check') : (big ? 'star' : 'learn');
                return (
                  <div key={l.id} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    <PathNode state={st} color={unit.color} icon={icon} big={big} offset={off}
                      lang={lang} onClick={() => onStartLesson(unit, l)} />
                    {st === 'current' && (
                      <div style={{ position: 'absolute', top: -34, left: '50%', transform: `translateX(${off > 0 ? off - 214 : off + 110}px)`, pointerEvents: 'none' }}>
                        {/* Avo wandert mit: hüpft sichtbar zum jeweils aktuellen Level */}
                        <div key={currentId} className="hop">
                          <div className="float"><Avocado size={104} mood="happy" accessory={acc} /></div>
                        </div>
                      </div>
                    )}
                    {st === 'current' && (
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--text)', marginTop: 8, transform: `translateX(${off}px)`, maxWidth: 220, textAlign: 'center' }}>{T(l.title, lang)}</div>
                    )}
                    {st === 'current' && onSkipLesson && (
                      <button onClick={() => onSkipLesson(unit, l)} disabled={state.gems < 10}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, transform: `translateX(${off}px)`,
                          background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: 999,
                          padding: '7px 14px', boxShadow: '0 3px 0 var(--border)', cursor: state.gems < 10 ? 'default' : 'pointer',
                          opacity: state.gems < 10 ? .5 : 1, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12.5, color: 'var(--blue)', whiteSpace: 'nowrap' }}>
                        <Icon name="gem" size={17} color="var(--blue)" />
                        {lang === 'de' ? 'Level überspringen' : 'Skip level'}
                        <span style={{ background: 'var(--blue-tint)', color: 'var(--blue-ink)', borderRadius: 999, padding: '1px 8px', fontSize: 12 }}>–10</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, padding: '14px 0 8px' }}>
          {T(STR.moreSoon, lang)} {'\u{1F331}'}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Home, PathNode });
