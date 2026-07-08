/* Praxis-Dashboard mit Tabs: Status / Nachrichten / Termine / Profil.
   Vereinfachungen ggü. Web: Termine als Tagesliste (kein Monats-/Wochenkalender),
   Profil ohne Team-/Verifizierungs-/Benachrichtigungs-Verwaltung. */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { C, S, R, STATUS_COLOR } from '../theme';
import { Card, SectionLabel, StatusBadge, Notice, Btn, Field, Input, SwitchRow, H2, H3, P, Meta, ANIMAL_EMOJI } from '../components';
import ChatView, { ChatDisclaimer } from '../Chat';
import { APPT_STATUS, ANIMAL_LABEL, MONTHS_DE, blocksFor } from '../data';
import { useAppState } from '../lib/AdminContext';

const pad2 = (n) => String(n).padStart(2, '0');
const parseISO = (iso) => new Date(iso + 'T00:00:00');
const ymd = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return ymd(d); };
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function StatusTab({ me }) {
  const DURATION = 24 * 3600 * 1000;
  const [picked, setPicked] = React.useState('green');
  const [expiry, setExpiry] = React.useState(() => Date.now() + DURATION);
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const active = expiry && now < expiry;
  const remaining = Math.max(0, expiry - now);
  const hh = Math.floor(remaining / 3600000), mm = Math.floor((remaining % 3600000) / 60000), ss = Math.floor((remaining % 60000) / 1000);
  const liveStatus = active ? picked : 'grey';

  const statuses = [
    { key: 'green', title: 'Heute erreichbar / nehme Notfälle an', sub: 'Wird als grün angezeigt' },
    { key: 'yellow', title: 'Nur nach telefonischer Rücksprache', sub: 'Wird als gelb angezeigt' },
    { key: 'red', title: 'Heute nicht verfügbar', sub: 'Wird als rot angezeigt' },
  ];

  return (
    <View style={{ gap: S.s4 }}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Meta>Aktuell sichtbar als</Meta>
          <StatusBadge status={liveStatus} />
        </View>
        {!active ? (
          <Notice type="grey" style={{ marginTop: 12 }}>Status abgelaufen — bestätigen Sie Ihren Status, um wieder farbig zu erscheinen.</Notice>
        ) : null}
      </Card>

      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>Heutiger Status</SectionLabel>
        <View style={{ gap: 8 }}>
          {statuses.map((s) => {
            const on = picked === s.key;
            return (
              <TouchableOpacity key={s.key} activeOpacity={0.7}
                style={[st.statusBtn, on && { borderColor: STATUS_COLOR[s.key].dot, backgroundColor: STATUS_COLOR[s.key].bg }]}
                onPress={() => { setPicked(s.key); setExpiry(Date.now() + DURATION); }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: STATUS_COLOR[s.key].dot }} />
                <View style={{ flex: 1 }}>
                  <Text style={st.statusTitle}>{s.title}</Text>
                  <Meta>{s.sub}</Meta>
                </View>
                {on ? <Text style={{ color: STATUS_COLOR[s.key].ink, fontWeight: '800' }}>✓</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      <Card>
        <View style={[st.countdown, !active && { backgroundColor: C.greyBg }]}>
          <View>
            <Meta style={{ color: active ? 'rgba(255,255,255,0.8)' : C.greyInk }}>{active ? 'Status läuft ab in' : 'Status abgelaufen'}</Meta>
            <Text style={[st.cdTime, !active && { color: C.greyInk }]}>{active ? `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}` : '00:00:00'}</Text>
          </View>
        </View>
        <Btn label="🔄 Status für 24 Stunden bestätigen" size="lg" block style={{ marginTop: 12 }} onPress={() => setExpiry(Date.now() + DURATION)} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Btn label="Kurz vor Ablauf" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => setExpiry(Date.now() + 90 * 60 * 1000)} />
          <Btn label="Abgelaufen" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => setExpiry(Date.now() - 1000)} />
        </View>
        <Notice type="info" style={{ marginTop: 12 }}>Erinnerungen zur Bestätigung erhalten Sie nur während Ihrer Öffnungszeiten — nicht nachts oder während einer Abwesenheit.</Notice>
      </Card>
    </View>
  );
}

function ApptsTab({ D }) {
  const [dayIso, setDayIso] = React.useState(D.TODAY_ISO);
  const [appts, setAppts] = React.useState(() => {
    const m = {}; Object.entries(D.APPTS_BY_DATE).forEach(([k, v]) => { m[k] = v.map((a) => ({ ...a })); }); return m;
  });
  React.useEffect(() => {
    setAppts(() => { const m = {}; Object.entries(D.APPTS_BY_DATE).forEach(([k, v]) => { m[k] = v.map((a) => ({ ...a })); }); return m; });
  }, [D]);

  const dayList = appts[dayIso] || [];
  const d = parseISO(dayIso);
  const rel = dayIso === D.TODAY_ISO ? 'Heute · ' : '';
  const dayLabel = rel + WD[d.getDay()] + ', ' + pad2(d.getDate()) + '. ' + MONTHS_DE[d.getMonth()];
  const blocks = blocksFor(dayIso);
  const timeline = [...dayList.map((a, i) => ({ ...a, _idx: i })), ...blocks.map((b) => ({ ...b, block: true }))]
    .sort((x, y) => (x.time < y.time ? -1 : 1));

  const setStatus = (idx, status) => setAppts((m) => ({ ...m, [dayIso]: m[dayIso].map((a, i) => (i === idx ? { ...a, status } : a)) }));

  const openActions = (a) => {
    Alert.alert(a.time + ' · ' + a.name, a.reason + ' (' + (ANIMAL_LABEL[a.animal] || a.animal) + ')', [
      { text: 'Bestätigen', onPress: () => setStatus(a._idx, 'confirmed') },
      { text: 'Abschließen', onPress: () => setStatus(a._idx, 'done') },
      { text: 'Absagen', style: 'destructive', onPress: () => setStatus(a._idx, 'cancelled') },
      { text: 'Schließen', style: 'cancel' },
    ]);
  };

  return (
    <View style={{ gap: S.s4 }}>
      <Notice type="warn">Keine medizinische Beratung. Bei akuten Notfällen bitte immer telefonisch Kontakt aufnehmen.</Notice>
      <View style={st.dayNav}>
        <TouchableOpacity style={st.dayBtn} onPress={() => setDayIso((x) => addDays(x, -1))}><Text style={st.dayBtnText}>‹</Text></TouchableOpacity>
        <Text style={st.dayLabel}>{dayLabel}</Text>
        <TouchableOpacity style={st.dayBtn} onPress={() => setDayIso((x) => addDays(x, 1))}><Text style={st.dayBtnText}>›</Text></TouchableOpacity>
      </View>
      {dayIso !== D.TODAY_ISO ? <Btn label="Heute" variant="secondary" size="sm" onPress={() => setDayIso(D.TODAY_ISO)} /> : null}

      {timeline.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Text style={{ fontSize: 26 }}>📅</Text>
          <P style={{ marginTop: 6 }}>Für diesen Tag sind keine Termine eingetragen.</P>
        </Card>
      ) : (
        <View style={{ gap: 8 }}>
          {timeline.map((item, i) =>
            item.block ? (
              <View key={'b' + i} style={st.blockBar}>
                <Text style={st.blockTime}>{item.time}</Text>
                <Text style={st.blockLabel}>🕐 {item.label} ({item.time}–{item.end})</Text>
              </View>
            ) : (
              <TouchableOpacity key={i} activeOpacity={0.7} onPress={() => openActions(item)}>
                <Card style={{ padding: 12 }} pad={false}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={st.apptTime}>{item.time}</Text>
                    <Text style={{ fontSize: 18 }}>{ANIMAL_EMOJI[item.animal] || '🐾'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={st.apptName}>{item.name}</Text>
                      <Meta>{item.reason}</Meta>
                    </View>
                    <View style={[st.apptTag, { backgroundColor: STATUS_COLOR[APPT_STATUS[item.status].cls]?.bg || C.surface3 }]}>
                      <Text style={[st.apptTagText, { color: STATUS_COLOR[APPT_STATUS[item.status].cls]?.ink || C.ink2 }]}>{APPT_STATUS[item.status].label}</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            )
          )}
        </View>
      )}
    </View>
  );
}

function ProfileTab({ me, D }) {
  const cp = D.CLINIC_PROFILE;
  const [about, setAbout] = React.useState(cp.about);
  const [note, setNote] = React.useState(me.emergency);
  const [services, setServices] = React.useState({ emergency: true, regular: true, euthanasia: false, housecall: true, cat: true, dog: true, small: true });
  const rows = [['emergency', 'Notfälle'], ['regular', 'Normale Termine'], ['euthanasia', 'Einschläferung'], ['housecall', 'Hausbesuche'], ['cat', 'Katzen'], ['dog', 'Hunde'], ['small', 'Kleintiere']];
  return (
    <View style={{ gap: S.s4 }}>
      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>Praxisdaten</SectionLabel>
        <View style={{ gap: 12 }}>
          <Field label="Praxisname"><Input defaultValue={me.name} /></Field>
          <Field label="Adresse"><Input defaultValue={me.address} /></Field>
          <Field label="Über uns"><Input value={about} onChangeText={setAbout} multiline /></Field>
          <Field label="Notfallhinweis"><Input value={note} onChangeText={setNote} multiline /></Field>
        </View>
      </Card>
      <Card>
        <SectionLabel style={{ marginBottom: 8 }}>Leistungen & Tierarten</SectionLabel>
        {rows.map(([k, label]) => (
          <View key={k} style={{ marginTop: 8 }}>
            <SwitchRow title={label} on={services[k]} onToggle={(v) => setServices((s) => ({ ...s, [k]: v }))} />
          </View>
        ))}
      </Card>
      <Btn label="Änderungen speichern" size="lg" block onPress={() => Alert.alert('Gespeichert', 'Profil gespeichert (Demo).')} />
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { data: D } = useAppState();
  const me = D.PRACTICES[0];
  const [tab, setTab] = React.useState('status');

  if (!me) {
    return (
      <View style={{ flex: 1, backgroundColor: C.surface2, padding: S.s5 }}>
        <Card style={{ alignItems: 'center' }}>
          <H2>Keine Praxis vorhanden</H2>
          <P style={{ marginTop: 6, textAlign: 'center' }}>Die Demo-Praxis ist ausgeblendet (Testdaten sind deaktiviert).</P>
          <Btn label="Zur Startseite" variant="secondary" size="sm" style={{ marginTop: 12 }} onPress={() => navigation.navigate('Home')} />
        </Card>
      </View>
    );
  }

  const unread = D.CONVERSATIONS.reduce((n, c) => n + c.unread, 0);
  const clinicConvos = D.CONVERSATIONS.map((c) => ({ id: c.id, title: c.owner, sub: ANIMAL_LABEL[c.animal], animal: c.animal, date: c.date, unread: c.unread, messages: c.messages }));

  const tabs = [
    { key: 'status', label: 'Status' },
    { key: 'messages', label: `Nachrichten${unread ? ` (${unread})` : ''}` },
    { key: 'appts', label: 'Termine' },
    { key: 'profile', label: 'Profil' },
  ];

  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5, gap: S.s4, paddingBottom: S.s8 }}>
      <Card>
        <Meta>Praxis-Dashboard</Meta>
        <H2 style={{ marginTop: 2 }}>{me.name}</H2>
        <Meta style={{ marginTop: 6 }}>📍 {me.address}</Meta>
      </Card>

      <View style={st.tabbar}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.key} style={[st.tab, tab === t.key && st.tabOn]} onPress={() => setTab(t.key)}>
            <Text style={[st.tabText, tab === t.key && { color: C.teal700, fontWeight: '700' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'status' && <StatusTab me={me} />}
      {tab === 'messages' && (
        <View style={{ gap: S.s4 }}>
          <ChatDisclaimer />
          <ChatView convos={clinicConvos} me="clinic" quickReplies={['Gerne, kommen Sie vorbei.', 'Bitte kurz anrufen.', 'Wir melden uns gleich.']} />
        </View>
      )}
      {tab === 'appts' && <ApptsTab D={D} />}
      {tab === 'profile' && <ProfileTab me={me} D={D} />}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  tabbar: { flexDirection: 'row', backgroundColor: C.surface3, borderRadius: R.pill, padding: 4, gap: 2 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: R.pill, alignItems: 'center' },
  tabOn: { backgroundColor: C.surface, shadowColor: C.ink, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { fontSize: 12, color: C.ink2, fontWeight: '600' },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: C.line, borderRadius: R.md, padding: 13 },
  statusTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  countdown: { backgroundColor: C.teal700, borderRadius: R.md, padding: 14 },
  cdTime: { color: '#fff', fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  dayBtnText: { fontSize: 20, color: C.ink2, fontWeight: '600' },
  dayLabel: { fontSize: 15, fontWeight: '700', color: C.ink },
  blockBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.greyBg, borderRadius: R.md, padding: 10 },
  blockTime: { fontSize: 13, fontWeight: '700', color: C.greyInk },
  blockLabel: { fontSize: 13, color: C.greyInk },
  apptTime: { fontSize: 13.5, fontWeight: '800', color: C.teal700, width: 44 },
  apptName: { fontSize: 14, fontWeight: '700', color: C.ink },
  apptTag: { borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 9 },
  apptTagText: { fontSize: 11.5, fontWeight: '700' },
});
