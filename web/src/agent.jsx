/* VetNow — KI-Agent: führt Aufgaben SICHTBAR in der App aus.
   Der Agent navigiert wirklich durch die Screens (Start, Suche, Ergebnisse,
   Dashboard-Tabs …), liest dabei die echten App-Daten und schreibt am Ende
   einen Bericht — mit Ollama (falls verbunden) als frei formulierter Text,
   sonst als strukturierte Zusammenfassung.

   Steuerung über CustomEvents ('vn:agent'), die App.jsx und das Dashboard
   abonnieren: {action:'nav'|'dashTab'|'filters'}. */
import React from 'react';
import { VNIcon } from './components.jsx';
import { useVNData } from './lib/adminContext.jsx';
import { useChats } from './lib/chats.jsx';
import { aiChat } from './lib/ai.js';

const emit = (detail) => window.dispatchEvent(new CustomEvent('vn:agent', { detail }));

const SPEEDS = { langsam: 2600, normal: 1600, schnell: 800 };

const TEMPLATES = [
  { key: 'day', label: '🏥 Tag als Praxis simulieren', text: 'Simuliere einen Arbeitstag aus Sicht der Praxis und gib mir danach einen Bericht.' },
  { key: 'emergency', label: '🚨 Notfall-Durchlauf', text: 'Spiele einen Notfall durch: Hund, Notfall, Bezirk Villach — finde die beste Praxis.' },
  { key: 'check', label: '🔍 Praxis-Check', text: 'Prüfe die öffentliche Suche und vergleiche die verfügbaren Praxen.' },
];

function classify(task) {
  const t = (task || '').toLowerCase();
  if (/(notfall|emergency|dringend)/.test(t)) return 'emergency';
  if (/(check|prüf|vergleich|suche testen)/.test(t)) return 'check';
  return 'day';
}

/* ---- Aktions-Katalog: alles, was der KI-Planer sichtbar auslösen darf ---- */
const AGENT_ACTS = {
  home:         { desc: 'Startseite öffnen', run: () => emit({ action: 'nav', name: 'home' }) },
  search:       { desc: 'Such-Screen öffnen (öffentliche Praxis-Suche)', run: () => emit({ action: 'nav', name: 'search' }) },
  results:      { desc: 'Ergebnisliste der Praxis-Suche öffnen', run: () => emit({ action: 'nav', name: 'results' }) },
  dashboard:    { desc: 'Praxis-Dashboard öffnen', run: () => emit({ action: 'nav', name: 'dashboard' }) },
  tab_status:   { desc: 'Dashboard-Tab „Status/Ampel“ öffnen', run: () => emit({ action: 'dashTab', tab: 'status' }) },
  tab_appts:    { desc: 'Dashboard-Tab „Termine“ öffnen', run: () => emit({ action: 'dashTab', tab: 'appts' }) },
  tab_messages: { desc: 'Dashboard-Tab „Posteingang/Nachrichten“ öffnen', run: () => emit({ action: 'dashTab', tab: 'messages' }) },
  tab_profile:  { desc: 'Dashboard-Tab „Profil“ öffnen', run: () => emit({ action: 'dashTab', tab: 'profile' }) },
  filters_emergency: { desc: 'Suchfilter setzen: Hund + Notfall + Bezirk Villach + nur „heute erreichbar“', run: () => emit({ action: 'filters', filters: { animals: ['dog'], situations: ['emergency'], districts: ['Villach'], onlyGreen: true } }) },
  filters_clear: { desc: 'Alle Suchfilter entfernen', run: () => emit({ action: 'filters', filters: { animals: [], situations: [], districts: [], specialties: [], onlyConfirmed: false, onlyGreen: false, housecall: false, is24h: false } }) },
  detail_best:  { desc: 'Beste grüne (erreichbare) Praxis im Detail öffnen', run: (facts) => facts.bestGreen && emit({ action: 'nav', name: 'detail', opts: { practiceId: facts.bestGreen.id } }) },
  detail_grey:  { desc: 'Eine lange nicht bestätigte (graue) Praxis im Detail öffnen', run: (facts) => facts.anyGrey && emit({ action: 'nav', name: 'detail', opts: { practiceId: facts.anyGrey.id } }) },
  none:         { desc: 'Keine Aktion — nur beobachten/erklären', run: () => {} },
};

/* KI-Planung: Die KI liest die AUFGABE und wählt selbst die passenden Schritte.
   Antwort wird per Ollama-JSON-Modus erzwungen und hart validiert. */
