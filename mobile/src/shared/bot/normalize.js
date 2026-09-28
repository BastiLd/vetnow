// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* Bot 3.0 — Normalisierung und Zerlegung von Nachrichten.

   Warum überhaupt: Bot 2.2 hat rohe Regexe auf den kleingeschriebenen Text gelegt. Dadurch
   scheiterten „Kaetzchen", „Hund atmet   schwer", „NOTFALLLL", Emojis und Tippfehler. Hier wird
   jede Eingabe EINMAL in eine stabile Form gebracht, die alle anderen Module teilen:
     - Kleinschreibung, Umlaute gefaltet (ä→ae, ö→oe, ü→ue, ß→ss). Weil die Lexika mit derselben
       Funktion gefaltet werden, ist „Kätzchen" = „Kaetzchen" (umlaut-unabhängig).
     - Längenlimit 2000 Zeichen VOR jeder weiteren Verarbeitung (Audit: kubischer Regex-Absturz bei
       18k Zeichen). Bei überlangen Texten bleiben Anfang UND Schluss erhalten, weil Menschen das
       Dringende oft zuletzt schreiben („… jetzt atmet er schwer").
     - Sätze (. ! ? ;) und Teilsätze (Komma, „und/aber/oder …") als Gültigkeitsbereich für
       Verneinungen: „kein Notfall, aber er atmet schwer" darf die Atemnot nicht „verneinen".

   Hermes-Regeln (React Native): kein Lookbehind, keine Unicode-Property-Escapes, kein String.prototype.normalize
   (nicht überall verfügbar) — kombinierende Zeichen werden deshalb von Hand behandelt. */

export const MAX_LEN = 2000;

const ACCENTS = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'å': 'a', 'æ': 'ae', 'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ø': 'oe',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ý': 'y', 'ÿ': 'y', 'œ': 'oe',
};

/* Kopf + Schluss behalten, Gesamtlänge ≤ MAX_LEN. */
export function capText(s) {
  const t = String(s == null ? '' : s);
  if (t.length <= MAX_LEN) return t;
  return t.slice(0, 1500) + ' . ' + t.slice(t.length - (MAX_LEN - 1503));
}

/* Nur Falten (Kleinschreibung + Umlaute + Akzente) — für Lexikon-Einträge und Namen. */
export function fold(s) {
  let t = String(s == null ? '' : s).toLowerCase();
  // NFD-Eingaben (z. B. macOS-Tastatur): Vokal + kombinierendes Trema zu Umlaut-Ersatz
  t = t.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
  t = t.replace(/[̀-ͯ]/g, '');
  t = t.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  t = t.replace(/[àáâãåæçèéêëìíîïñòóôõøùúûýÿœ]/g, (c) => ACCENTS[c] || c);
  return t;
}

/* Volle Normalform für die Analyse. */
export function normalize(text) {
  let t = fold(capText(text));
  t = t.replace(/[&+]/g, ' und ');
  // Uhrzeiten vereinheitlichen: „14.00" → „14:00" (Lookahead ist in Hermes erlaubt, Lookbehind nicht)
  t = t.replace(/(\d{1,2})[.:](\d{2})(?!\d)/g, '$1:$2');
  // Alles außer Buchstaben/Ziffern/Satzzeichen (Emojis, andere Schriften) wird Leerraum
  t = t.replace(/[^a-z0-9:.,;!?\s-]/g, ' ');
  // „notfallllll" → „notfall", „hiiiilfe" → „hiilfe" (Rest erledigt die Tippfehler-Toleranz)
  t = t.replace(/([a-z])\1{2,}/g, '$1$1');
  t = t.replace(/([!?.,;])[!?.,;]+/g, '$1');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/* Sehr einfaches deutsches Stemming — reicht für „Impfungen"→„impfung", „Termine"→„termin".
   Bewusst vorsichtig (Rest ≥ 4 Buchstaben), damit keine Wörter zusammenfallen. */
const SUFFIXES = ['ungen', 'innen', 'chen', 'en', 'er', 'em', 'es', 'e', 'n', 's'];
export function stem(w) {
  if (!w || w.length < 5) return w;
  for (const s of SUFFIXES) {
    if (w.length - s.length >= 4 && w.endsWith(s)) {
      return s === 'ungen' ? w.slice(0, -5) + 'ung' : w.slice(0, -s.length);
    }
  }
  return w;
}

/* Wörter, an denen ein Teilsatz endet: Verneinung gilt nur bis hierher. „doch" fehlt absichtlich
   („das schadet doch nicht") — dort ist es Füllwort, keine Satzgrenze. */
const CLAUSE_BREAK = {
  und: 1, oder: 1, aber: 1, sondern: 1, jedoch: 1, trotzdem: 1, obwohl: 1, weil: 1, denn: 1, but: 1, and: 1,
};

const NEGATORS = {
  nicht: 1, kein: 1, keine: 1, keinen: 1, keinem: 1, keiner: 1, keines: 1, nichts: 1, nie: 1, niemals: 1,
  ohne: 1, net: 1, ned: 1, koa: 1, koane: 1, nix: 1, not: 1, no: 1, never: 1, dont: 1, doesnt: 1, isnt: 1, nimmer: 1,
};
export function isNegator(t) { return NEGATORS[t] === 1; }

const QSTART = {
  kann: 1, koennen: 1, koennte: 1, kannst: 1, darf: 1, duerfen: 1, soll: 1, sollte: 1, sollen: 1, muss: 1, muessen: 1,
  wie: 1, was: 1, wann: 1, wo: 1, warum: 1, wieso: 1, weshalb: 1, welche: 1, welcher: 1, welches: 1, welchen: 1,
  gibt: 1, macht: 1, hilft: 1, schadet: 1, braucht: 1, brauche: 1, habt: 1, seid: 1, wer: 1, wieviel: 1,
  can: 1, is: 1, should: 1, what: 1, how: 1, when: 1, where: 1, do: 1, does: 1,
};
const QSTART_WEAK = { ist: 1, sind: 1, hat: 1, haben: 1, hatte: 1, war: 1 };

/* Zerlegt den normalisierten Text in Tokens mit Satz- (s) und Teilsatz-Index (c).
   Satzzeichen trennen; Bindewörter trennen nur Teilsätze und werden selbst nicht Token. */
export function tokenize(norm) {
  const toks = [];
  let s = 0; let c = 0; let pendingBreak = false; let sentenceHasTok = false;
  const re = /[a-z0-9]+(?::[0-9]{2})?|[.!?;]|,|\s-\s/g;
  let m;
  while ((m = re.exec(norm)) !== null) {
    const w = m[0];
    if (w === '.' || w === '!' || w === '?' || w === ';') {
      if (sentenceHasTok) { s++; c++; sentenceHasTok = false; }
      pendingBreak = false;
      continue;
    }
    if (w === ',' || w.trim() === '-') { pendingBreak = true; continue; }
    if (CLAUSE_BREAK[w] === 1) { pendingBreak = true; continue; }
    if (pendingBreak && sentenceHasTok) c++;
    pendingBreak = false;
    sentenceHasTok = true;
    toks.push({ t: w, s, c, i: toks.length, neg: NEGATORS[w] === 1, h: null });
  }
  return toks;
}

/* Frage-Erkennung je Satz und für die ganze Nachricht. */
export function questionInfo(norm, toks) {
  const sentences = {};
  // Welche Sätze enden mit „?" — über die Position im normalisierten Text nachvollziehen
  const parts = norm.split(/([.!?;])/);
  let si = 0; let buf = '';
  for (const p of parts) {
    if (p === '.' || p === '!' || p === '?' || p === ';') {
      if (/[a-z0-9]/.test(buf)) { if (p === '?') sentences[si] = true; si++; }
      buf = '';
    } else buf += p;
  }
  const firstOf = {};
  for (const tk of toks) if (firstOf[tk.s] === undefined) firstOf[tk.s] = tk;
  for (const key of Object.keys(firstOf)) {
    const f = firstOf[key];
    const next = toks[f.i + 1];
    if (QSTART[f.t] === 1) sentences[key] = true;
    else if (QSTART_WEAK[f.t] === 1 && (f.t === 'ist' || f.t === 'sind')) {
      // „Ist Avocado giftig" = Frage (auch ohne „?"), „Ist nicht dringend" = Aussage.
      // „Hat seit gestern Durchfall" bleibt Aussage — hat/haben zählen nur mit „?".
      const nt = next && next.s === f.s ? next.t : '';
      if (nt && !next.neg && nt !== 'er' && nt !== 'sie' && nt !== 'es' && nt !== 'seit') sentences[key] = true;
    }
  }
  const any = norm.indexOf('?') >= 0 || Object.keys(sentences).some((k) => sentences[k]);
  return { any, bySentence: sentences };
}
