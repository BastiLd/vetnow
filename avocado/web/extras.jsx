/* extras.jsx — lesson complete, streak, leaderboard, profile */

function StatTile({ color, label, value, icon }) {
  return (
    <div style={{ flex: 1, borderRadius: 16, border: `2px solid ${color}`, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ background: color, color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, letterSpacing: .8, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon && <Icon name={icon} size={16} color="#fff" fill="#fff" sw={0} />}{label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 12px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color }}>
        {value}
      </div>
    </div>
  );
}

function useCountUp(target, ms = 900, delay = 300) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    setV(0);
    let raf, start, done = false;
    const finish = () => { if (!done) { done = true; setV(target); } };
    const tick = (t) => {
      if (done) return;
      if (!start) start = t;
      const p = Math.min(1, (t - start - delay) / ms);
      if (p >= 0) setV(Math.round(target * (1 - Math.pow(1 - Math.max(0, p), 3))));
      if (p < 1) raf = requestAnimationFrame(tick); else finish();
    };
    raf = requestAnimationFrame(tick);
    // rAF is paused while the tab/iframe is backgrounded — timer fallback guarantees the final value lands
    const fallback = setTimeout(finish, delay + ms + 250);
    return () => { done = true; cancelAnimationFrame(raf); clearTimeout(fallback); };
  }, [target]);
  return v;
}

function LessonComplete({ result, lang, acc, onContinue }) {
  const acc100 = result.total ? Math.round((result.correct / result.total) * 100) : 100;
  const xpShown = useCountUp(result.xp);
  const accShown = useCountUp(acc100, 900, 600);
  const stars = acc100 >= 90 ? 3 : acc100 >= 60 ? 2 : 1;
  return (
    <div className="scr" style={{ overflow: 'hidden' }}>
      <Confetti />
      <div className="safe-top" />
      <div className="scr-scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 26px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 4, height: 64 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ animation: `starBurst .55s cubic-bezier(.2,1.4,.4,1) ${.45 + i * .28}s both`, transform: 'scale(0)', opacity: i < stars ? 1 : .22, marginBottom: i === 1 ? 14 : 0 }}>
              <Icon name="star" size={i === 1 ? 58 : 44} color="var(--gold)" fill="var(--gold)" sw={0} />
            </div>
          ))}
        </div>
        <div className="pop"><Avocado size={166} mood="celebrate" accessory={acc} /></div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--disp-w)', fontSize: 29, lineHeight: 1.12, color: 'var(--gold)', marginTop: 12, textAlign: 'center' }}>{T(STR.amazing, lang)}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--text-muted)', marginTop: 6 }}>{T(STR.lessonDone, lang)}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, width: '100%', maxWidth: 320 }}>
          <StatTile color="var(--gold)" icon="star" label={T(STR.totalXp, lang)} value={`+${xpShown}`} />
          <StatTile color="var(--correct)" icon="check" label={lang === 'de' ? 'TREFFER' : 'ACCURACY'} value={`${accShown}%`} />
        </div>
        {result.gems > 0 && (
          <div className="pill pop" style={{ marginTop: 14, background: 'var(--blue-tint)', color: 'var(--blue-ink)', fontSize: 15 }}>
            <Icon name="gem" size={18} color="var(--blue)" /> +{result.gems} {T(STR.gemsLabel, lang)} {T(STR.bonus, lang)}
          </div>
        )}
      </div>
      <div style={{ padding: '14px 22px' }}>
        <Btn variant="correct" onClick={onContinue}>{T(STR.continue, lang)}</Btn>
      </div>
      <div className="safe-bot" />
    </div>
  );
}