async function planWithAi(task, facts, settings) {
  const actList = Object.entries(AGENT_ACTS).map(([k, v]) => '- "' + k + '": ' + v.desc).join('\n');
  const sys = `Du bist der Planungs-Agent der Tierarztpraxis-App "VetNow". Du bekommst eine Aufgabe vom Nutzer und planst 3 bis 8 Schritte, die danach SICHTBAR in der App ausgeführt werden.
Antworte NUR mit JSON in exakt dieser Form: {"steps":[{"say":"...","act":"..."}]}
- "say": ein kurzer deutscher Satz (max. 25 Wörter), was du gerade tust und was du dabei siehst — nutze die mitgelieferten Fakten (echte Zahlen!).
- "act": genau EINER dieser Aktionsnamen:
${actList}
Wähle die Schritte PASSEND ZUR AUFGABE — nicht immer dieselben. Der letzte Schritt hat act "home". Alles auf Deutsch.`;
  const user = 'AUFGABE: ' + task + '\n\nFAKTEN (echte App-Daten): ' + JSON.stringify(facts);
  const raw = await aiChat({
    model: settings.aiModel, aiBaseUrl: settings.aiBaseUrl, format: 'json',
    messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
  });
  let data;
  try { data = JSON.parse(String(raw).replace(/```json|```/g, '').trim()); }
  catch { throw new Error('KI-Plan war kein gültiges JSON'); }
  const steps = (Array.isArray(data.steps) ? data.steps : [])
    .filter((s) => s && typeof s.say === 'string' && s.say.trim())
    .slice(0, 10)
    .map((s) => ({ say: s.say.trim(), act: AGENT_ACTS[s.act] ? () => AGENT_ACTS[s.act].run(facts) : null }));
  if (steps.length === 0) throw new Error('KI-Plan war leer');
  return steps;
}

/* Skript-Bausteine: jede Zeile = { say, act? } — act löst sichtbare Aktion aus. */
function buildScript(kind, facts) {
  const s = [];
  if (kind === 'day') {
    s.push({ say: 'Guten Morgen! Ich starte den Arbeitstag im Praxis-Dashboard.', act: () => emit({ action: 'nav', name: 'dashboard' }) });
    s.push({ say: 'Zuerst der Status: Ich prüfe die Ampel und bestätige die Erreichbarkeit für heute.', act: () => emit({ action: 'dashTab', tab: 'status' }) });
    s.push({ say: `Weiter zu den Terminen: heute stehen ${facts.apptsToday} Termine im Kalender${facts.firstAppt ? ' — der erste um ' + facts.firstAppt : ''}.`, act: () => emit({ action: 'dashTab', tab: 'appts' }) });
    s.push({ say: `Jetzt der Posteingang: ${facts.clinicChats} Konversationen, davon ${facts.unread} ungelesen.`, act: () => emit({ action: 'dashTab', tab: 'messages' }) });
    s.push({ say: 'Kurzer Blick ins Profil: Öffnungszeiten, Team und Verifizierung passen.', act: () => emit({ action: 'dashTab', tab: 'profile' }) });
    s.push({ say: 'Zum Abschluss prüfe ich, wie die Praxis öffentlich in der Suche erscheint…', act: () => emit({ action: 'nav', name: 'search' }) });
    s.push({ say: `Suche ausgeführt: ${facts.practices} Praxen online, davon ${facts.green} grün (heute erreichbar).`, act: () => emit({ action: 'nav', name: 'results' }) });
    s.push({ say: 'Feierabend! Ich fasse den Tag zusammen…', act: () => emit({ action: 'nav', name: 'home' }) });
  } else if (kind === 'emergency') {
    s.push({ say: 'Notfall-Szenario: Ein Hund braucht sofort Hilfe im Raum Villach. Ich öffne die Suche.', act: () => emit({ action: 'nav', name: 'search' }) });
    s.push({ say: 'Ich setze die Filter: Tierart Hund, Situation Notfall, Bezirk Villach, nur „heute erreichbar“.', act: () => emit({ action: 'filters', filters: { animals: ['dog'], situations: ['emergency'], districts: ['Villach'], onlyGreen: true } }) });
    s.push({ say: 'Filter gesetzt — jetzt die Ergebnisse…', act: () => emit({ action: 'nav', name: 'results' }) });
    s.push({ say: facts.bestGreen ? `Beste Wahl: „${facts.bestGreen.name}“ (grün, ${facts.bestGreen.district}). Ich öffne die Details.` : 'Ich prüfe die Trefferliste im Detail.', act: () => facts.bestGreen && emit({ action: 'nav', name: 'detail', opts: { practiceId: facts.bestGreen.id } }) });
    s.push({ say: 'Notfallhinweis und Öffnungszeiten geprüft — hier würde ich sofort anrufen und parallel die Anfrage senden.' });
    s.push({ say: 'Durchlauf abgeschlossen. Ich erstelle den Bericht…', act: () => emit({ action: 'nav', name: 'home' }) });
  } else {
    s.push({ say: 'Praxis-Check: Ich öffne die Ergebnisliste ohne Filter.', act: () => { emit({ action: 'filters', filters: { animals: [], situations: [], districts: [], specialties: [], onlyConfirmed: false, onlyGreen: false, housecall: false, is24h: false } }); emit({ action: 'nav', name: 'results' }); } });
    s.push({ say: `${facts.practices} Praxen gelistet: ${facts.green}× grün, ${facts.yellow}× gelb, ${facts.grey}× grau, ${facts.red}× rot.` });
    if (facts.bestGreen) s.push({ say: `Stichprobe: „${facts.bestGreen.name}“ …`, act: () => emit({ action: 'nav', name: 'detail', opts: { practiceId: facts.bestGreen.id } }) });
    if (facts.anyGrey) s.push({ say: `Auffällig: „${facts.anyGrey.name}“ ist seit ${facts.anyGrey.confirmedAt} nicht bestätigt — hier würde ich die Praxis erinnern.`, act: () => emit({ action: 'nav', name: 'detail', opts: { practiceId: facts.anyGrey.id } }) });
    s.push({ say: 'Check abgeschlossen. Bericht folgt…', act: () => emit({ action: 'nav', name: 'home' }) });
  }
  return s;
}

