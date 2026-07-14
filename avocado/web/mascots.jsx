/* mascots.jsx — Avo + cast. Polished, Duolingo-grade flat characters with
   soft gradient shading. Avo is symmetric around x=110.
   Public API preserved: <Avocado>, <Lemon>, <Tomato>, <Olive>, <Gurke>,
   <Pepper>, <Mascot name=…>, <BigEyes>. Props: size, mood, accessory, glow, idle, style. */

const SKIN_HI = '#7FB53C', SKIN = '#5E9A29', SKIN_LO = '#4C7F22';
const FLESH_HI = '#F0F8D6', FLESH = '#D7ECA0', FLESH_LO = '#C6E184';
const PIT_HI = '#C68B4F', PIT = '#A26B33', PIT_LO = '#825526';
const PUPIL = '#3B3B3B';

/* shared <defs> for the avocado — flat-with-soft-shading look.
   Static ids: identical across instances, so duplicate-id resolution is harmless. */
function AvoDefs() {
  return (
    <defs>
      <linearGradient id="avoSkin" x1="0" y1="0" x2="0.25" y2="1">
        <stop offset="0" stopColor={SKIN_HI} />
        <stop offset="0.55" stopColor={SKIN} />
        <stop offset="1" stopColor={SKIN_LO} />
      </linearGradient>
      <radialGradient id="avoFlesh" cx="0.4" cy="0.32" r="0.85">
        <stop offset="0" stopColor={FLESH_HI} />
        <stop offset="0.62" stopColor={FLESH} />
        <stop offset="1" stopColor={FLESH_LO} />
      </radialGradient>
      <radialGradient id="avoPit" cx="0.38" cy="0.3" r="0.9">
        <stop offset="0" stopColor={PIT_HI} />
        <stop offset="0.7" stopColor={PIT} />
        <stop offset="1" stopColor={PIT_LO} />
      </radialGradient>
    </defs>
  );
}

/* ---------------- shared face pieces (centered on cx) ---------------- */
function BigEyes({ cx = 110, cy = 98, gap = 30, look = 0, lidded = false }) {
  const ex = gap / 2;
  const Eye = ({ x }) => (
    <g className="avo-lids">
      <ellipse cx={x} cy={cy} rx="15" ry="19" fill="#fff" />
      {lidded && <path d={`M${x - 15},${cy - 5} a15,13 0 0 1 30,0 l0,-9 a15,19 0 0 0 -30,0 z`} fill={PUPIL} opacity=".22" />}
      <circle cx={x + look} cy={cy + 4} r="8.4" fill={PUPIL} />
      <circle cx={x + look + 3} cy={cy + 0.6} r="2.8" fill="#fff" />
      <circle cx={x + look - 2.6} cy={cy + 7} r="1.5" fill="#fff" opacity=".7" />
    </g>
  );
  return <g><Eye x={cx - ex} /><Eye x={cx + ex} /></g>;
}

function ClosedHappyEyes({ cx = 110, cy = 100, gap = 30 }) {
  const ex = gap / 2;
  const E = ({ x }) => <path d={`M${x - 12},${cy + 4} Q${x},${cy - 9} ${x + 12},${cy + 4}`} fill="none" stroke={PUPIL} strokeWidth="5.4" strokeLinecap="round" />;
  return <g><E x={cx - ex} /><E x={cx + ex} /></g>;
}

