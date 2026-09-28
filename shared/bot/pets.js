/* Bot 3.0 — Tiername, Tierart und Geschlecht aus dem Verlauf.

   Audit (Bot 2.2): 5 von 12 richtig. „Durchfall", „Hat", „Frisst", „Nicht" wurden zu Namen, weil
   deutsche Nomen und Satzanfänge großgeschrieben sind; „heißt Emma", „namens Garfield", ALL CAPS
   und Rassen („Mein Labrador Max") fehlten; bei zwei Tieren wurde das falsche genommen.
   Jetzt:
   - „mein/unser" egal in welcher Schreibung, dazu „heißt X", „namens X", Rasse + Name.
   - Ein Name darf kein bekanntes Wort sein (Stoppliste + alle Lexikon-Begriffe).
   - Bei gemischter Schreibung muss der Name großgeschrieben sein; ganz klein oder ganz GROSS
     geschriebene Texte gehen auch (dann nur direkt nach Tierart/„heißt").
   - Mehrere Tiere: das zuletzt ERWÄHNTE gilt („Balu hustet" nach „Balu und Mimi" → Balu).
   - Geschlecht (für er/sie) aus „Hündin", „Kater", „Stute" … */
import { fold } from './normalize.js';
import { SPECIES, BREEDS, BREED_GENDER, NAME_STOP } from './lexicon.de.js';
import { getIndex } from './engine.js';

const STOP = new Set(NAME_STOP);
const INTRO = { heisst: 1, heiss: 1, hiess: 1, namens: 1, genannt: 1, heissen: 1, named: 1, called: 1, taufen: 1, getauft: 1 };
// Wörter, die zwischen Tierart und Name stehen dürfen („Mein Hund, der Balu")
const FILL = { der: 1, die: 1, das: 1 };

function kindOf(w) {
  const f = fold(w);
  if (SPECIES[f]) return { species: SPECIES[f][0], gender: SPECIES[f][1] };
  if (BREEDS[f]) return { species: BREEDS[f], gender: BREED_GENDER[f] || null, breed: true };
  return null;
}