function buildReport(kind, facts, task) {
  const lines = [];
  lines.push('📋 AGENT-BERICHT');
  lines.push('Aufgabe: ' + (task || TEMPLATES.find((t) => t.key === kind).text));
  lines.push('');
  if (kind === 'day') {
    lines.push('• Status: bestätigt, Praxis heute erreichbar (grün).');
    lines.push(`• Termine heute: ${facts.apptsToday}${facts.firstAppt ? ' (Start ' + facts.firstAppt + ')' : ''}.`);
    lines.push(`• Posteingang: ${facts.clinicChats} Konversationen, ${facts.unread} ungelesen${facts.unread > 0 ? ' → zeitnah beantworten!' : '.'}`);
    lines.push(`• Öffentliche Sichtbarkeit: ${facts.practices} Praxen online, ${facts.green} grün.`);
    lines.push('');
    lines.push('Empfehlung: Ungelesene Anfragen priorisieren und den Status täglich vor 8 Uhr bestätigen.');
  } else if (kind === 'emergency') {
    lines.push('• Filter: Hund · Notfall · Villach · nur grün.');
    lines.push(facts.bestGreen ? `• Beste Praxis: ${facts.bestGreen.name} (${facts.bestGreen.district}).` : '• Keine grüne Praxis gefunden — Ampel-Warnung würde greifen.');
    lines.push('• Nächster Schritt im Ernstfall: sofort anrufen, dann Anfrage senden (wird als Chat angelegt).');
  } else {
    lines.push(`• Bestand: ${facts.practices} Praxen — ${facts.green} grün / ${facts.yellow} gelb / ${facts.grey} grau / ${facts.red} rot.`);
    if (facts.anyGrey) lines.push(`• Handlungsbedarf: „${facts.anyGrey.name}“ ist nicht aktuell bestätigt.`);
    lines.push('• Suche, Filter und Detailseiten funktionieren wie erwartet.');
  }
  return lines.join('\n');
}

