/* Bot 3.0 — Texte der beiden anderen Rollen, Begrüßung und Bild-Antwort.

   persona 'owner'     = der Bot spielt die Tierhalter:in und antwortet der Praxis (Praxis-Posteingang-Demo).
   persona 'colleague' = der Bot spielt eine andere Tierarztpraxis im Netzwerk-Chat (NEU in v3; Audit:
                         Bot 2.2 hat Kolleg:innen wie Tierhalter:innen beantwortet — „Wir sind in 15 Minuten
                         bei Ihnen!" an eine Klinik).
   Kolleg:innen sprechen sich — wie in den Demo-Chats — mit „ihr/euch" an (Praxis an Praxis), sonst gilt
   die Sie-Form. Tierhalter:innen verwenden das richtige Pronomen (Audit: „er" für die Hündin Luna). */
import { slotParts } from './dialog.js';

/* ---------- Pronomen aus Geschlecht bzw. grammatischem Geschlecht der Tierart ---------- */
const SPECIES_GENUS = { dog: 'm', cat: 'f', small: 'n', horse: 'n', bird: 'm', exotic: 'f' };
const PRON = {
  m: { nom: 'er', acc: 'ihn', dat: 'ihm' },
  f: { nom: 'sie', acc: 'sie', dat: 'ihr' },
  n: { nom: 'es', acc: 'es', dat: 'ihm' },
};
const OWN_NOUN = {
  dog: { m: 'unser Hund', f: 'unsere Hündin' }, cat: { m: 'unser Kater', f: 'unsere Katze' },
  small: { n: 'unser Kleiner' }, horse: { n: 'unser Pferd' }, bird: { m: 'unser Vogel' }, exotic: { f: 'unsere Echse' },
};

export function ownerPet(c) {
  const g = c.gender || SPECIES_GENUS[c.species] || 'n';
  const P = PRON[g] || PRON.n;
  let N = c.petName;
  if (!N) {
    const nouns = OWN_NOUN[c.species];
    N = (nouns && (nouns[g] || nouns[Object.keys(nouns)[0]])) || 'unser Tier';
  }
  return { N, P, g };
}