function nameCase(w, mode) {
  if (mode === 'mixed') return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function isName(w, mode) {
  if (!w || w.length < 2 || w.length > 15) return false;
  if (!/^[A-Za-zÄÖÜäöüßÀ-ÿ]+$/.test(w)) return false;
  const f = fold(w);
  if (STOP.has(f) || SPECIES[f] || BREEDS[f]) return false;
  if (getIndex().known(f)) return false;
  if (mode === 'mixed') {
    const c = w.charAt(0);
    if (c === c.toLowerCase()) return false;
  }
  return true;
}

/* Wörter mit Position; Satzgrenzen merken (Name/Art nur im selben Satz verbinden). */
function words(text) {
  const out = [];
  const re = /[A-Za-zÄÖÜäöüßÀ-ÿ]+|[.!?;]/g;
  let m; let sent = 0;
  while ((m = re.exec(text)) !== null) {
    if (/^[.!?;]$/.test(m[0])) { sent++; continue; }
    out.push({ w: m[0], s: sent });
  }
  return out;
}

/* → { pets:[{name, species, gender, i}], species:[{species, gender, i}], names:[...] } */
export function extractPets(text) {
  const t = String(text || '');
  const ws = words(t.length > 2000 ? t.slice(0, 2000) : t);
  const letters = t.replace(/[^A-Za-zÄÖÜäöüß]/g, '');
  const mode = letters && letters === letters.toLowerCase() ? 'lower' : letters && letters === letters.toUpperCase() ? 'upper' : 'mixed';
  const pets = [];
  const species = [];
  const used = {};
  for (let i = 0; i < ws.length; i++) {
    const k = kindOf(ws[i].w);
    if (k) {
      // Zweiwort-Rassen/Arten überspringen („Golden Retriever", „Maine Coon", „Hündin Luna")
      let j = i + 1;
      let gender = k.gender;
      while (j < ws.length && ws[j].s === ws[i].s && kindOf(ws[j].w) && j - i < 3) {
        const k2 = kindOf(ws[j].w);
        if (!gender && k2.gender) gender = k2.gender;
        j++;
      }
      if (j < ws.length && FILL[fold(ws[j].w)] && ws[j].s === ws[i].s) j++;
      const spEntry = { species: k.species, gender, i, named: false };
      species.push(spEntry);
      const cand = ws[j];
      if (cand && cand.s === ws[i].s && !used[j] && isName(cand.w, mode)) {
        pets.push({ name: nameCase(cand.w, mode), species: k.species, gender, i: j });
        used[j] = 1;
        spEntry.named = true;
      }
      i = j - 1 >= i ? j - 1 : i;
      continue;
    }
    const f = fold(ws[i].w);
    if (INTRO[f] === 1 || (f === 'name' && ws[i + 1] && fold(ws[i + 1].w) === 'ist')) {
      const j = f === 'name' ? i + 2 : i + 1;
      const cand = ws[j];
      if (cand && !used[j] && isName(cand.w, mode === 'mixed' ? 'mixed' : mode)) {
        // Tierart = zuletzt genannte Art im selben Satz
        let sp = null;
        for (let x = species.length - 1; x >= 0; x--) if (ws[species[x].i] && ws[species[x].i].s === ws[i].s) { sp = species[x]; break; }
        const prev = pets.length && pets[pets.length - 1].i === i - 1 ? pets[pets.length - 1] : null;
        if (!prev) pets.push({ name: nameCase(cand.w, mode), species: sp ? sp.species : null, gender: sp ? sp.gender : null, i: j });
        used[j] = 1;
      }
    }
  }
  // Name ohne Tierart — nur bei normaler Groß-/Kleinschreibung und nur in zwei engen Satzformen:
  //   „Balu frisst wieder normal" (Name + Zustandsverb, danach KEIN Pronomen — „Heute frisst er" ist kein Name)
  //   „Kann Balu wieder …" / „Hat Luna schon …" (Frageverb + Name + typisches Folgewort)
  if (mode === 'mixed') {
    for (let i = 0; i < ws.length; i++) {
      const first = i === 0 || ws[i - 1].s !== ws[i].s;
      if (!first) continue;
      const a = ws[i]; const b = ws[i + 1]; const c = ws[i + 2];
      if (b && b.s === a.s && NAME_VERBS[fold(b.w)] === 1 && !used[i] && isName(a.w, mode) && !(c && c.s === a.s && PRON[fold(c.w)] === 1)) {
        pets.push({ name: a.w, species: null, gender: null, i });
        used[i] = 1;
      } else if (Q_VERBS[fold(a.w)] === 1 && b && c && b.s === a.s && c.s === a.s && Q_FOLLOW[fold(c.w)] === 1 && !used[i + 1] && isName(b.w, mode)) {
        pets.push({ name: b.w, species: null, gender: null, i: i + 1 });
        used[i + 1] = 1;
      }
    }
    pets.sort((x, y) => x.i - y.i);
  }
  return { pets, species, words: ws };
}

const NAME_VERBS = {
  frisst: 1, hustet: 1, humpelt: 1, hinkt: 1, lahmt: 1, erbricht: 1, trinkt: 1, kotzt: 1, speibt: 1, niest: 1, kratzt: 1,
  schlaeft: 1, spielt: 1, laeuft: 1, zittert: 1, blutet: 1, atmet: 1, hat: 1, ist: 1, geht: 1, liegt: 1, wuergt: 1, jault: 1, winselt: 1,
};
const PRON = { er: 1, sie: 1, es: 1, ihm: 1, ihr: 1, ihn: 1, man: 1, wir: 1, ich: 1, du: 1, das: 1, der: 1, die: 1, jetzt: 0 };
const Q_VERBS = { kann: 1, darf: 1, soll: 1, hat: 1, ist: 1, frisst: 1, geht: 1, trinkt: 1, muss: 1, wird: 1, braucht: 1 };
const Q_FOLLOW = { wieder: 1, noch: 1, schon: 1, gegen: 1, heute: 1, morgen: 1, jetzt: 1, nach: 1, mit: 1, auch: 1, normal: 1, bald: 1 };

/* Verlauf durchgehen (älteste zuerst): bekannte Tiere sammeln, das zuletzt erwähnte ist aktuell. */
export function petContext(texts) {
  const known = new Map();
  let current = null;
  let species = null;
  let gender = null;
  for (const text of texts) {
    if (!text) continue;
    const ex = extractPets(text);
    const events = [];
    for (const p of ex.pets) events.push({ i: p.i, pet: p });
    for (const sp of ex.species) events.push({ i: sp.i, sp });
    // Bereits bekannte Namen ohne Tierart („Balu hustet")
    if (known.size) {
      ex.words.forEach((w, i) => {
        const k = known.get(fold(w.w));
        if (k && !ex.pets.some((p) => p.i === i)) events.push({ i, known: k });
      });
    }
    events.sort((a, b) => a.i - b.i);
    for (const e of events) {
      if (e.pet) {
        const key = fold(e.pet.name);
        const old = known.get(key);
        const merged = { name: e.pet.name, species: e.pet.species || (old && old.species) || null, gender: e.pet.gender || (old && old.gender) || null };
        known.set(key, merged);
        current = merged;
        species = merged.species || species;
        gender = merged.gender;
      } else if (e.known) {
        current = e.known;
        species = e.known.species || species;
        gender = e.known.gender;
      } else if (e.sp) {
        // Art ohne Namen: gehört sie zu einem bekannten Tier dieser Art? Sonst unbenanntes Tier.
        if (e.sp.named || (current && current.species === e.sp.species)) continue;
        const same = [];
        for (const p of known.values()) if (p.species === e.sp.species) same.push(p);
        if (same.length === 1) { current = same[0]; species = same[0].species; gender = same[0].gender; }
        else if (!e.sp.named) { current = null; species = e.sp.species; gender = e.sp.gender; }
      }
    }
  }
  return {
    pet: current ? { name: current.name, species: current.species, gender: current.gender } : null,
    petName: current ? current.name : null,
    species: current && current.species ? current.species : species,
    gender: current ? current.gender : gender,
    pets: Array.from(known.values()),
  };
}
