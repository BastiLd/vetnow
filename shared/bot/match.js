/* Bot 3.0 — Muster-Sprache und Treffer-Index.

   Statt langer Regexe (Audit: „nase.*(warm|trocken).*(krank|fieber)" brauchte 18 s bei 18k Zeichen)
   beschreiben wir Muster als Wortfolgen über Tokens. Das ist linear, lesbar und kann Tippfehler.

   Muster-Syntax (Leerzeichen trennen Elemente):
     wort          genau dieses Wort; ab 5 Buchstaben auch Stamm („termine") und Tippfehler („termn")
     wort*         Präfix („schokolad*" trifft „schokolade", „schokoladenkeks")
     =wort         nur exakt (kein Stamm, kein Tippfehler) — z. B. „=unfall", damit
                   „unfallversicherung" oder „umfall" nie einen Unfall auslösen
     a|b|c         Alternativen für ein Element
     ~N            zwischen vorigem und nächstem Element dürfen bis zu N Füllwörter stehen
                   („atmet ~2 schwer" trifft „atmet jetzt ganz schwer")
   Ein Muster gilt innerhalb EINES Teilsatzes (Verneinungs-Bereich); mit scope 'sentence' innerhalb
   eines Satzes.

   Qualität eines Treffers: exakt 1, Präfix 0,95, Stamm 0,9, Tippfehler 0,75. */
import { stem, normalize, tokenize, questionInfo } from './normalize.js';
import { isTypoOf, damerau } from './fuzzy.js';

export function compilePattern(src) {
  const parts = String(src).trim().split(/\s+/);
  const els = [];
  let gap = 0;
  for (const p of parts) {
    if (p[0] === '~') { gap = parseInt(p.slice(1), 10) || 0; continue; }
    els.push({ alts: p.split('|').filter(Boolean), gap });
    gap = 0;
  }
  return els;
}

function addTo(map, key, val) {
  const arr = map.get(key);
  if (arr) { if (arr.indexOf(val) < 0) arr.push(val); } else map.set(key, [val]);
}

/* Index über alle Begriffe aller Muster. `block` = echte Wörter, die nie per Stamm/Tippfehler auf
   einen Begriff gemappt werden dürfen („taube" ≠ „traube", „notfalls" ≠ „notfall"). */
export function createIndex(keys, block) {
  const exact = new Map();
  const stems = new Map();
  const prefix = new Map();
  const fuzzyByChar = new Map();
  let minP = 99;
  let maxP = 0;
  const blockSet = new Set(block || []);
  for (const k of new Set(keys)) {
    if (!k) continue;
    if (k[k.length - 1] === '*') {
      const p = k.slice(0, -1);
      addTo(prefix, p, k);
      if (p.length < minP) minP = p.length;
      if (p.length > maxP) maxP = p.length;
      if (p.length >= 6) addTo(fuzzyByChar, p[0], { w: p, k, pre: true });
    } else if (k[0] === '=') {
      addTo(exact, k.slice(1), k);
    } else {
      addTo(exact, k, k);
      if (k.length >= 5) {
        addTo(stems, stem(k), k);
        addTo(fuzzyByChar, k[0], { w: k, k, pre: false });
      }
    }
  }
  const cache = new Map();

  function compute(tok) {
    const out = new Map();
    const put = (k, q) => { const o = out.get(k); if (!(o >= q)) out.set(k, q); };
    const ex = exact.get(tok);
    if (ex) for (const k of ex) put(k, 1);
    const top = Math.min(maxP, tok.length);
    for (let L = minP; L <= top; L++) {
      const pk = prefix.get(tok.slice(0, L));
      if (pk) for (const k of pk) put(k, 0.95);
    }
    if (tok.length >= 5 && !blockSet.has(tok)) {
      const st = stems.get(stem(tok));
      if (st) for (const k of st) if (k[0] !== '=') put(k, 0.9);
      // Tippfehler nur für Wörter, die sonst nichts treffen — bekannte Wörter bleiben, was sie sind
      if (out.size === 0 && !/[0-9]/.test(tok)) {
        const cands = (fuzzyByChar.get(tok[0]) || []).concat(tok[1] && tok[1] !== tok[0] ? (fuzzyByChar.get(tok[1]) || []) : []);
        for (const c of cands) {
          if (c.pre) {
            // Präfix-Tippfehler: Tokenanfang in drei Längen gegen das Präfix prüfen („schockolade")
            const L = c.w.length;
            if (tok.length < L - 1) continue;
            if (tok[0] !== c.w[0] && !(tok[0] === c.w[1] && tok[1] === c.w[0])) continue;
            for (let d = -1; d <= 1; d++) {
              if (damerau(tok.slice(0, L + d), c.w, 1) <= 1) { put(c.k, 0.75); break; }
            }
          } else if (isTypoOf(tok, c.w)) put(c.k, 0.75);
        }
      }
    }
    return out;
  }

  return {
    hits(tok) {
      let h = cache.get(tok);
      if (h) return h;
      h = compute(tok);
      // Cache begrenzen — Ergebnis ist deterministisch, der Cache spart nur Zeit
      if (cache.size > 20000) cache.clear();
      cache.set(tok, h);
      return h;
    },
    /* Ist das Wort ein bekannter Lexikon-Begriff (exakt/Präfix/Stamm, ohne Tippfehler)? Für die
       Namens-Erkennung: „Durchfall" ist kein Name, „Bella" schon (obwohl ähnlich wie „bellt"). */
    known(tok) {
      for (const q of this.hits(tok).values()) if (q >= 0.9) return true;
      return false;
    },
  };
}