export function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* Uhrzeit/Tag aus dem Praxistext („Passt Ihnen morgen um 10:00?") für die Zusage */
function whenOf(c) {
  const t = c.times && c.times.length ? c.times[0] : '';
  const d = c.day || '';
  if (d && t) return `${d === 'heute' || d === 'morgen' || d === 'übermorgen' ? d : 'am ' + d} um ${t} Uhr`;
  if (t) return `um ${t} Uhr`;
  if (d) return d === 'heute' || d === 'morgen' || d === 'übermorgen' ? d : 'am ' + d;
  return '';
}

/* ---------- Tierhalter:in antwortet der Praxis ---------- */
export const OWNER_R = {
  'o-notemergency': (c) => {
    const { P } = ownerPet(c);
    const w = whenOf(c);
    return [c.pick([
      `Oh, da bin ich erleichtert — danke! Dann kommen wir ${w || 'wie besprochen'}.`,
      `Gut zu wissen, danke für die Einschätzung. Wir beobachten ${P.acc} weiter und kommen ${w || 'zum Termin'}.`,
    ])];
  },
  'o-comenow': (c) => {
    const { N } = ownerPet(c);
    return [c.pick([
      `Alles klar, wir machen uns sofort auf den Weg — in etwa 15 Minuten sind wir bei Ihnen.`,
      `Verstanden, wir fahren gleich los! ${cap(N)} ist schon in der Box.`,
      `Danke, wir kommen sofort. Bis gleich!`,
    ])];
  },
  'o-canyoucome': (c) => {
    const { N } = ownerPet(c);
    const w = whenOf(c);
    return [c.pick([
      `Ja, das schaffen wir${w ? ' ' + w : ''} — wir kommen mit ${N} vorbei.`,
      `Klar, wir kommen gern${w ? ' ' + w : ''}. Bis dann!`,
    ])];
  },
  'o-calloffer': (c) => [c.pick([
    'Danke, das mache ich! Im Moment ist alles klar.',
    'Vielen Dank, ich melde mich, falls noch etwas ist.',
  ])],
  'o-howis': (c) => {
    const { N, P } = ownerPet(c);
    return [c.pick([
      `Danke der Nachfrage! ${cap(N)} geht es schon etwas besser — ${P.nom} ist ruhiger und frisst wieder ein bisschen.`,
      `Es geht bergauf, danke! ${cap(P.nom)} ist wieder munterer, schont sich aber noch.`,
      `Schon besser, danke! ${cap(N)} schläft viel, wirkt aber ruhig und entspannt.`,
    ])];
  },
  'o-since': (c) => {
    const { P } = ownerPet(c);
    return [c.pick([
      `Seit gestern Nachmittag ungefähr — vorher war ${P.nom} ganz normal.`,
      'Seit etwa zwei Tagen, heute ist es aber deutlicher geworden.',
      `Seit heute früh — beim Spaziergang ist es mir das erste Mal aufgefallen.`,
    ])];
  },
  'o-eating': (c) => {
    const { N, P } = ownerPet(c);
    return [c.pick([
      `${cap(P.nom)} frisst etwas weniger als sonst, trinkt aber normal.`,
      `Ja, ${N} hat heute früh gefressen und auch getrunken — nur etwas langsamer als sonst.`,
      `Der Appetit ist ganz okay, ${P.nom} frisst und trinkt.`,
    ])];
  },
  'o-slotoffer': (c) => {
    const { N } = ownerPet(c);
    const w = whenOf(c);
    return [c.pick([
      w ? `Ja, ${w} passt uns gut — wir kommen mit ${N}.` : `Ja, das passt uns gut — wir kommen mit ${N}.`,
      w ? `${cap(w)} passt bei uns, danke! Wir sind pünktlich da.` : 'Der Termin passt bei uns, danke! Wir sind pünktlich da.',
    ])];
  },
  'o-noslot': (c) => [c.pick([
    'Schade — ginge es dann vielleicht morgen? Wir sind zeitlich flexibel.',
    'Okay, verstehe. Können Sie uns den nächsten freien Termin sagen?',
  ])],
  'o-price': (c) => [c.pick([
    'Danke für die Info, das ist in Ordnung.',
    'Gut zu wissen, danke für die Auskunft!',
  ])],
  'o-docs': (c) => [c.pick([
    'Mache ich — den Impfpass und die Unterlagen packe ich gleich ein.',
    'Alles klar, ich denke an den Impfpass und die Unterlagen.',
  ])],
  'o-fasting': (c) => {
    const { P } = ownerPet(c);
    return [c.pick([
      `Verstanden. Ab wann genau darf ${P.nom} nichts mehr fressen — und Wasser ist in Ordnung, oder?`,
      'Alles klar, dann gibt es morgens nichts zu fressen. Wasser darf aber bleiben?',
    ])];
  },
  'o-meds': (c) => {
    const { N } = ownerPet(c);
    return [c.pick([
      `Alles klar, ich gebe ${N} die Tablette genau so. Wie lange soll ich das machen?`,
      'Verstanden, ich halte mich genau daran. Wie lange sollen wir die Tabletten geben?',
    ])];
  },
  'o-rest': (c) => {
    const { N, P } = ownerPet(c);
    return [c.pick([
      `Machen wir — ${N} bleibt an der Leine und wir halten ${P.acc} schön ruhig.`,
      `Verstanden, wir schonen ${P.acc} und gehen nur kurz an der Leine.`,
    ])];
  },
  'o-exam': (c) => [c.pick([
    'Wenn Sie das für nötig halten, machen Sie das bitte. Wie lange dauert das ungefähr?',
    'Okay. Wann wissen wir denn das Ergebnis?',
  ])],
  'o-resultok': (c) => {
    const { N } = ownerPet(c);
    return [c.pick([
      'Was für eine Erleichterung — vielen Dank für die schnelle Rückmeldung!',
      `Das ist eine gute Nachricht, danke! Da wird sich ${N} freuen.`,
    ])];
  },
  'o-resultbad': (c) => {
    const { N } = ownerPet(c);
    return [c.pick([
      `Oh je … Was bedeutet das jetzt für ${N}, und wie geht es weiter?`,
      'Das ist erst einmal ein Schreck. Was empfehlen Sie uns jetzt?',
    ])];
  },
  'o-vaccstatus': (c) => [c.pick([
    'Ich glaube ja, die letzte Impfung war im Frühjahr — ich bringe den Impfpass zur Sicherheit mit.',
    'Da schaue ich gleich im Impfpass nach und gebe Ihnen Bescheid.',
  ])],
  'o-operation': (c) => {
    const { P } = ownerPet(c);
    return [c.pick([
      `Oh — ist die Operation denn unbedingt nötig? Und wie lange muss ${P.nom} dann bei Ihnen bleiben?`,
      'Okay. Worauf müssen wir vor und nach der Operation achten?',
    ])];
  },
  'o-bye': (c) => [c.pick(['Danke, Ihnen auch! Bis bald.', 'Vielen Dank — schönen Tag noch!'])],
  'o-greeting': (c) => {
    const { N } = ownerPet(c);
    return [c.pick([`Hallo! Schön, von Ihnen zu hören. Geht es um ${N}?`, 'Hallo! Ja, ich lese mit.'])];
  },
  'o-thanks': (c) => [c.pick(['Gern! Und danke Ihnen für die Hilfe.', 'Wir haben zu danken!'])],
};

export function ownerFallback(c, kind) {
  if (kind === 'empty') return [c.pick(['Entschuldigung, da ist wohl nichts angekommen — was wollten Sie mir schreiben?', 'Hallo? Die Nachricht war leer.'])];
  if (kind === 'question') return [c.pick(['Da bin ich nicht ganz sicher — können Sie mir das kurz erklären?', 'Gute Frage — was meinen Sie genau?'])];
  return [c.pick(['Danke für die Info! Gibt es sonst noch etwas, worauf wir achten sollen?', 'Alles klar, danke. Wir melden uns, falls sich etwas ändert.'])];
}

/* ---------- Kolleg:in (andere Praxis) antwortet im Netzwerk-Chat ---------- */
export const COLLEAGUE_R = {
  'c-transfer': (c) => {
    if (c.urgent) {
      return [c.pick([
        `Ja, schickt den Patienten sofort rüber — wir machen alles bereit. Ruft bitte kurz durch, wenn ihr losfahrt${c.tel}.`,
        `Klar, sofort! Wir bereiten den Behandlungsraum vor. Gebt uns bitte kurz Bescheid, wann ihr ankommt${c.tel}.`,
      ])];
    }
    return [c.pick([
      'Klar, das übernehmen wir gern. Schickt uns bitte vorab Signalement, Befunde und aktuelle Medikation.',
      'Kein Thema, den Fall nehmen wir. Die Besitzer:innen können sich direkt bei uns melden — die Befunde gern vorab per Mail.',
      'Machen wir. Sagt uns kurz, worum es geht und wie dringend es ist, dann planen wir entsprechend ein.',
    ])];
  },
  'c-opslot': (c) => {
    const s = c.slots(false, c.dayHint);
    const txt = c.slotText(s);
    return { texts: [c.pick([
      `Wir hätten ${txt} ein OP-Fenster frei — was ist euch lieber?`,
      `Schaut gut aus: ${txt} ist bei uns im OP noch Platz. Sagt einfach, welcher Termin euch lieber ist.`,
    ])], offer: true };
  },
  'c-records': (c) => [c.pick([
    'Danke! Sobald die Befunde da sind, schauen wir sie uns an und melden uns, falls noch etwas fehlt.',
    'Passt, danke fürs Schicken. Wir sehen uns die Unterlagen heute noch an.',
    'Klar, wir schicken euch die Befunde gleich per Mail rüber.',
  ])],
  'c-coverage': (c) => [c.pick([
    'Das können wir übernehmen. Gebt euren Patientenbesitzer:innen gern unsere Nummer — bitte immer kurz vorher anrufen lassen.',
    'Geht in Ordnung, wir haben an dem Wochenende Bereitschaft. Schickt uns die Fälle, bei Dringendem bitte vorher kurz durchrufen.',
  ])],
  'c-supply': (c) => [c.pick([
    'Wir schauen gleich nach, was wir auf Lager haben, und melden uns in einer Stunde. Wie viel bräuchtet ihr ungefähr?',
    'Da helfen wir gern aus. Sagt uns kurz Präparat und Menge, dann legen wir es euch zum Abholen bereit.',
  ])],
  'c-consult': (c) => [c.pick([
    'Spannender Fall — schickt uns gern die Werte und Bilder, dann schauen wir heute noch drauf und rufen zurück.',
    'Gern, dazu sagen wir euch unsere Einschätzung. Am besten mit Anamnese und den bisherigen Befunden.',
  ])],
  'c-equipment': (c) => [c.pick([
    'Unser Gerät ist diese Woche noch frei — sagt einfach, wann ihr es braucht, dann blocken wir den Termin.',
    'Klar, das könnt ihr bei uns mitbenutzen. Wann würde es euch passen?',
  ])],
  'c-thanks': (c) => [c.pick(['Gern geschehen — dafür ist das Netzwerk ja da!', 'Sehr gern, jederzeit wieder.'])],
  'c-greeting': (c) => [c.pick([`Servus aus ${c.facts.display}! Was können wir für euch tun?`, 'Hallo, liebe Kolleg:innen! Worum geht es?'])],
  'c-bye': (c) => [c.pick(['Danke euch, schönes Wochenende!', 'Bis bald und liebe Grüße ins Team!'])],
};

export function colleagueFallback(c, kind) {
  if (kind === 'empty') return [c.pick(['Da ist wohl nichts angekommen — was wolltet ihr uns schicken?'])];
  if (kind === 'booked') return [c.pick([`Super, dann ist ${c.bookedLabel} für euch reserviert. Schickt uns bitte vorab die Befunde.`, `Passt, ${c.bookedLabel} ist fix eingetragen. Bis dann!`])];
  return [c.pick([
    'Danke für die Nachricht — wir schauen uns das an und melden uns gleich. Bei Dringendem ruft bitte direkt an.',
    'Alles klar, wir kümmern uns darum und geben euch Bescheid.',
  ])];
}

/* ---------- Begrüßung (leerer Chat) ---------- */
export function greetingText(persona, name, pick) {
  const n = String(name || '').trim();
  if (persona === 'owner') return pick([n ? `Hallo ${n}, danke, dass Sie sich melden!` : 'Hallo, danke, dass Sie sich melden!']);
  if (persona === 'colleague') return pick([n ? `Servus aus ${n}! 👋 Was können wir für euch tun?` : 'Servus, liebe Kolleg:innen! 👋 Was können wir für euch tun?']);
  const where = n || 'unserer Praxis';
  return pick([
    `Hallo und willkommen bei ${where}! 👋 Wie können wir Ihnen und Ihrem Tier helfen? Bei einem Notfall rufen Sie bitte direkt an.`,
    `Grüß Sie bei ${where}! 👋 Schreiben Sie uns gern, worum es geht — in Notfällen bitte sofort anrufen.`,
  ]);
}

/* ---------- Bild ohne KI ---------- */
export function imageTexts(persona, c) {
  if (persona === 'owner') return [c.pick(['Danke für das Bild! Das sehen wir uns gleich an.', 'Danke fürs Schicken des Bildes!'])];
  if (persona === 'colleague') return [c.pick(['Danke für das Bild — wir schauen es uns an und melden uns gleich.', 'Bild ist angekommen, danke! Wir sehen es uns an.'])];
  return [c.pick([
    `Danke für das Bild${c.petName ? ' von ' + c.petName : ''} — wir sehen es uns gleich genau an. Ein Foto ersetzt aber keine Untersuchung.`,
    `Danke, das Bild ist angekommen${c.petName ? ' — wir schauen es uns für ' + c.petName + ' an' : ''}. Beschreiben Sie gern noch kurz, seit wann das so ist.`,
  ])];
}

export { slotParts };