function Streak({ state, lang, acc, onBack }) {
  const days = lang === 'de' ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const todayIdx = 3;
  return (
    <div className="scr" style={{ background: 'linear-gradient(180deg, var(--streak) 0%, var(--streak) 38%, var(--bg) 38%)' }}>
      <div className="safe-top" />
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 18px' }}>
        <button onClick={onBack} style={{ padding: 6 }}><Icon name="x" size={26} color="#fff" /></button>
      </div>
      <div className="scr-scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '6px 26px 24px' }}>
        <div className="pop" style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--disp-w)', fontSize: 78, color: '#fff', lineHeight: 1, textShadow: '0 4px 0 rgba(0,0,0,0.12)' }}>{state.streak}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#fff', marginTop: 2 }}>{T(STR.streakTitle, lang)}</div>
        <div className="float" style={{ margin: '18px 0 6px' }}><Avocado size={150} mood="fire" accessory={acc} /></div>
        <div className="card" style={{ width: '100%', maxWidth: 330, padding: '18px 16px', marginTop: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {days.map((d, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, color: 'var(--text-muted)' }}>{d}</span>
                <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i <= todayIdx ? 'var(--streak)' : 'var(--surface-2)', border: i === todayIdx ? '2px solid var(--text)' : 'none' }}>
                  {i <= todayIdx && <Icon name="flame" size={18} color="#fff" />}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.4 }}>{T(STR.streakSub, lang)}</div>
        </div>
        {/* next milestone */}
        <div className="card slide-up" style={{ width: '100%', maxWidth: 330, padding: '15px 16px', marginTop: 14, display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--blue-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="gem" size={28} color="var(--blue)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14.5 }}>{T(STR.nextMilestone, lang)}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, color: 'var(--streak)', whiteSpace: 'nowrap' }}>{state.streak} / 7 {T(STR.milestoneDays, lang)}</span>
            </div>
            <div style={{ display: 'flex', marginTop: 7 }}>
              <Progress value={(state.streak / 7) * 100} color="var(--streak)" height={12} />
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', marginTop: 6 }}>{T(STR.milestoneReward, lang)}</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 22px' }}>
        <Btn variant="primary" onClick={onBack} style={{ background: 'var(--streak)', boxShadow: `0 4px 0 ${AvoColor.darken('#FF9600', 0.2)}`, color: '#fff' }}>{T(STR.keepFire, lang)}</Btn>
      </div>
      <div className="safe-bot" />
    </div>
  );
}

function rankRows(state, lang) {
  const rows = LEAGUE.map(r => r.name === '__you__'
    ? { ...r, name: lang === 'de' ? 'Du' : 'You', xp: state.xp, you: true }
    : r).sort((a, b) => b.xp - a.xp);
  return rows;
}

function Leaderboard({ state, lang, onLang, onStreak }) {
  const rows = rankRows(state, lang);
  const medal = ['#FFC800', '#C0C8D0', '#CD7F4D'];
  return (
    <div className="scr">
      <div className="safe-top" />
      <TopHud streak={state.streak} gems={state.gems} hearts={state.hearts} lang={lang} onLang={onLang} onStreak={onStreak} />
      <div style={{ textAlign: 'center', padding: '4px 20px 14px', borderBottom: '2px solid var(--border)' }}>
        <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: '50%', background: 'var(--gold)', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 0 ' + AvoColor.darken('#FFC800', 0.2) }}>
          <Icon name="trophy" size={36} color="#fff" />
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--disp-w)', fontSize: 24, marginTop: 8 }}>{T(STR.league, lang)}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>{T(STR.leagueSub, lang)}</div>
      </div>
      <div className="scr-scroll" style={{ padding: '8px 14px 20px' }}>
        {rows.map((r, i) => {
          const promo = i < 3;
          return (
            <React.Fragment key={r.name + i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 16, background: r.you ? 'var(--primary-tint)' : 'transparent' }}>
                <span style={{ width: 26, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: i < 3 ? medal[i] : 'var(--text-muted)' }}>{i + 1}</span>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  <Mascot name={r.mascot} size={42} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16 }}>{r.name}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>{T(r.tag, lang)}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.xp} XP</div>
              </div>
              {i === 2 && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px' }}>
                <div style={{ flex: 1, height: 2, background: 'var(--correct)', opacity: .5 }} />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, color: 'var(--correct)', letterSpacing: .6 }}>{lang === 'de' ? 'AUFSTIEGSZONE' : 'PROMOTION ZONE'}</span>
                <div style={{ flex: 1, height: 2, background: 'var(--correct)', opacity: .5 }} />
              </div>}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ── In-App-Einstellungen ─────────────────────────────────────────────── */
function SetCard({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 4px 8px' }}>{title}</div>
      <div className="card" style={{ overflow: 'hidden' }}>{children}</div>
    </div>
  );
}
function SetRow({ label, children, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 15px', borderBottom: last ? 'none' : '2px solid var(--surface-2)' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>{children}</div>
    </div>
  );
}
function SetToggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{ width: 52, height: 30, borderRadius: 999, background: value ? 'var(--correct)' : 'var(--surface-2)', border: '2px solid ' + (value ? 'var(--correct)' : 'var(--border)'), position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: value ? 24 : 2, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .15s' }} />
    </button>
  );
}
function SetChip({ on, onClick, children }) {
  return (
    <button onClick={onClick} className="pill" style={{ padding: '6px 12px', fontSize: 13, border: '2px solid ' + (on ? 'var(--blue)' : 'var(--border)'), background: on ? 'var(--blue-tint)' : 'var(--surface)', color: on ? 'var(--blue-ink)' : 'var(--text-muted)' }}>{children}</button>
  );
}

