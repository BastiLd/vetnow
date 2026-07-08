/* Profil-Tab: vollständige Portierung von ProfilePanel (screens-e.jsx) —
   Praxisdaten, strukturierte Öffnungszeiten, Leistungen & Tierarten,
   Spezialgebiete, Verifizierung, Team-Verwaltung, Benachrichtigungen. */
import React from 'react';
import { View, Text, TouchableOpacity, Switch as RNSwitch, StyleSheet } from 'react-native';
import { C, S, R } from '../theme';
import { Card, SectionLabel, Btn, Field, Input, ChoiceGrid, Meta, P, toast } from '../components';
import { VNIcon } from '../icons';
import { DISTRICTS, SPECIALTIES } from '../data';

export function VerifyBadge({ status }) {
  const map = {
    verified: { label: 'Verifiziert', icon: 'checkCircle', bg: C.greenBg, ink: C.greenInk },
    pending: { label: 'In Prüfung', icon: 'clock', bg: C.yellowBg, ink: C.yellowInk },
    none: { label: 'Nicht verifiziert', icon: 'alert', bg: C.greyBg, ink: C.greyInk },
  };
  const m = map[status] || map.none;
  const I = VNIcon[m.icon];
  return (
    <View style={[ps.verify, { backgroundColor: m.bg }]}>
      <I s={13} c={m.ink} />
      <Text style={[ps.verifyText, { color: m.ink }]}>{m.label}</Text>
    </View>
  );
}