/* ---------------- Avo the Avocado (main, centered at 110) ---------------- */
function AvoFace({ mood }) {
  const blush = (
    <g>
      <ellipse cx="73" cy="120" rx="9" ry="5.5" fill="#FF9E9E" opacity=".5" />
      <ellipse cx="147" cy="120" rx="9" ry="5.5" fill="#FF9E9E" opacity=".5" />
    </g>
  );
  if (mood === 'sleep') {
    return (
      <g>
        <path d="M83,98 Q95,107 107,98" fill="none" stroke={PUPIL} strokeWidth="4.8" strokeLinecap="round" />
        <path d="M113,98 Q125,107 137,98" fill="none" stroke={PUPIL} strokeWidth="4.8" strokeLinecap="round" />
        <path d="M101,126 Q110,122 119,126" fill="none" stroke={PUPIL} strokeWidth="3.8" strokeLinecap="round" />
        <text x="150" y="74" fontFamily="Baloo 2, sans-serif" fontSize="18" fontWeight="800" fill="#8aa46a">z</text>
        <text x="163" y="57" fontFamily="Baloo 2, sans-serif" fontSize="24" fontWeight="800" fill="#8aa46a">Z</text>
      </g>
    );
  }
  if (mood === 'celebrate') {
    return (
      <g>
        <ClosedHappyEyes cx={110} cy={98} gap={31} />
        <path d="M95,116 Q110,140 125,116 Q110,127 95,116 Z" fill="#7a3b3b" />
        <path d="M104,124 Q110,131 116,124 Z" fill="#FF8389" />
        {blush}
      </g>
    );
  }
  if (mood === 'sad') {
    return (
      <g>
        <path d="M80,82 Q91,77 101,84" fill="none" stroke="#46611f" strokeWidth="3.8" strokeLinecap="round" />
        <path d="M119,84 Q129,77 140,82" fill="none" stroke="#46611f" strokeWidth="3.8" strokeLinecap="round" />
        <BigEyes cx={110} cy={99} gap={31} look={-2} />
        <path d="M98,130 Q110,121 122,130" fill="none" stroke={PUPIL} strokeWidth="4.6" strokeLinecap="round" />
      </g>
    );
  }
  if (mood === 'fire') {
    return (
      <g>
        <path d="M79,81 L102,90" stroke="#46611f" strokeWidth="4.2" strokeLinecap="round" />
        <path d="M141,81 L118,90" stroke="#46611f" strokeWidth="4.2" strokeLinecap="round" />
        <BigEyes cx={110} cy={100} gap={31} />
        <path d="M97,126 Q110,136 123,126" fill="none" stroke={PUPIL} strokeWidth="4.8" strokeLinecap="round" />
      </g>
    );
  }
  // happy / wave
  const look = mood === 'wave' ? 3 : 0;
  return (
    <g>
      <BigEyes cx={110} cy={98} gap={31} look={look} />
      <path d="M96,121 Q110,135 124,121" fill="none" stroke={PUPIL} strokeWidth="5" strokeLinecap="round" />
      {blush}
    </g>
  );
}

/* collar + tie / bow / glasses — all sit cleanly between face and pit */
function AvoAccessory({ kind, layer }) {
  // layer 'chest' draws collar+tie behind the pit-belly; layer 'face' draws glasses over eyes
  if (layer === 'face') {
    if (kind === 'glasses') {
      return (
        <g fill="none" stroke="#2f2f2f" strokeWidth="3.6">
          <circle cx="94.5" cy="98" r="18.5" fill="#ffffff" fillOpacity=".12" />
          <circle cx="125.5" cy="98" r="18.5" fill="#ffffff" fillOpacity=".12" />
          <path d="M113,95 q-3,-3 -6,0" strokeWidth="3.2" />
          <path d="M76,93 l-10,-5" /><path d="M144,93 l10,-5" />
        </g>
      );
    }
    return null;
  }
  // chest layer — collar + tie, fully visible on the chest
  if (kind === 'tie' || kind === 'gavel') {
    return (
      <g transform="translate(0,7)">
        {/* crisp symmetric shirt collar */}
        <path d="M110,130 L98,135 L107,147 L110,138 Z" fill="#FFFFFF" />
        <path d="M110,130 L122,135 L113,147 L110,138 Z" fill="#ECECEC" />
        {/* tidy diamond knot (kleiner, sitzt unter dem Mund) */}
        <path d="M110,134 l-6,5.5 6,5.5 6,-5.5 z" fill="#B23128" />
        {/* slim tie blade draping over the pit */}
        <path d="M104,144 L110,141 L116,144 L113.8,166 L110,173 L106.2,166 Z" fill="#D8453B" />
        <path d="M107,145 L110,143 L113,145 L111.5,164 L110,169 L108.5,164 Z" fill="#E9594F" opacity=".6" />
      </g>
    );
  }
  if (kind === 'bowtie') {
    return (
      <g transform="translate(0,5)">
        <path d="M110,130 L91,122 L91,144 Z" fill="#D8453B" />
        <path d="M110,130 L129,122 L129,144 Z" fill="#C53A31" />
        <rect x="104" y="125" width="12" height="11" rx="4" fill="#A8281F" />
      </g>
    );
  }
  return null;
}

