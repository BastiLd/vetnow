// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* Bot 3.0 — begrenzte Damerau-Levenshtein-Distanz für Tippfehler.

   Warum begrenzt: Wir wollen nur wissen „≤ 1 bzw. ≤ 2 Fehler?", nicht die exakte Distanz. Sobald
   eine ganze Zeile über dem Limit liegt, brechen wir ab — das hält den Bot auch bei 2000 Zeichen
   schnell (Budget: p95 < 5 ms je Antwort).
   Warum nur für Wörter ab 5 Buchstaben: Bei kurzen Wörtern ist ein Tippfehler meist ein anderes
   Wort („reis" ≠ „preis", „gift" ≠ „gut"). Das hat der Prototyp aus dem Audit bestätigt. */

export function maxEdits(len) {
  if (len >= 9) return 2;
  if (len >= 5) return 1;
  return 0;
}

/* Distanz mit Vertauschung benachbarter Buchstaben („hnud" → „hund" = 1). Liefert max+1, sobald
   das Limit sicher überschritten ist. */
export function damerau(a, b, max) {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (la === 0) return lb;
  if (lb === 0) return la;
  let prev2 = null;
  let prev = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    const cur = new Array(lb + 1);
    cur[0] = i;
    let rowMin = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cb = b.charCodeAt(j - 1);
      let v = prev[j] + 1;
      const ins = cur[j - 1] + 1;
      if (ins < v) v = ins;
      const sub = prev[j - 1] + (ca === cb ? 0 : 1);
      if (sub < v) v = sub;
      if (prev2 && j > 1 && ca === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === cb) {
        const tr = prev2[j - 2] + 1;
        if (tr < v) v = tr;
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[lb];
}

/* Ist `tok` ein Tippfehler von `term`? Erster Buchstabe muss stimmen (oder mit dem zweiten
   vertauscht sein) — Tippfehler am Wortanfang sind selten, falsche Treffer dort häufig. */
export function isTypoOf(tok, term) {
  const max = maxEdits(term.length);
  if (max === 0 || tok.length < 5) return false;
  if (tok[0] !== term[0] && !(tok[0] === term[1] && tok[1] === term[0])) return false;
  return damerau(tok, term, max) <= max;
}