/* Analyse einer Nachricht gegen einen Index: Tokens + Treffer + Positionsliste je Begriff. */
export function analyze(text, index) {
  const norm = normalize(text);
  const toks = tokenize(norm);
  const pos = new Map();
  for (const tk of toks) {
    tk.h = index.hits(tk.t);
    for (const k of tk.h.keys()) addTo(pos, k, tk.i);
  }
  const q = questionInfo(norm, toks);
  return { raw: String(text == null ? '' : text), norm, toks, pos, question: q.any, qBySentence: q.bySentence };
}

function hitQ(tk, alts) {
  let best = 0;
  for (const a of alts) { const v = tk.h.get(a); if (v > best) best = v; }
  return best;
}

function extend(els, ei, toks, last, idxs, q, scopeKey, scopeVal) {
  if (ei >= els.length) return { start: idxs[0], end: last, idxs, q };
  const el = els[ei];
  const lim = Math.min(toks.length - 1, last + 1 + el.gap);
  for (let j = last + 1; j <= lim; j++) {
    if (toks[j][scopeKey] !== scopeVal) break;
    const qj = hitQ(toks[j], el.alts);
    if (qj) {
      const r = extend(els, ei + 1, toks, j, idxs.concat(j), q < qj ? q : qj, scopeKey, scopeVal);
      if (r) return r;
    }
  }
  return null;
}

/* Alle Treffer eines kompilierten Musters (nicht überlappende Starts). */
export function findAll(els, an, scope) {
  const scopeKey = scope === 'sentence' ? 's' : 'c';
  const starts = [];
  for (const a of els[0].alts) { const p = an.pos.get(a); if (p) for (const x of p) starts.push(x); }
  if (!starts.length) return [];
  starts.sort((x, y) => x - y);
  const out = [];
  let lastStart = -1;
  for (const s of starts) {
    if (s === lastStart) continue;
    lastStart = s;
    const tk = an.toks[s];
    const q0 = hitQ(tk, els[0].alts);
    const r = extend(els, 1, an.toks, s, [s], q0, scopeKey, tk[scopeKey]);
    if (r) out.push(r);
  }
  return out;
}

/* Verneint? Ein Verneinungswort bis 3 Tokens davor oder 1 Token danach im selben Teilsatz, das nicht
   selbst Teil des Musters ist. „atmet nicht schwer" → verneint; „atmet nicht" (Muster enthält
   „nicht") → nicht verneint, sondern das Symptom selbst. */
export function isNegated(an, m) {
  const toks = an.toks;
  const c = toks[m.start].c;
  const from = Math.max(0, m.start - 3);
  const to = Math.min(toks.length - 1, m.end + 1);
  for (let i = from; i <= to; i++) {
    if (toks[i].c !== c || !toks[i].neg) continue;
    if (m.idxs.indexOf(i) >= 0) continue;
    // „nicht nur" ist keine Verneinung
    const nx = toks[i + 1];
    if (nx && nx.t === 'nur') continue;
    return true;
  }
  return false;
}

/* Hilfsfunktion: Text des Treffers (für explain.matched). */
export function matchText(an, m) {
  return an.toks.slice(m.start, m.end + 1).map((t) => t.t).join(' ');
}

/* Kommt ein Begriff (beliebige Alternative) irgendwo im Satz/Teilsatz vor? */
export function hasIn(an, alts, sentence, scope) {
  const key = scope === 'clause' ? 'c' : 's';
  for (const a of alts) {
    const p = an.pos.get(a);
    if (p) for (const i of p) if (sentence === undefined || an.toks[i][key] === sentence) return i;
  }
  return -1;
}
