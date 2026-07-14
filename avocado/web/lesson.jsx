/* lesson.jsx — lesson engine + exercise renderers */

function Prompt({ children }) {
  return <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--disp-w)', fontSize: 23, lineHeight: 1.22, color: 'var(--text)', margin: '4px 0 20px' }}>{children}</div>;
}

// shuffle stable per-exercise
function useShuffle(arr, dep) {
  return React.useMemo(() => {
    const a = arr.map((v, i) => ({ v, i }));
    for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; }
    return a;
  }, [dep]);
}

// ---- INFO ----
const UNIT_TEACHER = { u1: 'avo', u2: 'olive', u3: 'gurke', u4: 'lemon', u5: 'pepper', u6: 'lemon' };
function ExInfo({ ex, lang, acc, unit }) {
  const who = UNIT_TEACHER[unit && unit.id] || 'avo';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, padding: '10px 4px' }}>
      <span className="pill" style={{ background: 'var(--primary-tint)', color: 'var(--primary)', fontSize: 13 }}>{lang === 'de' ? 'GUT ZU WISSEN' : 'GOOD TO KNOW'}</span>
      <Speech style={{ maxWidth: 280, marginTop: 8, marginBottom: 18 }}>{T(ex.text, lang)}</Speech>
      <div className="float">
        {who === 'avo'
          ? <Avocado size={170} mood={ex.mood || 'happy'} accessory={acc} />
          : <Mascot name={who} size={160} idle={true} />}
      </div>
    </div>
  );
}