function Settings({ t, setTweak, setDirection, lang, acc, profile, setProfile, appSet, setAppSet, onReset, onBack }) {
  const [confirmReset, setConfirmReset] = React.useState(false);
  const dirs = [{ v: 'klassik', l: 'Klassik' }, { v: 'mitternacht', l: 'Mitternacht' }, { v: 'kanzlei', l: 'Kanzlei' }];
  const fonts = [{ v: 'rounded', l: lang === 'de' ? 'Rund' : 'Round' }, { v: 'clean', l: 'Clean' }, { v: 'serif', l: 'Serif' }];
  const mascots = [{ v: 'tie', l: lang === 'de' ? 'Krawatte' : 'Necktie' }, { v: 'gavel', l: lang === 'de' ? 'Hammer' : 'Gavel' }, { v: 'glasses', l: lang === 'de' ? 'Brille' : 'Glasses' }, { v: 'bowtie', l: lang === 'de' ? 'Fliege' : 'Bow tie' }, { v: 'plain', l: 'Pur' }];
  const goals = [10, 20, 30, 50];
  const colors = ['#58CC02', '#2F7D4F', '#46D17A', '#E6A700', '#1CB0F6', '#CE82FF', '#FF6B57'];
  const inputStyle = { boxSizing: 'border-box', width: 150, padding: '9px 11px', borderRadius: 10, border: '2px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14.5, fontWeight: 700, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' };
  return (
    <div className="scr">
      <div className="safe-top" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 18px 10px' }}>
        <button onClick={onBack} style={{ padding: 4 }}><Icon name="back" size={26} color="var(--text-muted)" /></button>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--disp-w)', fontSize: 21 }}>{T(STR.settings, lang)}</span>
        <div style={{ marginLeft: 'auto' }}><Avocado size={46} mood="happy" accessory={acc} idle={false} /></div>
      </div>
      <div className="scr-scroll" style={{ padding: '4px 18px 26px' }}>
        <SetCard title={T(STR.secAppearance, lang)}>
          <SetRow label={T(STR.setStyle, lang)}>
            {dirs.map(d => <SetChip key={d.v} on={t.direction === d.v} onClick={() => setDirection(d.v)}>{d.l}</SetChip>)}
          </SetRow>
          <SetRow label={T(STR.setDark, lang)}>
            <SetToggle value={t.dark} onChange={v => setTweak('dark', v)} />
          </SetRow>
          <SetRow label={T(STR.setAccent, lang)}>
            {colors.map(c => (
              <button key={c} onClick={() => setTweak('accent', c)} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: t.accent === c ? '3px solid var(--text)' : '2px solid var(--border)', flexShrink: 0 }} />
            ))}
          </SetRow>
          <SetRow label={T(STR.setFont, lang)}>
            {fonts.map(f => <SetChip key={f.v} on={t.font === f.v} onClick={() => setTweak('font', f.v)}>{f.l}</SetChip>)}
          </SetRow>
          <SetRow label={T(STR.setMascot, lang)} last>
            {mascots.map(m => <SetChip key={m.v} on={t.mascot === m.v} onClick={() => setTweak('mascot', m.v)}>{m.l}</SetChip>)}
          </SetRow>
        </SetCard>

        <SetCard title={T(STR.secLearning, lang)}>
          <SetRow label={T(STR.setGoal, lang)}>
            {goals.map(g => <SetChip key={g} on={appSet.goal === g} onClick={() => setAppSet(s => ({ ...s, goal: g }))}>{g} XP</SetChip>)}
          </SetRow>
          <SetRow label={T(STR.setReminders, lang)}>
            <SetToggle value={appSet.reminders} onChange={v => setAppSet(s => ({ ...s, reminders: v }))} />
          </SetRow>
          <SetRow label={T(STR.setSound, lang)} last>
            <SetToggle value={appSet.sound} onChange={v => setAppSet(s => ({ ...s, sound: v }))} />
          </SetRow>
        </SetCard>

        <SetCard title={T(STR.secAccount, lang)}>
          <SetRow label={T(STR.setName, lang)}>
            <input style={inputStyle} value={profile.name} placeholder={lang === 'de' ? 'Dein Name' : 'Your name'} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
          </SetRow>
          <SetRow label={T(STR.setUser, lang)}>
            <input style={inputStyle} value={profile.user} onChange={e => setProfile(p => ({ ...p, user: e.target.value.replace(/\s/g, '') }))} />
          </SetRow>
          <SetRow label={T(STR.setLang, lang)} last>
            <SetChip on={lang === 'de'} onClick={() => setTweak('lang', 'de')}>Deutsch</SetChip>
            <SetChip on={lang === 'en'} onClick={() => setTweak('lang', 'en')}>English</SetChip>
          </SetRow>
        </SetCard>

        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="btn3d ghost" style={{ color: 'var(--wrong)', fontSize: 14 }}>{T(STR.setReset, lang)}</button>
        ) : (
          <div className="card pop" style={{ padding: '16px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, marginBottom: 12 }}>{T(STR.setResetSure, lang)}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="danger" onClick={onReset} style={{ fontSize: 13.5 }}>{T(STR.yes, lang)}</Btn>
              <Btn variant="ghost" onClick={() => setConfirmReset(false)} style={{ fontSize: 13.5 }}>{T(STR.no, lang)}</Btn>
            </div>
          </div>
        )}
      </div>
      <div className="safe-bot" />
    </div>
  );
}

