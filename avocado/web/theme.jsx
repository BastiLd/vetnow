/* theme.jsx — design tokens, 3 directions, light/dark, fonts, roundness */

// ---- tiny color utils ----
function hx(c){ c=c.replace('#',''); if(c.length===3)c=c.split('').map(x=>x+x).join(''); return [parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)]; }
function toHex(r,g,b){ return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''); }
function darken(c,f){ const [r,g,b]=hx(c); return toHex(r*(1-f),g*(1-f),b*(1-f)); }
function lighten(c,f){ const [r,g,b]=hx(c); return toHex(r+(255-r)*f,g+(255-g)*f,b+(255-b)*f); }
function lum(c){ const [r,g,b]=hx(c).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);}); return .2126*r+.7152*g+.0722*b; }
function inkOn(c){ return lum(c)>0.42 ? '#3a2f12' : '#ffffff'; }
function rgba(c,a){ const [r,g,b]=hx(c); return `rgba(${r},${g},${b},${a})`; }
window.AvoColor = { darken, lighten, lum, inkOn, rgba };

// ---- neutral palettes per direction + mode ----
const NEUTRALS = {
  klassik: {
    light:{ bg:'#FFFFFF', surf:'#FFFFFF', surf2:'#F4F6F2', text:'#3C4043', muted:'#AFAFAF', border:'#E5E5E5', locked:'#E5E5E5', lockedInk:'#AFAFAF', lockedSh:'#CFCFCF', glow:'transparent', pattern:'dots' },
    dark:{ bg:'#131F24', surf:'#1B2A30', surf2:'#202F36', text:'#F1F7FB', muted:'#7E97A3', border:'#37464F', locked:'#202F36', lockedInk:'#52656F', lockedSh:'#171F24', glow:'transparent', pattern:'dots' },
  },
  mitternacht: {
    light:{ bg:'#EAF0F1', surf:'#FFFFFF', surf2:'#F0F4F5', text:'#19232A', muted:'#7E8C95', border:'#DCE4E6', locked:'#E2E8EA', lockedInk:'#A3AFB5', lockedSh:'#CBD4D6', glow:'transparent', pattern:'grid' },
    dark:{ bg:'#0B0F14', surf:'#151C24', surf2:'#1B232C', text:'#E9F1F0', muted:'#7C8B97', border:'#28323D', locked:'#1B232C', lockedInk:'#4A5763', lockedSh:'#0E141A', glow:'on', pattern:'grid' },
  },
  kanzlei: {
    light:{ bg:'#F5EFE2', surf:'#FFFDF7', surf2:'#EEE6D4', text:'#2B2519', muted:'#9C8E73', border:'#E2D7BF', locked:'#E7DDC8', lockedInk:'#B6A988', lockedSh:'#D2C4A6', glow:'transparent', pattern:'paper' },
    dark:{ bg:'#181410', surf:'#241E16', surf2:'#2C251B', text:'#F2EAD9', muted:'#A89878', border:'#3A3225', locked:'#2C251B', lockedInk:'#6E6045', lockedSh:'#100C08', glow:'transparent', pattern:'paper' },
  },
};

// default accent per direction
const ACCENT_DEFAULT = { klassik:'#58CC02', mitternacht:'#46D17A', kanzlei:'#2F7D4F' };

const FONTS = {
  rounded:{ display:'"Baloo 2", system-ui', body:'"Nunito", system-ui', dispW:800 },
  clean:  { display:'"Lexend", system-ui', body:'"Lexend", system-ui', dispW:700 },
  serif:  { display:'"DM Serif Display", Georgia, serif', body:'"Lora", Georgia, serif', dispW:400 },
};

const RADII = {
  sharp:{ card:9,  btn:11, tok:9 },
  soft: { card:16, btn:16, tok:13 },
  round:{ card:24, btn:22, tok:16 },
};

function buildTheme(t){
  const dir = NEUTRALS[t.direction] ? t.direction : 'klassik';
  const mode = t.dark ? 'dark' : 'light';
  const n = NEUTRALS[dir][mode];
  const isDark = t.dark;

  const primary = t.accent || ACCENT_DEFAULT[dir];
  const pInk = inkOn(primary);
  const pShadow = darken(primary, isDark ? 0.34 : 0.26);

  const correct = '#58CC02', wrong = '#FF4B4B', blue = '#1CB0F6', gold='#FFC800', streak='#FF9600';
  const r = RADII[t.radius] || RADII.soft;
  const f = FONTS[t.font] || FONTS.rounded;

  const v = {
    '--bg': n.bg, '--surface': n.surf, '--surface-2': n.surf2,
    '--text': n.text, '--text-muted': n.muted, '--border': n.border,
    '--locked': n.locked, '--locked-ink': n.lockedInk, '--locked-shadow': n.lockedSh,

    '--primary': primary, '--primary-ink': pInk, '--primary-shadow': pShadow,
    '--primary-tint': isDark ? rgba(primary,0.16) : lighten(primary,0.82),
    '--gold': gold, '--streak': streak,

    '--correct': correct, '--correct-shadow': darken(correct,0.2),
    '--correct-tint': isDark ? rgba(correct,0.15) : '#D7FFB8',
    '--correct-ink': isDark ? '#B7F08C' : '#58A700',
    '--wrong': wrong, '--wrong-shadow': darken(wrong,0.16),
    '--wrong-tint': isDark ? rgba(wrong,0.15) : '#FFDFE0',
    '--wrong-ink': isDark ? '#FF9B9B' : '#EA2B2B',
    '--blue': blue, '--blue-shadow': darken(blue,0.16),
    '--blue-tint': isDark ? rgba(blue,0.15) : '#DDF4FF',
    '--blue-ink': isDark ? '#8FD9FF' : '#1899D6',

    // button defaults map to primary
    '--btn-bg': primary, '--btn-ink': pInk, '--btn-shadow': pShadow, '--btn-depth':'4px',

    '--r-card': r.card+'px', '--r-btn': r.btn+'px', '--r-tok': r.tok+'px',
    '--font-display': f.display, '--font-body': f.body, '--disp-w': f.dispW,
    '--glow': n.glow === 'on' ? rgba(primary,0.5) : 'transparent',
  };
  return { vars:v, meta:{ dir, isDark, primary, pInk, pShadow, pattern:n.pattern, glow:n.glow==='on' } };
}

function applyVars(el, vars){ for(const k in vars) el.style.setProperty(k, vars[k]); }

window.AvoTheme = { buildTheme, applyVars, ACCENT_DEFAULT, FONTS, RADII, NEUTRALS };
