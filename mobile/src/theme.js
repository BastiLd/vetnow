/* VetNow — Design-Tokens, übernommen aus base.css/redesign.css des Web-Prototyps */
export const C = {
  teal900: '#0a4d47',
  teal700: '#0c7d72',
  teal600: '#0f9b8e',
  teal500: '#19b3a4',
  teal100: '#d7efec',
  teal50:  '#ecf7f5',

  ink:   '#11201e',
  ink2:  '#3f534f',
  ink3:  '#6c7d79',
  line:  '#e3eae8',
  line2: '#eef3f2',
  surface:  '#ffffff',
  surface2: '#f4f7f6',
  surface3: '#eef2f1',

  green: '#16a34a',   greenBg: '#e7f6ec',  greenInk: '#137a39',
  yellow: '#e3a008',  yellowBg: '#fdf2da', yellowInk: '#8a5d05',
  red: '#dc2626',     redBg: '#fcebeb',    redInk: '#b3201c',
  grey: '#94a39f',    greyBg: '#eef1f0',   greyInk: '#5e6e6a',
  blue: '#2e6f9e',    blueBg: '#e7f0f8',   blueInk: '#235a82',
};

export const STATUS_COLOR = {
  green:  { dot: C.green,  bg: C.greenBg,  ink: C.greenInk },
  yellow: { dot: C.yellow, bg: C.yellowBg, ink: C.yellowInk },
  red:    { dot: C.red,    bg: C.redBg,    ink: C.redInk },
  grey:   { dot: C.grey,   bg: C.greyBg,   ink: C.greyInk },
  blue:   { dot: C.blue,   bg: C.blueBg,   ink: C.blueInk },
};

export const S = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s7: 32, s8: 40 };
export const R = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
