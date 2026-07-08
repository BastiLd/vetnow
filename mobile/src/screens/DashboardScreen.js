/* Praxis-Dashboard mit Tabs: Status / Nachrichten / Termine / Profil —
   vollständige Portierung von screens-e.jsx (StatusPanel inkl. Abwesenheiten
   & Ablauf-Erinnerung, Chat, voller Kalender, volles Profil). */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { C, S, R, STATUS_COLOR } from '../theme';
import { Card, SectionLabel, StatusBadge, Notice, Btn, Field, Input, ChoiceGrid, SwitchRow, H2, P, Meta, KV, toast } from '../components';
import { VNIcon } from '../icons';
import { ANIMAL_LABEL } from '../data';
import CalendarTab from './CalendarTab';
import ProfileTab, { VerifyBadge } from './ProfileTab';
import { Glyph } from './ChatsScreen';
import { useAppState } from '../lib/AdminContext';
import { useChats } from '../lib/ChatContext';

function ChatDisclaimer() {
  return <Notice type="warn">Keine medizinische Beratung. Bei akuten Notfällen bitte immer zusätzlich telefonisch Kontakt aufnehmen.</Notice>;
}

/* Praxis-Posteingang: Chats mit role 'clinic' */
function ClinicChatList({ chats, labels, navigation }) {
  if (chats.length === 0) return <Card style={{ alignItems: 'center' }}><P>Keine Anfragen im Posteingang.</P></Card>;
  return (
    <Card pad={false}>
      {chats.map((c, i) => {
        const last = c.messages[c.messages.length - 1];
        const lastText = last ? (last.type === 'note' ? 'Abschlussnotiz' : last.type === 'image' ? '📷 Bild' : last.text) : 'Noch keine Nachricht';
        return (
          <TouchableOpacity key={c.id} activeOpacity={0.7} onPress={() => navigation.navigate('ChatThread', { chatId: c.id, quickReplies: ['Gerne, kommen Sie vorbei.', 'Bitte kurz anrufen.', 'Wir melden uns gleich.'] })}
            style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.line2 }]}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.color + '22', alignItems: 'center', justifyContent: 'center' }}><Glyph name={c.icon} s={20} c={c.color} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.ink }} numberOfLines={1}>{c.title}</Text>
              <Text style={{ fontSize: 12.5, color: C.ink3, marginTop: 2 }} numberOfLines={1}>{lastText}</Text>
            </View>
            {c.unread > 0 ? <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.teal600, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}><Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '800' }}>{c.unread}</Text></View> : null}
          </TouchableOpacity>
        );
      })}
    </Card>
  );
}

const pad2 = (n) => String(n).padStart(2, '0');

