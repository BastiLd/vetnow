/* VetNow — Suchfilter für die Ergebnisliste (portiert aus web/src/screens-b.jsx applyFilters).

   Verhalten (bewusst gleich wie in v2, damit sich die Suche für Nutzer:innen nicht ändert):
   - INNERHALB einer Kategorie gilt ODER: „Katze + Hund" findet Praxen, die Katzen ODER Hunde behandeln.
   - ZWISCHEN den Kategorien gilt UND: Tierart UND Situation UND Bezirk …
   - Tierart 'other' („Anderes") passt auf JEDE Praxis: Wer ein seltenes Tier hat, soll lieber
     alle Praxen sehen und anrufen, als eine leere Liste zu bekommen.
   - Bezirk: exakter Vergleich des KURZNAMENS ('Spittal'). In v2 stand bei manchen Praxen der
     Langname ('Spittal an der Drau') im Feld district, deshalb gab es dort `startsWith`.
     Der v3-Seed normalisiert auf Kurznamen; zur Sicherheit (alte Hub-Daten, Importe) wird ein
     Langname vorher über districtShort() auf den Kurznamen zurückgeführt.
   - onlyConfirmed: blendet Praxen mit EFFEKTIVEM Status grau aus (abgelaufen/nie bestätigt).
   - onlyGreen: nur effektiv grüne Praxen („Heute erreichbar").
   - housecall: nur Praxen mit Leistung 'housecall'.
   - is24h: Praxen mit 24-Stunden-Betrieb (hoursShort enthält „24 h/Std./Stunden" oder
     jeder Wochentag in hoursWeek ist „24 h"). v2 prüfte nur /24/ — das hätte auch „8–24" erwischt.
   - Ergebnis: Live-Kopien (withLiveStatus → p.status ist der effektive Schlüssel), sortiert
     grün → gelb → grau → rot, innerhalb gleicher Farbe alphabetisch. */
import { withLiveStatus, sortPractices, effectiveStatus } from './status.js';
import { DISTRICTS, DISTRICT_LONG, ANIMAL_LABEL, SERVICE_LABEL, SPECIALTY_LABEL } from './constants.js';
import { now as clockNow } from './clock.js';

export const EMPTY_FILTERS = Object.freeze({
  animals: Object.freeze([]),
  situations: Object.freeze([]),
  districts: Object.freeze([]),
  specialties: Object.freeze([]),
  onlyConfirmed: false,
  onlyGreen: false,
  housecall: false,
  is24h: false,
});

/* Frische, veränderbare Kopie (EMPTY_FILTERS ist eingefroren). */
export function emptyFilters() {
  return { animals: [], situations: [], districts: [], specialties: [], onlyConfirmed: false, onlyGreen: false, housecall: false, is24h: false };
}

const arr = (v) => (Array.isArray(v) ? v : []);

/* 'Spittal an der Drau' → 'Spittal', 'St. Veit an der Glan' → 'St. Veit', 'Villach' → 'Villach'.
   Unbekannte Namen bleiben unverändert (dann passt eben kein Filter-Bezirk). */
export function districtShort(name) {
  const s = String(name || '').trim();
  if (!s) return '';
  if (DISTRICTS.indexOf(s) >= 0) return s;
  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i];
    if (DISTRICT_LONG[d] === s) return d;
  }
  // Letzter Versuch wie in v2: Langname beginnt mit dem Kurznamen („Spittal/Drau").
  for (let i = 0; i < DISTRICTS.length; i++) {
    if (s.indexOf(DISTRICTS[i]) === 0) return DISTRICTS[i];
  }
  return s;
}

const H24_RX = /(^|[^0-9])24\s*(h|std|stunden)/i;

export function is24hPractice(p) {
  if (!p) return false;
  if (H24_RX.test(String(p.hoursShort || ''))) return true;
  const week = arr(p.hoursWeek);
  return week.length === 7 && week.every((d) => H24_RX.test(String(d || '')));
}

/* Prüft EINE Praxis gegen die Filter. `key` = effektiver Statusschlüssel (schon berechnet). */
function matches(p, f, key) {
  const animals = arr(f.animals);
  const situations = arr(f.situations);
  const districts = arr(f.districts);
  const specialties = arr(f.specialties);
  const pAnimals = arr(p.animals);
  const pServices = arr(p.services);
  const pSpecs = arr(p.specialties);
  if (animals.length && !animals.some((a) => a === 'other' || pAnimals.indexOf(a) >= 0)) return false;
  if (situations.length && !situations.some((s) => pServices.indexOf(s) >= 0)) return false;
  if (districts.length) {
    const mine = districtShort(p.district || p.districtLong);
    if (!districts.some((d) => districtShort(d) === mine)) return false;
  }
  if (specialties.length && !specialties.some((s) => pSpecs.indexOf(s) >= 0)) return false;
  if (f.onlyConfirmed && key === 'grey') return false;
  if (f.onlyGreen && key !== 'green') return false;
  if (f.housecall && pServices.indexOf('housecall') < 0) return false;
  if (f.is24h && !is24hPractice(p)) return false;
  return true;
}

/* Hauptfunktion. practices dürfen Roh-Datensätze (status = Objekt) oder schon aufbereitete
   Live-Kopien sein — withLiveStatus ist idempotent. */
export function applyFilters(practices, filters, nowTs) {
  const n = typeof nowTs === 'number' ? nowTs : clockNow();
  const f = filters || EMPTY_FILTERS;
  const live = withLiveStatus(practices, n);
  const list = live.filter((p) => matches(p, f, p.status));
  return sortPractices(list, n);
}

/* Wie viele Praxen blendet „Nur bestätigte" gerade aus? Für den Hinweis
   „2 Praxen mit unbestätigtem Status sind ausgeblendet. Trotzdem anzeigen". */
export function hiddenByOnlyConfirmed(practices, filters, nowTs) {
  const f = filters || EMPTY_FILTERS;
  if (!f.onlyConfirmed) return 0;
  const n = typeof nowTs === 'number' ? nowTs : clockNow();
  const all = (Array.isArray(practices) ? practices : []).filter((p) => p && matches(p, { ...f, onlyConfirmed: false }, effectiveStatus(p, n)));
  return all.filter((p) => effectiveStatus(p, n) === 'grey').length;
}

/* Chips für die Filter-Zusammenfassung („Katze", „Notfall", „Villach", „Nur bestätigte" …). */
export function describeFilters(filters) {
  const f = filters || EMPTY_FILTERS;
  const chips = [];
  arr(f.animals).forEach((a) => chips.push(ANIMAL_LABEL[a] || a));
  arr(f.situations).forEach((s) => chips.push(SERVICE_LABEL[s] || s));
  arr(f.districts).forEach((d) => chips.push(districtShort(d)));
  arr(f.specialties).forEach((s) => chips.push(SPECIALTY_LABEL[s] || s));
  if (f.onlyConfirmed) chips.push('Nur bestätigte');
  if (f.onlyGreen) chips.push('Heute erreichbar');
  if (f.housecall) chips.push('Hausbesuch');
  if (f.is24h) chips.push('24 h');
  return chips;
}

/* Anzahl aktiver Filter (für Badges wie „Filter (3)"). */
export function countActiveFilters(filters) {
  return describeFilters(filters).length;
}