function Profile({ state, lang, acc, onLang, onStreak, onTweaks, onSettings, profile }) {
  const tiles = [
    { c: 'var(--streak)', icon: 'flame', label: T(STR.dayStreak, lang), v: state.streak },
    { c: 'var(--gold)', icon: 'star', label: T(STR.totalXpStat, lang), v: state.xp },
    { c: 'var(--blue)', icon: 'trophy', label: T(STR.leagueStat, lang), v: lang === 'de' ? 'Avocado' : 'Avocado' },
    { c: 'var(--primary)', icon: 'check', label: lang === 'de' ? 'Lektionen' : 'Lessons', v: state.done.size },
  ];
  const ach = [
    { c: '#FFC800', icon: 'flame', t: { de: 'Erste Flamme', en: 'First flame' }, on: state.streak >= 1 },
    { c: '#CE82FF', icon: 'star', t: { de: 'Frischling', en: 'Sprout' }, on: state.done.size >= 1 },
    { c: '#1CB0F6', icon: 'learn', t: { de: 'Wissbegierig', en: 'Curious' }, on: state.done.size >= 2 },
    { c: '#58CC02', icon: 'check', t: { de: 'Fleißbiene', en: 'Busy bee' }, on: state.done.size >= 5 },
    { c: '#FF9600', icon: 'gem', t: { de: 'Gem-Sammler', en: 'Gem collector' }, on: state.gems >= 550 },
    { c: '#9AA0A6', icon: 'trophy', t: { de: 'Liga-Held', en: 'League hero' }, on: state.xp >= 500 },
  ];
  return (
    <div className="scr">
      <div className="safe-top" />
      <TopHud streak={state.streak} gems={state.gems} hearts={state.hearts} lang={lang} onLang={onLang} onStreak={onStreak} />
      <div className="scr-scroll" style={{ padding: '6px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 92, height: 92, borderRadius: '50%', background: 'var(--primary-tint)', border: '3px solid var(--primary)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            <Avocado size={86} mood="happy" accessory={acc} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--disp-w)', fontSize: 24 }}>{(profile && profile.name) || (lang === 'de' ? 'Du' : 'You')}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>@{(profile && profile.user) || 'avocado_rookie'}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>{T(STR.member, lang)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onSettings} className="btn3d ghost" style={{ fontSize: 14, flex: 1 }}>
            <Icon name="settings" size={20} color="var(--primary)" /> {T(STR.settings, lang)}
          </button>
          <button onClick={onTweaks} className="btn3d ghost" style={{ fontSize: 14, flex: 1 }}>
            <Icon name="star" size={20} color="var(--primary)" /> {lang === 'de' ? 'TWEAKS' : 'TWEAKS'}
          </button>
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, margin: '22px 0 12px' }}>{T(STR.statistics, lang)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {tiles.map((t, i) => (
            <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px' }}>
              <Icon name={t.icon} size={28} color={t.c} fill={t.c} sw={0} />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>{t.v}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>{t.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, margin: '22px 0 12px' }}>{T(STR.achievements, lang)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {ach.map((a, i) => (
            <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 10px', opacity: a.on ? 1 : .45 }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: a.on ? a.c : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={a.icon} size={28} color={a.on ? '#fff' : 'var(--text-muted)'} fill={a.on ? '#fff' : 'none'} sw={a.on ? 0 : 2.2} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13.5, textAlign: 'center' }}>{T(a.t, lang)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LessonComplete, Streak, Leaderboard, Profile, Settings });