/* ---- Status-Tab (Portierung von StatusPanel) ---- */
function StatusTab({ s, practices }) {
  const statuses = [
    { key: 'green', title: 'Heute erreichbar / nehme Notfälle an', sub: 'Wird als grün angezeigt' },
    { key: 'yellow', title: 'Nur nach telefonischer Rücksprache', sub: 'Wird als gelb angezeigt' },
    { key: 'red', title: 'Heute nicht verfügbar', sub: 'Wird als rot angezeigt' },
  ];
  const soon = s.active && s.remaining < 2 * 3600 * 1000;
  const ab = s.absence;
  const setAb = (k, v) => s.setAbsence({ ...ab, [k]: v });
  const others = practices.filter((p) => p.id !== s.me.id);

  return (
    <View style={{ gap: S.s4 }}>
      {soon ? (
        <View style={ds.reminder}>
          <VNIcon.alert s={20} c="#fff" />
          <Text style={ds.reminderText}>
            <Text style={{ fontWeight: '800' }}>Status läuft bald ab</Text> — in {pad2(s.hh)}:{pad2(s.mm)}:{pad2(s.ss)} werden Sie automatisch grau markiert.
          </Text>
          <TouchableOpacity style={ds.reminderBtn} onPress={() => { s.setExpiry(Date.now() + s.DURATION); toast('Status um 24 Stunden verlängert.', 'success'); }}>
            <Text style={{ color: C.yellowInk, fontWeight: '700', fontSize: 12.5 }}>Verlängern</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>Heutiger Status</SectionLabel>
        <View style={{ gap: 8 }}>
          {statuses.map((stt) => {
            const on = s.picked === stt.key;
            return (
              <TouchableOpacity key={stt.key} activeOpacity={0.7}
                style={[ds.statusBtn, on && { borderColor: STATUS_COLOR[stt.key].dot, backgroundColor: STATUS_COLOR[stt.key].bg }]}
                onPress={() => { s.setPicked(stt.key); s.setExpiry(Date.now() + s.DURATION); toast('Status aktualisiert.', 'success'); }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: STATUS_COLOR[stt.key].dot }} />
                <View style={{ flex: 1 }}>
                  <Text style={ds.statusTitle}>{stt.title}</Text>
                  <Meta>{stt.sub}</Meta>
                </View>
                {on ? <VNIcon.check s={18} c={STATUS_COLOR[stt.key].ink} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      <Card>
        <View style={[ds.countdown, !s.active && { backgroundColor: C.greyBg }]}>
          <View>
            <Meta style={{ color: s.active ? 'rgba(255,255,255,0.8)' : C.greyInk, marginTop: 0 }}>{s.active ? 'Status läuft ab in' : 'Status abgelaufen'}</Meta>
            <Text style={[ds.cdTime, !s.active && { color: C.greyInk }]}>{s.active ? `${pad2(s.hh)}:${pad2(s.mm)}:${pad2(s.ss)}` : '00:00:00'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Meta style={{ color: s.active ? 'rgba(255,255,255,0.8)' : C.greyInk, marginTop: 0 }}>Ablauf</Meta>
            <Text style={{ color: s.active ? '#fff' : C.greyInk, fontWeight: '700', fontSize: 13 }}>{s.active ? s.expiryStr : '—'}</Text>
          </View>
        </View>
        <Btn label="Status für 24 Stunden bestätigen" icon="refresh" size="lg" block style={{ marginTop: 12 }}
          onPress={() => { s.setExpiry(Date.now() + s.DURATION); toast('Status für 24 Stunden bestätigt.', 'success'); }} />
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line2 }}>
          <SectionLabel style={{ marginBottom: 8, color: C.ink3 }}>Nur zum Ausprobieren</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn label="Kurz vor Ablauf" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => s.setExpiry(Date.now() + 90 * 60 * 1000)} />
            <Btn label="Abgelaufen" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => s.setExpiry(Date.now() - 1000)} />
          </View>
        </View>
        {!s.active ? (
          <Notice type="grey" style={{ marginTop: 12 }}>Status nicht aktuell bestätigt — Sie erscheinen für Tierhalter:innen grau.</Notice>
        ) : null}
        <Notice type="info" style={{ marginTop: 12 }}>
          Erinnerungen zur Bestätigung erhalten Sie nur <Text style={{ fontWeight: '700' }}>während Ihrer Öffnungszeiten</Text> — nicht an geschlossenen Tagen, nachts oder während einer Abwesenheit.
        </Notice>
      </Card>

      {/* Abwesenheiten */}
      <Card>
        <SectionLabel style={{ marginBottom: 4 }}>Abwesenheiten</SectionLabel>
        <Meta style={{ marginBottom: 10 }}>Urlaub oder Schließzeiten — im Zeitraum erscheinen Sie automatisch als „nicht erreichbar“, mit Hinweis auf die Vertretung.</Meta>
        <SwitchRow plain title="Abwesenheit aktiv" sub="Zeigt Ihre Praxis als „Heute nicht verfügbar“." on={ab.active} onToggle={(v) => setAb('active', v)} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <Field label="Von" style={{ flex: 1 }}><Input placeholder="TT.MM.JJJJ" value={ab.from} onChangeText={(v) => setAb('from', v)} /></Field>
          <Field label="Bis" style={{ flex: 1 }}><Input placeholder="TT.MM.JJJJ" value={ab.to} onChangeText={(v) => setAb('to', v)} /></Field>
        </View>
        <Field label="Vertretungspraxis" style={{ marginTop: 12 }}>
          <ChoiceGrid options={[{ key: '', label: 'Keine / selbst organisiert' }, ...others.map((p) => ({ key: p.name, label: p.name }))]}
            value={ab.vertretung} onChange={(v) => setAb('vertretung', v || '')} cols={1} />
        </Field>
        <Btn label="Abwesenheit speichern" variant="secondary" block style={{ marginTop: 12 }}
          onPress={() => toast(ab.active ? 'Abwesenheit gespeichert.' : 'Abwesenheit deaktiviert.', 'success')} />
      </Card>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { data: D } = useAppState();
  const { visibleChats, labels } = useChats();
  const me = D.PRACTICES[0];
  const DURATION = 24 * 3600 * 1000;

  const [tab, setTab] = React.useState('status');
  const [picked, setPicked] = React.useState('green');
  const [expiry, setExpiry] = React.useState(() => Date.now() + DURATION);
  const [now, setNow] = React.useState(Date.now());
  const [note, setNote] = React.useState(me ? me.emergency : '');
  const [services, setServices] = React.useState({ emergency: true, regular: true, euthanasia: false, housecall: true, cat: true, dog: true, small: true });
  const [specialties, setSpecialties] = React.useState(() => Object.fromEntries(((me && me.specialties) || []).map((k) => [k, true])));
  const [specialtiesOther, setSpecialtiesOther] = React.useState('');
  const [absence, setAbsence] = React.useState({ active: false, from: '', to: '', vertretung: '' });
  const [district, setDistrict] = React.useState(me ? me.district.split(' ')[0] : null);
  const cp = D.CLINIC_PROFILE;
  const [about, setAbout] = React.useState(cp.about);
  const [verification, setVerification] = React.useState(cp.verification);
  const [hoursWeek, setHoursWeek] = React.useState(cp.hoursWeek.map((h) => ({ ...h })));
  const [team, setTeam] = React.useState(cp.team.map((t) => ({ ...t })));
  const [notifs, setNotifs] = React.useState({ ...cp.notifications });

  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  if (!me) {
    return (
      <View style={{ flex: 1, backgroundColor: C.surface2, padding: S.s5 }}>
        <Card style={{ alignItems: 'center' }}>
          <H2>Keine Praxis vorhanden</H2>
          <P style={{ marginTop: 6, textAlign: 'center' }}>Die Demo-Praxis ist ausgeblendet (Testdaten sind deaktiviert).</P>
          <Btn label="Zur Startseite" variant="secondary" size="sm" style={{ marginTop: 12 }} onPress={() => navigation.navigate('StartTab')} />
        </Card>
      </View>
    );
  }

  const active = expiry && now < expiry;
  const remaining = Math.max(0, expiry - now);
  const s = {
    me, DURATION, picked, setPicked, expiry, setExpiry, active, remaining,
    hh: Math.floor(remaining / 3600000), mm: Math.floor((remaining % 3600000) / 60000), ss: Math.floor((remaining % 60000) / 1000),
    expiryStr: new Date(expiry).toLocaleString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    note, setNote, services, setServices, specialties, setSpecialties, specialtiesOther, setSpecialtiesOther,
    absence, setAbsence, about, setAbout, verification, setVerification, hoursWeek, setHoursWeek, team, setTeam, notifs, setNotifs,
    district, setDistrict,
  };
  const liveStatus = absence.active ? 'red' : active ? picked : 'grey';
  const unread = clinicChats.reduce((n, c) => n + (c.unread || 0), 0);

  const tabs = [
    { key: 'status', label: 'Status', icon: 'siren' },
    { key: 'messages', label: 'Chats', icon: 'chat', pill: unread },
    { key: 'appts', label: 'Termine', icon: 'cal' },
    { key: 'profile', label: 'Profil', icon: 'building' },
  ];

  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5, gap: S.s4, paddingBottom: S.s8 }} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Meta style={{ marginTop: 0 }}>Praxis-Dashboard</Meta>
            <H2 style={{ marginTop: 2 }}>{me.name}</H2>
            <KV icon="pin" style={{ marginTop: 6 }}>{me.address}</KV>
            <View style={{ marginTop: 8 }}><VerifyBadge status={verification} /></View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Meta style={{ marginTop: 0 }}>Aktuell sichtbar als</Meta>
            <StatusBadge status={liveStatus} />
          </View>
        </View>
        {absence.active ? (
          <Notice type="warn" style={{ marginTop: 12 }}>
            Abwesenheit aktiv{absence.from ? ` (${absence.from} – ${absence.to})` : ''} — Sie erscheinen als <Text style={{ fontWeight: '700' }}>„Heute nicht verfügbar“</Text>{absence.vertretung ? <Text>. Vertretung: <Text style={{ fontWeight: '700' }}>{absence.vertretung}</Text></Text> : null}.
          </Notice>
        ) : null}
      </Card>

      <View style={ds.tabbar}>
        {tabs.map((t) => {
          const I = VNIcon[t.icon];
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={[ds.tab, on && ds.tabOn]} onPress={() => setTab(t.key)}>
              <View>
                <I s={16} c={on ? C.teal700 : C.ink3} />
                {t.pill > 0 ? <View style={ds.pill}><Text style={ds.pillText}>{t.pill}</Text></View> : null}
              </View>
              <Text style={[ds.tabText, on && { color: C.teal700, fontWeight: '700' }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'status' ? <StatusTab s={s} practices={D.PRACTICES} /> : null}
      {tab === 'messages' ? (
        <View style={{ gap: S.s4 }}>
          <ChatDisclaimer />
          <ClinicChatList chats={clinicChats} labels={labels} navigation={navigation} />
          <Btn label="Alle Chats öffnen" icon="chat" variant="secondary" block onPress={() => navigation.navigate('NachrichtenTab')} />
        </View>
      ) : null}
      {tab === 'appts' ? <CalendarTab /> : null}
      {tab === 'profile' ? <ProfileTab s={s} /> : null}
    </ScrollView>
  );
}

const ds = StyleSheet.create({
  tabbar: { flexDirection: 'row', backgroundColor: C.surface3, borderRadius: R.pill, padding: 4, gap: 2 },
  tab: { flex: 1, flexDirection: 'row', gap: 5, paddingVertical: 9, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: C.surface, shadowColor: C.ink, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { fontSize: 12, color: C.ink2, fontWeight: '600' },
  pill: { position: 'absolute', top: -6, right: -8, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: C.teal600, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  pillText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: C.line, borderRadius: R.md, padding: 13 },
  statusTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  countdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.teal700, borderRadius: R.md, padding: 14 },
  cdTime: { color: '#fff', fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.yellow, borderRadius: R.md, padding: 12 },
  reminderText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#fff' },
  reminderBtn: { backgroundColor: '#fff', borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 12 },
});