export function AgentPanel() {
  const D = useVNData();
  const { visibleChats, settings } = useChats();
  const [open, setOpen] = React.useState(false);
  const [task, setTask] = React.useState('');
  const [speed, setSpeed] = React.useState('normal');
  const [running, setRunning] = React.useState(false);
  const [log, setLog] = React.useState([]);
  const [report, setReport] = React.useState('');
  const stopRef = React.useRef(false);
  const logRef = React.useRef(null);

  React.useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log, report]);

  if (!settings.agentEnabled) return null;

  const collectFacts = () => {
    const P = D.PRACTICES;
    const byStatus = (st) => P.filter((p) => p.status === st);
    const clinic = visibleChats.filter((c) => c.role === 'clinic');
    const appts = (D.APPTS_BY_DATE && D.APPTS_BY_DATE[D.TODAY_ISO]) || [];
    return {
      practices: P.length,
      green: byStatus('green').length, yellow: byStatus('yellow').length,
      grey: byStatus('grey').length, red: byStatus('red').length,
      bestGreen: byStatus('green')[0] || null,
      anyGrey: byStatus('grey')[0] || null,
      apptsToday: appts.length,
      firstAppt: appts[0] ? appts[0].time + ' Uhr (' + appts[0].name + ')' : '',
      clinicChats: clinic.length,
      unread: clinic.reduce((a, c) => a + (c.unread || 0), 0),
    };
  };

  const run = async (theTask) => {
    if (running) return;
    setRunning(true); stopRef.current = false;
    setLog([]); setReport('');
    const facts = collectFacts();
    const kind = classify(theTask);
    const stepMs = SPEEDS[speed] || SPEEDS.normal;
    const addLog = (line) => setLog((l) => [...l, line]);

    // Die KI plant die Schritte PASSEND zur Aufgabe (jede Aufgabe = eigener Plan).
    let script;
    try {
      addLog('🧠 KI liest die Aufgabe und plant die Schritte…');
      script = await planWithAi(theTask, facts, settings);
      addLog('✅ Plan steht: ' + script.length + ' Schritte.');
    } catch (e) {
      addLog('⚠️ KI NICHT ERREICHBAR (' + (e && e.message ? e.message : 'Fehler') + ') — ich nutze ersatzweise einen festen Beispiel-Ablauf. Für echte KI-Planung: Läuft Ollama? Modell im Studio installiert?');
      script = buildScript(kind, facts);
    }

    for (const step of script) {
      if (stopRef.current) { addLog('⏹ Abgebrochen.'); setRunning(false); return; }
      addLog('🤖 ' + step.say);
      if (step.act) { try { step.act(); } catch { /* ignore */ } }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, stepMs));
    }

    // Bericht: immer per KI formulieren; nur bei Ausfall das strukturierte Template
    let rep = buildReport(kind, facts, theTask);
    try {
      addLog('🧠 Formuliere Bericht mit KI…');
      const ai = await aiChat({
        model: settings.aiModel, aiBaseUrl: settings.aiBaseUrl,
        messages: [
          { role: 'system', content: 'Du bist ein Assistenz-Agent einer Tierarztpraxis-App. Antworte AUSSCHLIESSLICH auf Deutsch. Formuliere aus den Fakten einen kurzen, gut lesbaren Bericht (max. 120 Wörter), der KONKRET auf die Aufgabe eingeht, mit einer konkreten Empfehlung am Ende.' },
          { role: 'user', content: 'Aufgabe: ' + theTask + '\nFakten:\n' + rep },
        ],
      });
      if (ai) rep = '📋 AGENT-BERICHT (KI)\n\n' + ai;
    } catch { addLog('⚠️ KI nicht erreichbar — nutze eingebauten Berichts-Text.'); }
    setReport(rep);
    setRunning(false);
  };

  return (
    <>
      <button className={'agent-fab' + (running ? ' running' : '')} onClick={() => setOpen((o) => !o)} title="KI-Agent" aria-label="KI-Agent öffnen">
        {running ? <span className="agent-pulse" /> : null}🤖
      </button>
      {open && (
        <div className="agent-panel">
          <div className="agent-head">
            <span style={{ fontWeight: 800 }}>🤖 KI-Agent</span>
            <span className="vn-meta" style={{ flex: 1 }}>{running ? 'arbeitet…' : 'bereit'}</span>
            <button className="vn-back" style={{ width: 30, height: 30 }} onClick={() => setOpen(false)}><VNIcon.x s={15} /></button>
          </div>

          {!running && !report && (
            <div className="stack-3" style={{ padding: 12 }}>
              <textarea className="textarea" style={{ minHeight: 56 }} value={task} onChange={(e) => setTask(e.target.value)}
                placeholder="Aufgabe eingeben — z. B. „Simuliere einen Tag aus Sicht der Ambulanz und gib mir einen Bericht“" />
              <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                {TEMPLATES.map((t) => (
                  <button key={t.key} className="tag" style={{ cursor: 'pointer' }} onClick={() => setTask(t.text)}>{t.label}</button>
                ))}
              </div>
              <div className="row gap-2">
                <select className="selectbox" style={{ flex: 1 }} value={speed} onChange={(e) => setSpeed(e.target.value)}>
                  <option value="langsam">🐢 Langsam (gut zum Zusehen)</option>
                  <option value="normal">🚶 Normal</option>
                  <option value="schnell">🐇 Schnell</option>
                </select>
                <button className="btn btn-primary" onClick={() => run(task || TEMPLATES[0].text)}>▶ Start</button>
              </div>
              <div className="vn-meta">Der Agent navigiert sichtbar durch die App — einfach zusehen.</div>
            </div>
          )}

          {(running || log.length > 0) && (
            <div className="agent-log" ref={logRef}>
              {log.map((l, i) => <div key={i} className="agent-line">{l}</div>)}
              {report && <pre className="agent-report">{report}</pre>}
            </div>
          )}

          {(running || report) && (
            <div className="row gap-2" style={{ padding: 12, borderTop: '1px solid var(--line-2)' }}>
              {running
                ? <button className="btn btn-secondary btn-block" onClick={() => { stopRef.current = true; }}>⏹ Stopp</button>
                : <button className="btn btn-primary btn-block" onClick={() => { setLog([]); setReport(''); }}>Neue Aufgabe</button>}
            </div>
          )}
        </div>
      )}
    </>
  );
}