export default function ProfileTab({ s }) {
  const [tName, setTName] = React.useState('');
  const [tRole, setTRole] = React.useState('');
  const [tSpec, setTSpec] = React.useState('');

  const setHour = (i, k, v) => s.setHoursWeek((w) => w.map((h, j) => (j === i ? { ...h, [k]: v } : h)));
  const toggleClosed = (i) => s.setHoursWeek((w) => w.map((h, j) => (j === i ? { ...h, closed: !h.closed } : h)));

  const addMember = () => {
    if (!tName.trim()) { toast('Bitte Namen eingeben.', 'error'); return; }
    s.setTeam((t) => [...t, { name: tName.trim(), role: tRole.trim() || 'Tierärztl. Team', specialty: tSpec.trim() }]);
    setTName(''); setTRole(''); setTSpec('');
    toast('Teammitglied hinzugefügt.', 'success');
  };

  const serviceRows = [
    ['emergency', 'Notfälle'], ['regular', 'Normale Termine'], ['euthanasia', 'Einschläferung'],
    ['housecall', 'Hausbesuche'], ['cat', 'Katzen'], ['dog', 'Hunde'], ['small', 'Kleintiere'],
  ];
  const notifRows = [
    ['email', 'E-Mail', 'Zusammenfassungen & wichtige Hinweise', 'mail'],
    ['push', 'Push (App)', 'Neue Nachrichten & Termin-Anfragen', 'phone'],
    ['desktop', 'Desktop', 'Browser-Benachrichtigungen am PC', 'building'],
    ['extension', 'Chrome Extension', 'Status- & Termin-Hinweise im Browser', 'shield'],
  ];

  const selectedSpecs = Object.entries(s.specialties).filter(([, v]) => v).map(([k]) => k);

  return (
    <View style={{ gap: S.s4 }}>
      {/* Praxisdaten */}
      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>Praxisdaten</SectionLabel>
        <View style={{ gap: 12 }}>
          <Field label="Praxisname"><Input defaultValue={s.me.name} /></Field>
          <Field label="Adresse"><Input defaultValue={s.me.address} /></Field>
          <Field label="Bezirk">
            <ChoiceGrid options={DISTRICTS.map((d) => ({ key: d, label: d }))} value={s.district} onChange={s.setDistrict} />
          </Field>
          <Field label="Über uns / Wofür unsere Praxis besonders geeignet ist">
            <Input value={s.about} onChangeText={s.setAbout} multiline placeholder="z. B. Wir sind besonders erfahren bei Chirurgie, Zahnsanierungen und älteren Katzen." />
            <Meta>Dieser Text erscheint auf Ihrer öffentlichen Praxisseite.</Meta>
          </Field>
          <Field label="Notfallhinweis"><Input value={s.note} onChangeText={s.setNote} multiline /></Field>
        </View>
      </Card>

      {/* Öffnungszeiten (strukturiert) */}
      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>Öffnungszeiten</SectionLabel>
        <View style={{ gap: 10 }}>
          {s.hoursWeek.map((h, i) => (
            <View key={h.day} style={ps.hoursRow}>
              <Text style={ps.hoursDay}>{h.day.slice(0, 2)}</Text>
              {h.closed ? (
                <Text style={ps.closedLabel}>Geschlossen</Text>
              ) : (
                <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                  <Input value={h.open} onChangeText={(v) => setHour(i, 'open', v)} style={{ flex: 1, paddingVertical: 8 }} />
                  <Input value={h.close} onChangeText={(v) => setHour(i, 'close', v)} style={{ flex: 1, paddingVertical: 8 }} />
                </View>
              )}
              <RNSwitch value={!h.closed} onValueChange={() => toggleClosed(i)} trackColor={{ true: C.teal500, false: C.line }} thumbColor="#fff" />
            </View>
          ))}
        </View>
      </Card>

      {/* Leistungen & Tierarten */}
      <Card>
        <SectionLabel style={{ marginBottom: 4 }}>Leistungen & Tierarten</SectionLabel>
        {serviceRows.map(([k, label], i) => (
          <TouchableOpacity key={k} style={[ps.toggleRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line2 }]}
            onPress={() => s.setServices((x) => ({ ...x, [k]: !x[k] }))} activeOpacity={0.7}>
            <Text style={ps.toggleName}>{label}</Text>
            <RNSwitch value={!!s.services[k]} onValueChange={(v) => s.setServices((x) => ({ ...x, [k]: v }))} trackColor={{ true: C.teal500, false: C.line }} thumbColor="#fff" />
          </TouchableOpacity>
        ))}
      </Card>

      {/* Spezialgebiete */}
      <Card>
        <SectionLabel>Spezialgebiete & Zusatzleistungen</SectionLabel>
        <Meta style={{ marginBottom: 10 }}>Mehrfachauswahl möglich — erscheinen auf Ihrer Praxis-Karte und sind filterbar.</Meta>
        <ChoiceGrid options={SPECIALTIES} value={selectedSpecs} multi
          onChange={(list) => s.setSpecialties(Object.fromEntries(SPECIALTIES.map((sp) => [sp.key, list.includes(sp.key)])))} />
        <Input style={{ marginTop: 10 }} value={s.specialtiesOther} onChangeText={s.setSpecialtiesOther} placeholder="Sonstige / weitere Spezialgebiete" />
      </Card>

      {/* Verifizierung */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <SectionLabel>Verifizierung</SectionLabel>
          <VerifyBadge status={s.verification} />
        </View>
        <P>
          {s.verification === 'verified'
            ? 'Ihre Praxis wurde von VetNow geprüft und als verifiziert markiert. Verifizierte Praxen werden in der Suche hervorgehoben.'
            : s.verification === 'pending'
              ? 'Ihre Verifizierung wird derzeit geprüft. Das dauert in der Regel 1–2 Werktage.'
              : 'Lassen Sie Ihre Praxis verifizieren, um Vertrauen zu schaffen und in der Suche hervorgehoben zu werden.'}
        </P>
        {s.verification !== 'verified' ? (
          <Btn
            label={s.verification === 'pending' ? 'Verifizierung läuft …' : 'Verifizierung anfragen'}
            variant="secondary" block style={{ marginTop: 12 }}
            disabled={s.verification === 'pending'}
            onPress={() => { s.setVerification('pending'); toast('Verifizierung angefragt.', 'success'); }}
          />
        ) : null}
      </Card>

      {/* Team */}
      <Card>
        <SectionLabel style={{ marginBottom: 10 }}>Team / Ärzt:innen</SectionLabel>
        <View style={{ gap: 8 }}>
          {s.team.map((t, i) => (
            <View key={i} style={ps.teamItem}>
              <View style={ps.teamAv}>
                <Text style={ps.teamAvText}>{t.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={ps.teamName}>{t.name}</Text>
                <Meta style={{ marginTop: 0 }}>{t.role}{t.specialty ? ' · ' + t.specialty : ''}</Meta>
              </View>
              <TouchableOpacity onPress={() => s.setTeam((x) => x.filter((_, j) => j !== i))} hitSlop={8}>
                <VNIcon.x s={16} c={C.ink3} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <View style={{ gap: 8, marginTop: 12 }}>
          <Input value={tName} onChangeText={setTName} placeholder="Name (z. B. Dr. Anna Drautal)" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input value={tRole} onChangeText={setTRole} placeholder="Rolle" style={{ flex: 1 }} />
            <Input value={tSpec} onChangeText={setTSpec} placeholder="Spezialgebiet" style={{ flex: 1 }} />
          </View>
          <Btn label="Mitglied hinzufügen" icon="plus" variant="secondary" block onPress={addMember} />
        </View>
      </Card>

      {/* Benachrichtigungen */}
      <Card>
        <SectionLabel>Benachrichtigungen</SectionLabel>
        <Meta style={{ marginBottom: 6 }}>Wo möchten Sie über Nachrichten, Anfragen und Status erinnert werden?</Meta>
        {notifRows.map(([k, title, sub, icon], i) => {
          const I = VNIcon[icon];
          return (
            <TouchableOpacity key={k} style={[ps.notifRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line2 }]}
              onPress={() => s.setNotifs((n) => ({ ...n, [k]: !n[k] }))} activeOpacity={0.7}>
              <View style={ps.notifIc}><I s={17} c={C.teal700} /></View>
              <View style={{ flex: 1 }}>
                <Text style={ps.toggleName}>{title}</Text>
                <Meta style={{ marginTop: 1 }}>{sub}</Meta>
              </View>
              <RNSwitch value={!!s.notifs[k]} onValueChange={(v) => s.setNotifs((n) => ({ ...n, [k]: v }))} trackColor={{ true: C.teal500, false: C.line }} thumbColor="#fff" />
            </TouchableOpacity>
          );
        })}
      </Card>

      <Btn label="Änderungen speichern" size="lg" block onPress={() => toast('Profil gespeichert.', 'success')} />
    </View>
  );
}

const ps = StyleSheet.create({
  verify: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 9, borderRadius: R.pill },
  verifyText: { fontSize: 11.5, fontWeight: '700' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hoursDay: { width: 26, fontSize: 13.5, fontWeight: '700', color: C.ink2 },
  closedLabel: { flex: 1, fontSize: 13.5, color: C.ink3, fontStyle: 'italic' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  toggleName: { fontSize: 14, color: C.ink, fontWeight: '600' },
  teamItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, borderRadius: R.md, padding: 10 },
  teamAv: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.teal100, alignItems: 'center', justifyContent: 'center' },
  teamAvText: { fontSize: 12.5, fontWeight: '800', color: C.teal900 },
  teamName: { fontSize: 14, fontWeight: '700', color: C.ink },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  notifIc: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.teal50, alignItems: 'center', justifyContent: 'center' },
});