function Gavel({ x = 150, y = 150 }) {
  return (
    <g transform={`translate(${x},${y}) rotate(26)`}>
      <rect x="7" y="8" width="7" height="30" rx="3.5" fill="#7c5128" />
      <rect x="-6" y="-4" width="34" height="16" rx="7" fill="#AE7A40" />
      <rect x="-6" y="-4" width="8" height="16" rx="4" fill="#8B5E2F" />
      <rect x="20" y="-4" width="8" height="16" rx="4" fill="#8B5E2F" />
      <rect x="9" y="2" width="3" height="4" fill="#caa06a" opacity=".6" />
    </g>
  );
}

function Avocado({ size = 160, mood = 'happy', accessory = 'tie', glow = false, idle = true, style = {} }) {
  return (
    <svg viewBox="0 0 220 244" width={size} height={size * 244 / 220} style={{ overflow: 'visible', display: 'block', ...style }}>
      <AvoDefs />
      <ellipse cx="110" cy="226" rx="50" ry="9" fill="rgba(0,0,0,0.12)" />
      {glow && <ellipse cx="110" cy="124" rx="90" ry="104" fill="var(--glow,transparent)" opacity="0.5" style={{ filter: 'blur(24px)' }} />}

      <g className={idle && mood !== 'sleep' ? 'avo-idle' : undefined}>
        {/* body — symmetric pear (limbless: no arms, no feet) */}
        <path d="M110,26 C82,26 65,50 63,84 C61,112 50,134 50,164 C50,200 78,220 110,220 C142,220 170,200 170,164 C170,134 159,112 157,84 C155,50 138,26 110,26 Z" fill="url(#avoSkin)" />
        {/* subtle rim for crispness on light backgrounds */}
        <path d="M110,26 C82,26 65,50 63,84 C61,112 50,134 50,164 C50,200 78,220 110,220 C142,220 170,200 170,164 C170,134 159,112 157,84 C155,50 138,26 110,26 Z" fill="none" stroke={SKIN_LO} strokeWidth="2.5" opacity=".5" />
        {/* skin sheen */}
        <path d="M84,44 C73,58 70,80 69,104" fill="none" stroke={SKIN_HI} strokeWidth="7" strokeLinecap="round" opacity=".55" />

        {/* flesh */}
        <path d="M110,42 C86,42 72,64 70,94 C68,120 59,138 59,164 C59,196 83,212 110,212 C137,212 161,196 161,164 C161,138 152,120 150,94 C148,64 134,42 110,42 Z" fill="url(#avoFlesh)" />
        {/* inner flesh edge */}
        <path d="M110,52 C90,52 78,72 76,99 C74,123 66,140 66,163" fill="none" stroke={FLESH_HI} strokeWidth="6" strokeLinecap="round" opacity=".8" />

        {/* sprout on head */}
        <g transform="translate(110,26)">
          <path d="M0,2 C0,-6 -1,-11 -2,-15" fill="none" stroke="#3f6b1e" strokeWidth="4" strokeLinecap="round" />
          <path d="M-2,-13 C-15,-25 -7,-37 4,-34 C11,-31 9,-18 -2,-13 Z" fill="#6FA72F" />
          <path d="M-2,-13 C8,-27 21,-22 21,-12 C20,-3 6,-5 -2,-13 Z" fill="#58CC02" />
          <path d="M-2,-13 C5,-24 14,-22 17,-15" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".4" />
        </g>

        {/* pit belly */}
        <circle cx="110" cy="178" r="27" fill="url(#avoPit)" />
        <ellipse cx="100" cy="169" rx="10" ry="13" fill={PIT_HI} opacity=".6" />
        <ellipse cx="118" cy="187" rx="12" ry="9" fill={PIT_LO} opacity=".4" />

        {/* chest accessory (collar + tie) in front of chest, above pit */}
        <AvoAccessory kind={accessory} layer="chest" />

        {/* floating gavel beside the body (no arms) */}
        {accessory === 'gavel' && <Gavel x={172} y={150} />}

        <AvoFace mood={mood} />
        <AvoAccessory kind={accessory} layer="face" />

        {/* flame for streak */}
        {mood === 'fire' && (
          <g transform="translate(110,4)">
            <g style={{ animation: 'flameFlicker 1.1s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
              <path d="M0,32 C-17,19 -13,2 -2,-9 C-2,2 7,2 7,-13 C19,-2 19,17 0,32 Z" fill="#FF9600" />
              <path d="M0,27 C-9,19 -7,8 -1,2 C-1,9 4,8 4,-3 C13,5 12,19 0,27 Z" fill="#FFC800" />
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}

/* ===================== CAST ===================== */
/* All cast share the same eye/blush vocabulary as Avo for family consistency. */

function CastMouth({ y = 138, w = 13, mood = 'happy' }) {
  if (mood === 'flat') return <path d={`M${110 - w},${y} h${w * 2}`} stroke={PUPIL} strokeWidth="4.4" strokeLinecap="round" transform="translate(-10,0)" />;
  return null;
}

/* Justizia the Lemon — judge */
function Lemon({ size = 120, mood = 'happy', idle = false, style = {} }) {
  return (
    <svg viewBox="0 0 200 214" width={size} height={size * 214 / 200} style={{ overflow: 'visible', display: 'block', ...style }}>
      <defs>
        <radialGradient id="lemonG" cx="0.4" cy="0.32" r="0.85">
          <stop offset="0" stopColor="#FFEB8C" /><stop offset="0.65" stopColor="#FFD83D" /><stop offset="1" stopColor="#F4C022" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="203" rx="48" ry="9" fill="rgba(0,0,0,0.1)" />
      <g className={idle ? 'avo-idle' : undefined}>
        <ellipse cx="100" cy="118" rx="66" ry="74" fill="url(#lemonG)" />
        <path d="M100,46 q-3,-9 2,-15" fill="none" stroke="#9BB23A" strokeWidth="6" strokeLinecap="round" />
        <ellipse cx="76" cy="92" rx="20" ry="24" fill="#FFF1B0" opacity=".7" />
        {/* judge wig */}
        <g fill="#F2EFE8">
          <path d="M44,60 q56,-32 112,0 q8,28 -3,44 q-53,-26 -106,0 q-11,-16 -3,-44 z" />
          <circle cx="45" cy="100" r="13" /><circle cx="40" cy="124" r="12" /><circle cx="38" cy="147" r="10.5" />
          <circle cx="155" cy="100" r="13" /><circle cx="160" cy="124" r="12" /><circle cx="162" cy="147" r="10.5" />
        </g>
        <path d="M52,70 q48,-22 96,0" fill="none" stroke="#E2DECF" strokeWidth="3" opacity=".7" />
        <BigEyes cx={100} cy={114} gap={29} />
        <path d="M88,140 q12,12 24,0" fill="none" stroke={PUPIL} strokeWidth="4.6" strokeLinecap="round" />
        <ellipse cx="66" cy="133" rx="8" ry="5" fill="#FF9E9E" opacity=".45" />
        <ellipse cx="134" cy="133" rx="8" ry="5" fill="#FF9E9E" opacity=".45" />
      </g>
    </svg>
  );
}

/* Toni the Tomato — cheerful */
function Tomato({ size = 120, mood = 'happy', idle = false, style = {} }) {
  return (
    <svg viewBox="0 0 200 214" width={size} height={size * 214 / 200} style={{ overflow: 'visible', display: 'block', ...style }}>
      <defs>
        <radialGradient id="tomatoG" cx="0.38" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#FF8A78" /><stop offset="0.6" stopColor="#FB5D48" /><stop offset="1" stopColor="#E8442F" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="203" rx="48" ry="9" fill="rgba(0,0,0,0.1)" />
      <g className={idle ? 'avo-idle' : undefined}>
        <circle cx="100" cy="124" r="74" fill="url(#tomatoG)" />
        <ellipse cx="74" cy="100" rx="22" ry="17" fill="#FFA493" opacity=".6" />
        {/* leafy crown */}
        <g fill="#54A12E">
          <path d="M100,54 C96,36 86,30 80,28 C90,28 97,32 100,40 C103,32 110,28 120,28 C114,30 104,36 100,54 Z" />
          <path d="M100,56 C84,46 70,48 62,54 C72,42 88,42 100,50 C112,42 128,42 138,54 C130,48 116,46 100,56 Z" />
        </g>
        <ellipse cx="100" cy="50" rx="8" ry="7" fill="#3F8222" />
        <BigEyes cx={100} cy={120} gap={31} />
        <path d="M85,146 q15,13 30,0" fill="none" stroke={PUPIL} strokeWidth="4.6" strokeLinecap="round" />
        <ellipse cx="64" cy="138" rx="8" ry="5" fill="#fff" opacity=".35" />
        <ellipse cx="136" cy="138" rx="8" ry="5" fill="#fff" opacity=".35" />
      </g>
    </svg>
  );
}

/* Professor Olive — monocle + bowler */
function Olive({ size = 120, mood = 'happy', idle = false, style = {} }) {
  return (
    <svg viewBox="0 0 200 214" width={size} height={size * 214 / 200} style={{ overflow: 'visible', display: 'block', ...style }}>
      <defs>
        <radialGradient id="oliveG" cx="0.38" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#92A659" /><stop offset="0.62" stopColor="#76893F" /><stop offset="1" stopColor="#5F7133" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="203" rx="44" ry="9" fill="rgba(0,0,0,0.1)" />
      <g className={idle ? 'avo-idle' : undefined}>
        <ellipse cx="100" cy="126" rx="60" ry="68" fill="url(#oliveG)" />
        <ellipse cx="80" cy="104" rx="18" ry="21" fill="#A7BA6E" opacity=".7" />
        {/* pimento peek */}
        <ellipse cx="100" cy="64" rx="15" ry="10" fill="#D8604F" />
        {/* bowler hat */}
        <g fill="#463F36">
          <ellipse cx="100" cy="58" rx="48" ry="10" />
          <path d="M66,58 a34,28 0 0 1 68,0 z" />
        </g>
        <rect x="66" y="52" width="68" height="6" rx="3" fill="#6B5E4D" />
        <BigEyes cx={100} cy={120} gap={29} />
        {/* monocle */}
        <g>
          <circle cx="114" cy="120" r="18" fill="none" stroke="#D0AB54" strokeWidth="3.4" />
          <path d="M130,131 q6,11 2,22" fill="none" stroke="#D0AB54" strokeWidth="2.6" />
        </g>
        {/* mustache */}
        <path d="M82,143 q9,-7 18,0 q9,-7 18,0 q-9,10 -18,4 q-9,6 -18,-4 z" fill="#DCD7CB" />
        <path d="M91,155 q9,7 18,0" fill="none" stroke={PUPIL} strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/* Lila the Gurke — deadpan, tall */
function Gurke({ size = 120, mood = 'happy', idle = false, style = {} }) {
  return (
    <svg viewBox="0 0 200 234" width={size} height={size * 234 / 200} style={{ overflow: 'visible', display: 'block', ...style }}>
      <defs>
        <linearGradient id="gurkeG" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#54B564" /><stop offset="0.55" stopColor="#3E9B4F" /><stop offset="1" stopColor="#33833F" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="224" rx="42" ry="8" fill="rgba(0,0,0,0.1)" />
      <g className={idle ? 'avo-idle' : undefined}>
        <rect x="56" y="20" width="88" height="200" rx="44" fill="url(#gurkeG)" />
        <path d="M73,40 q-6,82 0,164" fill="none" stroke="#2F7D3E" strokeWidth="6" strokeLinecap="round" opacity=".5" />
        <path d="M100,36 q-7,84 0,168" fill="none" stroke="#2F7D3E" strokeWidth="5" strokeLinecap="round" opacity=".35" />
        <path d="M127,40 q6,82 0,164" fill="none" stroke="#2F7D3E" strokeWidth="6" strokeLinecap="round" opacity=".5" />
        <ellipse cx="100" cy="28" rx="27" ry="10" fill="#62C072" opacity=".7" />
        {/* side fringe */}
        <path d="M58,58 q15,-28 46,-23 q-31,6 -27,31 q-13,-2 -19,-8 z" fill="#2F7D3E" />
        <BigEyes cx={100} cy={94} gap={31} lidded={true} />
        <path d="M89,128 h22" stroke={PUPIL} strokeWidth="4.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/* Chili the Pepper — fiery sidekick (NEW) */
function Pepper({ size = 120, mood = 'happy', idle = false, style = {} }) {
  return (
    <svg viewBox="0 0 200 230" width={size} height={size * 230 / 200} style={{ overflow: 'visible', display: 'block', ...style }}>
      <defs>
        <linearGradient id="pepperG" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#FF5A4D" /><stop offset="0.55" stopColor="#E23023" /><stop offset="1" stopColor="#BE2018" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="220" rx="40" ry="8" fill="rgba(0,0,0,0.1)" />
      <g className={idle ? 'avo-idle' : undefined}>
        {/* curved chili body */}
        <path d="M84,52 C58,58 50,92 56,134 C62,178 86,206 112,206 C140,206 152,178 146,150 C140,124 132,120 124,96 C118,76 112,56 100,50 Z" fill="url(#pepperG)" />
        <path d="M78,78 C70,104 72,140 82,168" fill="none" stroke="#FF8276" strokeWidth="7" strokeLinecap="round" opacity=".5" />
        {/* green stem */}
        <path d="M96,52 q-2,-16 -12,-24" fill="none" stroke="#4E9B36" strokeWidth="8" strokeLinecap="round" />
        <path d="M84,30 q8,-6 20,-4 q-6,9 -20,4 z" fill="#5BB23E" />
        <BigEyes cx={97} cy={118} gap={28} />
        <path d="M85,144 q12,11 24,0" fill="none" stroke={PUPIL} strokeWidth="4.4" strokeLinecap="round" />
        <ellipse cx="74" cy="138" rx="7" ry="4.5" fill="#fff" opacity=".4" />
      </g>
    </svg>
  );
}

function Mascot({ name = 'avo', ...rest }) {
  if (name === 'lemon') return <Lemon {...rest} />;
  if (name === 'tomato') return <Tomato {...rest} />;
  if (name === 'olive') return <Olive {...rest} />;
  if (name === 'gurke') return <Gurke {...rest} />;
  if (name === 'pepper') return <Pepper {...rest} />;
  return <Avocado {...rest} />;
}

Object.assign(window, { Avocado, Lemon, Tomato, Olive, Gurke, Pepper, Mascot, BigEyes });
