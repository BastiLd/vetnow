/* Praxis-Detail: Status, Notfallhinweis, Öffnungszeiten, Tierarten/Leistungen, Aktionen */
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { C, S } from '../theme';
import { Card, SectionLabel, StatusBadge, Tag, TagRow, Notice, Btn, ConfirmLine, H1, P, Meta, ANIMAL_EMOJI, SERVICE_EMOJI } from '../components';
import { ANIMAL_LABEL, SERVICE_LABEL, SPECIALTY_LABEL } from '../data';
import { useAppState } from '../lib/AdminContext';
import { callPractice } from './ResultsScreen';

const DAYS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];

export default function DetailScreen({ route, navigation }) {
  const { data } = useAppState();
  const p = data.PRACTICES.find((x) => x.id === route.params?.practiceId) || data.PRACTICES[0];
  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: C.surface2, padding: S.s5 }}>
        <Card style={{ alignItems: 'center' }}>
          <P>Diese Praxis ist nicht (mehr) verfügbar.</P>
          <Btn label="Zur Suche" variant="secondary" size="sm" style={{ marginTop: 10 }} onPress={() => navigation.navigate('Search')} />
        </Card>
      </View>
    );
  }
  const grey = p.status === 'grey';
  const noticeType = grey ? 'grey' : p.status === 'red' ? 'danger' : p.status === 'yellow' ? 'warn' : 'info';
  const todayIdx = 2; // Mittwoch (Demo-"heute", passend zum Kalender 04.06.)

  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5, gap: S.s4, paddingBottom: S.s8 }}>
      <View>
        <H1>{p.name}</H1>
        <Meta style={{ marginTop: 8 }}>📍 {p.district} · {p.address}</Meta>
        <View style={{ marginTop: 12 }}><StatusBadge status={p.status} size="lg" /></View>
        <View style={{ marginTop: 8 }}><ConfirmLine practice={p} /></View>
      </View>

      <Notice type={noticeType}><Text style={{ fontWeight: '700' }}>Notfallhinweis. </Text>{p.emergencyLong}</Notice>

      {p.absent ? (
        <Notice type="warn"><Text style={{ fontWeight: '700' }}>Derzeit abwesend</Text> ({p.absenceRange}). Bitte wenden Sie sich an die Vertretung: <Text style={{ fontWeight: '700' }}>{p.vertretung}</Text>.</Notice>
      ) : null}

      <Card>
        <SectionLabel style={{ marginBottom: 10 }}>Öffnungszeiten</SectionLabel>
        {DAYS.map((d, i) => (
          <View key={d} style={[st.hoursRow, i === todayIdx && st.hoursToday]}>
            <Text style={[st.hoursDay, i === todayIdx && { fontWeight: '700', color: C.teal700 }]}>{d}{i === todayIdx ? ' · heute' : ''}</Text>
            <Text style={[st.hoursVal, i === todayIdx && { fontWeight: '700', color: C.teal700 }]}>{p.hoursWeek[i]}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <SectionLabel style={{ marginBottom: 10 }}>Tierarten</SectionLabel>
        <TagRow>{p.animals.map((a) => <Tag key={a} emoji={ANIMAL_EMOJI[a]}>{ANIMAL_LABEL[a]}</Tag>)}</TagRow>
        <SectionLabel style={{ marginTop: 14, marginBottom: 10 }}>Leistungen</SectionLabel>
        <TagRow>{p.services.map((s) => <Tag key={s} emoji={SERVICE_EMOJI[s]} accent>{SERVICE_LABEL[s]}</Tag>)}</TagRow>
        {p.specialties && p.specialties.length > 0 ? (
          <>
            <SectionLabel style={{ marginTop: 14, marginBottom: 10 }}>Spezialgebiete & Zusatzleistungen</SectionLabel>
            <TagRow>{p.specialties.map((s) => <Tag key={s} emoji="➕">{SPECIALTY_LABEL[s] || s}</Tag>)}</TagRow>
          </>
        ) : null}
      </Card>

      <Card>
        <SectionLabel style={{ marginBottom: 10 }}>Adresse</SectionLabel>
        <Meta>📍 {p.address}</Meta>
      </Card>

      <Btn label="📞 Jetzt anrufen" size="lg" block onPress={() => callPractice(p)} />
      <Btn label="✉️ Anfrage senden" variant="secondary" block onPress={() => navigation.navigate('Request', { practiceId: p.id })} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line2 },
  hoursToday: { backgroundColor: C.teal50, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
  hoursDay: { fontSize: 14, color: C.ink2 },
  hoursVal: { fontSize: 14, color: C.ink },
});