// ---- MULTIPLE CHOICE (optionally with a Brilliant-style case card) ----
function ExMC({ ex, lang, value, onChange, locked, answer }) {
  return (
    <div>
      {ex.scene && (
        <div className="slide-up" style={{ marginBottom: 16 }}>
          <span className="pill" style={{ background: 'var(--gold)', color: '#7a5b00', fontSize: 12, padding: '4px 12px' }}>{'⚖️'} {T(STR.casePill, lang)}</span>
          <div className="card" style={{ padding: '15px 16px', fontSize: 15.5, fontWeight: 700, lineHeight: 1.45, marginTop: 8, background: 'var(--surface-2)', borderStyle: 'dashed' }}>
            {T(ex.scene, lang)}
          </div>
        </div>
      )}
      <Prompt>{T(ex.q, lang)}</Prompt>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ex.options.map((o, k) => {
          let cls = 'opt';
          if (locked) { if (k === answer) cls += ' ok'; else if (k === value) cls += ' no'; else cls += ' dim'; }
          else if (value === k) cls += ' sel';
          return (
            <button key={k} className={cls} onClick={locked ? undefined : () => onChange(k)}>
              <span style={{ width: 26, height: 26, borderRadius: 8, border: '2px solid currentColor', opacity: .4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{k + 1}</span>
              <span style={{ flex: 1 }}>{T(o, lang)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- TRUE / FALSE ----
function ExTF({ ex, lang, value, onChange, locked, answer }) {
  const opts = [{ v: true, t: { de: 'Stimmt', en: 'True' }, c: 'var(--correct)' }, { v: false, t: { de: 'Stimmt nicht', en: 'False' }, c: 'var(--wrong)' }];
  return (
    <div>
      <Prompt>{lang === 'de' ? 'Stimmt das?' : 'Is this true?'}</Prompt>
      <div className="card" style={{ padding: '20px 18px', fontSize: 18, fontWeight: 700, lineHeight: 1.35, marginBottom: 22, background: 'var(--surface-2)', borderStyle: 'dashed' }}>
        {'\u201C' + T(ex.statement, lang) + '\u201D'}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {opts.map(o => {
          let cls = 'opt';
          if (locked) { if (o.v === answer) cls += ' ok'; else if (o.v === value) cls += ' no'; else cls += ' dim'; }
          else if (value === o.v) cls += ' sel';
          return <button key={String(o.v)} className={cls} style={{ flex: 1, justifyContent: 'center', fontSize: 18, fontWeight: 800 }} onClick={locked ? undefined : () => onChange(o.v)}>{T(o.t, lang)}</button>;
        })}
      </div>
    </div>
  );
}

// ---- GAP / fill blank ----
function ExGap({ ex, lang, value, onChange, locked, answer }) {
  const text = T(ex.parts, lang);
  const [before, after] = text.split('___');
  const chosen = value != null ? T(ex.options[value], lang) : null;
  return (
    <div>
      <Prompt>{lang === 'de' ? 'F\u00FClle die L\u00FCcke.' : 'Fill the blank.'}</Prompt>
      <div className="card" style={{ padding: '22px 18px', fontSize: 19, fontWeight: 700, lineHeight: 1.7, marginBottom: 24, background: 'var(--surface-2)' }}>
        {before}
        <span style={{ display: 'inline-flex', minWidth: 64, justifyContent: 'center', borderBottom: '3px solid var(--border)', padding: '0 10px', margin: '0 4px', fontWeight: 800, color: locked ? (value === answer ? 'var(--correct-ink)' : 'var(--wrong-ink)') : 'var(--blue)' }}>{chosen || '\u00A0\u00A0\u00A0\u00A0'}</span>
        {after}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
        {ex.options.map((o, k) => {
          const active = value === k;
          return <button key={k} className="tok" style={{ ...(active && !locked ? { borderColor: 'var(--blue)', background: 'var(--blue-tint)', color: 'var(--blue-ink)' } : {}), ...(locked && k === answer ? { borderColor: 'var(--correct)', background: 'var(--correct-tint)', color: 'var(--correct-ink)' } : {}), fontSize: 17, padding: '11px 18px' }} onClick={locked ? undefined : () => onChange(k)}>{T(o, lang)}</button>;
        })}
      </div>
    </div>
  );
}

// ---- MATCH ----
function ExMatch({ ex, lang, onComplete, onMiss, locked }) {
  const left = ex.pairs;
  const right = useShuffle(ex.pairs.map(p => p.b), ex);
  const [selL, setSelL] = React.useState(null);
  const [selR, setSelR] = React.useState(null);
  const [matched, setMatched] = React.useState({});
  const [bad, setBad] = React.useState(null);

  React.useEffect(() => { if (Object.keys(matched).length === left.length) onComplete(); }, [matched]);

  const tryPair = (li, ri) => {
    if (matched[li] != null || Object.values(matched).includes(ri)) return;
    if (left[li].b === right[ri].v) { setMatched(m => ({ ...m, [li]: ri })); setSelL(null); setSelR(null); }
    else { setBad({ li, ri }); onMiss && onMiss(); setTimeout(() => { setBad(null); setSelL(null); setSelR(null); }, 500); }
  };
  const pick = (side, i) => {
    if (side === 'L') { const nl = i; setSelL(nl); if (selR != null) tryPair(nl, selR); }
    else { const nr = i; setSelR(nr); if (selL != null) tryPair(selL, nr); }
  };
  const cell = (txt, on, done, isBad, onClick) => (
    <button onClick={done ? undefined : onClick} className={'opt' + (isBad ? ' shake' : '')} style={{
      justifyContent: 'center', textAlign: 'center', fontSize: 15, padding: '14px 10px', minHeight: 58,
      ...(done ? { borderColor: 'var(--correct)', background: 'var(--correct-tint)', color: 'var(--correct-ink)', opacity: .6 } : {}),
      ...(on ? { borderColor: 'var(--blue)', background: 'var(--blue-tint)', color: 'var(--blue-ink)' } : {}),
      ...(isBad ? { borderColor: 'var(--wrong)', background: 'var(--wrong-tint)' } : {}),
    }}>{txt}</button>
  );
  return (
    <div>
      <Prompt>{T(ex.q, lang)}</Prompt>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {left.map((p, i) => cell(T(p.a, lang), selL === i, matched[i] != null, bad && bad.li === i, () => pick('L', i)))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {right.map((p, i) => cell(T({ de: p.v.de, en: p.v.en }, lang), selR === i, Object.values(matched).includes(i), bad && bad.ri === i, () => pick('R', i)))}
        </div>
      </div>
    </div>
  );
}

// ---- ORDER (put steps in the right sequence) ----
function OrderWrap({ ex, lang, value, onChange, locked }) {
  const steps = ex.steps.map(s => T(s, lang));
  const shuf = useShuffle(steps, ex);
  const used = value || [];
  const correct = locked && JSON.stringify(used.map(i => shuf[i].i)) === JSON.stringify(steps.map((_, k) => k));
  const add = (i) => { if (!used.includes(i)) onChange([...used, i], shuf, steps); };
  const remove = (i) => onChange(used.filter(x => x !== i), shuf, steps);
  return (
    <div>
      <Prompt>{T(ex.q, lang)}</Prompt>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 120, marginBottom: 20 }}>
        {used.map((i, pos) => (
          <button key={i} className="opt" onClick={locked ? undefined : () => remove(i)}
            style={{ padding: '12px 14px', fontSize: 15.5,
              ...(locked ? (shuf[i].i === pos
                ? { borderColor: 'var(--correct)', background: 'var(--correct-tint)', color: 'var(--correct-ink)' }
                : { borderColor: 'var(--wrong)', background: 'var(--wrong-tint)', color: 'var(--wrong-ink)' }) : {}) }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--blue-tint)', color: 'var(--blue-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{pos + 1}</span>
            <span style={{ flex: 1 }}>{shuf[i].v}</span>
          </button>
        ))}
        {used.length < steps.length && (
          <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--r-card)', padding: '12px 14px', color: 'var(--text-muted)', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
            {lang === 'de' ? 'Tippe unten die Schritte in der richtigen Reihenfolge an' : 'Tap the steps below in the right order'}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {shuf.map((tk, i) => (
          <button key={i} className={'tok' + (used.includes(i) ? ' spent' : '')} style={{ justifyContent: 'flex-start', fontSize: 15 }}
            onClick={locked || used.includes(i) ? undefined : () => add(i)}>{tk.v}</button>
        ))}
      </div>
    </div>
  );
}

// correct-answer text for the banner
function correctText(ex, lang) {
  if (ex.type === 'mc') return T(ex.options[ex.answer], lang);
  if (ex.type === 'tf') return ex.answer ? (lang === 'de' ? 'Stimmt' : 'True') : (lang === 'de' ? 'Stimmt nicht' : 'False');
  if (ex.type === 'gap') return T(ex.options[ex.answer], lang);
  if (ex.type === 'build') return ex.answer[lang].join(' ');
  if (ex.type === 'order') return ex.steps.map(s => T(s, lang)).join(' → ');
  return '';
}

function Lesson({ unit, lesson, lang, acc, state, onExit, onComplete, onRefill, canRefill }) {
  const exs = lesson.exercises;
  const [idx, setIdx] = React.useState(0);
  const [value, setValue] = React.useState(null);
  const [status, setStatus] = React.useState('answering'); // answering | checked
  const [hearts, setHearts] = React.useState(state.hearts);
  const [correctCount, setCorrectCount] = React.useState(0);
  const [earnedXp, setEarnedXp] = React.useState(0); // session counter: XP actually collected this lesson
  const [matchDone, setMatchDone] = React.useState(false);
  const ex = exs[idx];
  const isInfo = ex.type === 'info';
  const isMatch = ex.type === 'match';

  const ready = isInfo || (isMatch ? matchDone
    : ex.type === 'order' ? (value && value.length === ex.steps.length)
    : value != null && (ex.type !== 'build' || (value && value.length)));

  const [wasCorrect, setWasCorrect] = React.useState(true);
  const [combo, setCombo] = React.useState(0);
  const [heartHit, setHeartHit] = React.useState(0);

  const check = () => {
    let ok = true;
    if (ex.type === 'mc' || ex.type === 'tf' || ex.type === 'gap') ok = value === ex.answer;
    else if (ex.type === 'build') ok = window.__buildOK; // set by renderer hook
    else if (ex.type === 'order') ok = window.__orderOK;
    setWasCorrect(ok);
    if (ok) {
      const nc = combo + 1;
      setCombo(nc);
      setCorrectCount(c => c + 1);
      // award per-question XP (base + streak bonus) — matches the floating +XP indicator
      setEarnedXp(x => x + Math.round(lesson.xp / exs.length) + (nc >= 3 ? 2 : 0));
    }
    else { setHearts(h => Math.max(0, h - 1)); setCombo(0); setHeartHit(k => k + 1); }
    setStatus('checked');
  };

  const advance = () => {
    if (idx >= exs.length - 1) { onComplete({ xp: earnedXp, correct: correctCount, total: exs.filter(e => e.type !== 'info').length, hearts }); return; }
    setIdx(idx + 1); setValue(null); setStatus('answering'); setMatchDone(false);
  };

  // expose build correctness
  const onBuildChange = (used, shuf, target) => {
    setValue(used);
    window.__buildOK = JSON.stringify(used.map(i => shuf[i].v)) === JSON.stringify(target);
  };
  // expose order correctness (shuf entries carry original index .i)
  const onOrderChange = (used, shuf) => {
    setValue(used);
    window.__orderOK = used.every((si, pos) => shuf[si].i === pos);
  };

  const progress = ((idx + (status === 'checked' ? 1 : 0)) / exs.length) * 100;
  const banner = status === 'checked';
  const outOfHearts = hearts === 0;
  const REFILL_COST = 350;

  return (
    <div className="scr">
      <div className="safe-top" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 18px 12px' }}>
        <button onClick={() => onExit(hearts)} style={{ padding: 4 }}><Icon name="x" size={26} color="var(--text-muted)" /></button>
        <div style={{ flex: 1, position: 'relative' }}>
          <Progress value={progress} shine />
        </div>
        <div key={heartHit} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--wrong)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, animation: heartHit ? 'heartLose .5s ease' : 'none' }}>
          <Icon name="heart" size={24} color="var(--wrong)" />{hearts}
        </div>
      </div>

      <div className="scr-scroll" style={{ padding: '6px 22px 20px', display: 'flex', flexDirection: 'column' }}>
        <div key={idx} className="slide-up" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {ex.type === 'info' && <ExInfo ex={ex} lang={lang} acc={acc} unit={unit} />}
          {ex.type === 'mc' && <ExMC ex={ex} lang={lang} value={value} onChange={setValue} locked={banner} answer={ex.answer} />}
          {ex.type === 'tf' && <ExTF ex={ex} lang={lang} value={value} onChange={setValue} locked={banner} answer={ex.answer} />}
          {ex.type === 'gap' && <ExGap ex={ex} lang={lang} value={value} onChange={setValue} locked={banner} answer={ex.answer} />}
          {ex.type === 'build' && <BuildWrap ex={ex} lang={lang} value={value} onChange={onBuildChange} locked={banner} />}
          {ex.type === 'order' && <OrderWrap ex={ex} lang={lang} value={value} onChange={onOrderChange} locked={banner} />}
          {ex.type === 'match' && <ExMatch ex={ex} lang={lang} locked={banner} onComplete={() => setMatchDone(true)} onMiss={() => setHearts(h => Math.max(0, h - 1))} />}
        </div>
      </div>

      {/* feedback banner / action bar */}
      <div style={{
        flexShrink: 0, padding: '16px 22px',
        background: banner ? (wasCorrect ? 'var(--correct-tint)' : 'var(--wrong-tint)') : 'var(--surface)',
        borderTop: banner ? 'none' : '2px solid var(--border)',
        borderTopLeftRadius: banner ? 24 : 0, borderTopRightRadius: banner ? 24 : 0,
        transition: 'background .2s',
      }}>
        {banner && (
          <div className="rise" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, position: 'relative' }}>
            <div className="tada" style={{ width: 46, height: 46, borderRadius: '50%', background: wasCorrect ? 'var(--correct)' : 'var(--wrong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={wasCorrect ? 'check' : 'x'} size={28} color="#fff" sw={3.6} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: wasCorrect ? 'var(--correct-ink)' : 'var(--wrong-ink)' }}>
                  {T(wasCorrect ? (combo >= 3 ? { de: 'Unaufhaltbar!', en: 'Unstoppable!' } : STR.correct) : STR.wrong, lang)}
                </span>
                {wasCorrect && combo >= 2 && (
                  <span className="tada pill" style={{ background: 'var(--gold)', color: '#7a5b00', fontSize: 12, padding: '3px 10px' }}>
                    {'\u26A1'} {combo} {lang === 'de' ? 'IN SERIE' : 'IN A ROW'}
                  </span>
                )}
              </div>
              {!wasCorrect && correctText(ex, lang) && (
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--wrong-ink)', marginTop: 2 }}>{T(STR.answerWas, lang)} <b>{correctText(ex, lang)}</b></div>
              )}
              {!wasCorrect && ex.explain && <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--wrong-ink)', opacity: .9, marginTop: 3 }}>{T(ex.explain, lang)}</div>}
              {wasCorrect && ex.hint && <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--correct-ink)', opacity: .85, marginTop: 2 }}>{T(ex.hint, lang)}</div>}
            </div>
            <div className="hop" style={{ flexShrink: 0, marginTop: -26, marginBottom: -8 }}>
              <Avocado size={74} mood={wasCorrect ? 'celebrate' : 'sad'} accessory={acc} idle={false} />
            </div>
            {wasCorrect && (
              <span style={{ position: 'absolute', right: 84, top: -14, whiteSpace: 'nowrap', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--gold)', animation: 'xpFloat 1.6s ease-out forwards', pointerEvents: 'none' }}>+{Math.round(lesson.xp / exs.length) + (combo >= 3 ? 2 : 0)} XP</span>
            )}
          </div>
        )}
        {!banner && isInfo && <Btn onClick={advance}>{T(STR.continue, lang)}</Btn>}
        {!banner && !isInfo && (
          <Btn onClick={check} disabled={!ready} variant={ready ? 'correct' : 'primary'}>{T(STR.check, lang)}</Btn>
        )}
        {banner && <Btn onClick={advance} variant={wasCorrect ? 'correct' : 'danger'}>{T(STR.cont2, lang)}</Btn>}
      </div>
      <div className="safe-bot" />

      {/* out-of-hearts overlay */}
      {outOfHearts && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 26px' }}>
          <div className="card pop" style={{ width: '100%', maxWidth: 330, padding: '26px 22px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, boxShadow: '0 18px 40px rgba(0,0,0,0.3)' }}>
            <Avocado size={120} mood="sad" accessory={acc} idle={false} />
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--disp-w)', fontSize: 23, color: 'var(--wrong)', marginTop: 6 }}>{T(STR.noHeartsTitle, lang)}</div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 12 }}>{T(STR.noHeartsBody, lang)}</div>
            <Btn variant="blue" disabled={!canRefill} onClick={() => { if (onRefill && onRefill()) setHearts(5); }} style={{ fontSize: 14.5, whiteSpace: 'nowrap' }}>
              <Icon name="gem" size={19} color="#fff" /> {T(STR.refillHearts, lang)} · {REFILL_COST}
            </Btn>
            {!canRefill && <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}>{lang === 'de' ? 'Nicht genug Gems (350 nötig)' : 'Not enough gems (350 needed)'}</div>}
            <button onClick={() => onExit(hearts)} style={{ marginTop: 10, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, letterSpacing: .6, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{T(STR.quitLesson, lang)}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// wrapper so build can report correctness via onChange signature
function BuildWrap({ ex, lang, value, onChange, locked }) {
  const target = ex.answer[lang];
  const bankWords = ex.bank[lang];
  const shuf = useShuffle(bankWords, ex);
  const used = value || [];
  const correct = locked && JSON.stringify(used.map(i => shuf[i].v)) === JSON.stringify(target);
  const add = (i) => { if (!used.includes(i)) onChange([...used, i], shuf, target); };
  const remove = (i) => onChange(used.filter(x => x !== i), shuf, target);
  return (
    <div>
      <Prompt>{T(ex.q, lang)}</Prompt>
      <div style={{ minHeight: 100, borderTop: '2px solid var(--border)', borderBottom: '2px solid var(--border)', padding: '14px 0', display: 'flex', flexWrap: 'wrap', gap: 8, alignContent: 'flex-start', marginBottom: 22 }}>
        {used.map(i => <button key={i} className="tok" style={locked ? { borderColor: correct ? 'var(--correct)' : 'var(--wrong)', background: correct ? 'var(--correct-tint)' : 'var(--wrong-tint)' } : {}} onClick={locked ? undefined : () => remove(i)}>{shuf[i].v}</button>)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'center' }}>
        {shuf.map((tk, i) => <button key={i} className={'tok' + (used.includes(i) ? ' spent' : '')} onClick={locked || used.includes(i) ? undefined : () => add(i)}>{tk.v}</button>)}
      </div>
    </div>
  );
}

Object.assign(window, { Lesson });
