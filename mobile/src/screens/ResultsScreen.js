/* Ergebnisliste mit Filter-Chips, Ampel-Sortierung und Anruf/Details */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { C, S } from '../theme';
import { Card, StatusBadge, Tag, TagRow, Notice, Btn, ConfirmLine, H2, H3, P, Meta, ANIMAL_EMOJI, SERVICE_EMOJI } from '../components';
import { ANIMAL_LABEL, SERVICE_LABEL, SPECIALTY_LABEL, sortPractices } from '../data';
import { useAppState } from '../lib/AdminContext';

export function applyFilters(practices, filters) {
  const list = practices.filter((p) => {
    if (filters.animal && filters.animal !== 'other' && !p.animals.includes(filters.animal)) return false;
    if (filters.situation && !p.services.includes(filters.situation)) return false;
    if (filters.district && !p.district.startsWith(filters.district)) return false;
    if (filters.specialties && filters.specialties.length && !filters.specialties.some((s) => (p.specialties || []).includes(s))) return false;
    if (filters.onlyConfirmed && p.status === 'grey') return false;
    return true;
  });
  return sortPractices(list);
}

export function callPractice(p) {
  Linking.openURL('tel:' + p.phone.replace(/\s/g, '')).catch(() => {});
}

function ResultCard({ p, navigation }) {
  const grey = p.status === 'grey';
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <H3>{p.name}</H3>
          <Meta>📍 {p.district} · {p.address}</Meta>
        </View>
        <StatusBadge status={p.status} />
      </View>

      <View style={{ marginTop: 10 }}><ConfirmLine practice={p} /></View>

      {grey ? (
        <Notice type="grey" style={{ marginTop: 10 }}>Status nicht aktuell bestätigt — bitte unbedingt telefonisch prüfen.</Notice>
      ) : (
        <View style={{ marginTop: 10, gap: 4 }}>
          <Meta style={{ color: C.ink2 }}>🚨 {p.emergency}</Meta>
          <Meta>🕐 {p.hoursShort}</Meta>
        </View>
      )}

      {p.absent ? (
        <Notice type="warn" style={{ marginTop: 10 }}>Abwesend ({p.absenceRange}). <Text style={{ fontWeight: '700' }}>Vertretung: {p.vertretung}</Text></Notice>
      ) : null}

      <TagRow style={{ marginTop: 12 }}>
        {(p.specialties || []).map((s) => <Tag key={s} emoji="➕">{SPECIALTY_LABEL[s] || s}</Tag>)}
      </TagRow>
      <TagRow style={{ marginTop: 8 }}>
        {p.animals.map((a) => <Tag key={a} emoji={ANIMAL_EMOJI[a]}>{ANIMAL_LABEL[a]}</Tag>)}
        {p.services.map((s) => <Tag key={s} emoji={SERVICE_EMOJI[s]} accent>{SERVICE_LABEL[s]}</Tag>)}
      </TagRow>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <Btn label="📞 Anrufen" style={{ flex: 1 }} onPress={() => callPractice(p)} />
        <Btn label="Details" variant="secondary" style={{ flex: 1 }} onPress={() => navigation.navigate('Detail', { practiceId: p.id })} />
      </View>
    </Card>
  );
}

export default function ResultsScreen({ navigation }) {
  const { data, filters, setFilters } = useAppState();
  const list = applyFilters(data.PRACTICES, filters);
  const hiddenGrey = filters.onlyConfirmed ? (applyFilters(data.PRACTICES, { ...filters, onlyConfirmed: false }).length - list.length) : 0;

  const chips = [];
  if (filters.animal) chips.push(ANIMAL_LABEL[filters.animal]);
  if (filters.situation) chips.push(SERVICE_LABEL[filters.situation]);
  if (filters.district) chips.push(filters.district);
  (filters.specialties || []).forEach((s) => chips.push(SPECIALTY_LABEL[s]));
  if (filters.onlyConfirmed) chips.push('Nur bestätigte');

  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5, gap: S.s4, paddingBottom: S.s8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <H2>{list.length} {list.length === 1 ? 'Praxis' : 'Praxen'} gefunden</H2>
          <Meta>Grün zuerst · grau und rot zuletzt</Meta>
        </View>
        <Btn label="Filter ändern" variant="secondary" size="sm" onPress={() => navigation.navigate('Search')} />
      </View>

      {chips.length > 0 ? (
        <TagRow>{chips.map((c, i) => <Tag key={i} accent>{c}</Tag>)}</TagRow>
      ) : (
        <Meta>Keine Filter — alle Praxen</Meta>
      )}

      <Notice type="info">Angaben ohne Gewähr. Bitte bei Notfällen immer zuerst telefonisch bestätigen, ob die Praxis Sie aufnehmen kann.</Notice>

      {hiddenGrey > 0 ? (
        <TouchableOpacity onPress={() => setFilters({ ...filters, onlyConfirmed: false })}>
          <Notice type="grey">
            {hiddenGrey} {hiddenGrey === 1 ? 'Praxis mit unbestätigtem Status ist' : 'Praxen mit unbestätigtem Status sind'} ausgeblendet. <Text style={{ textDecorationLine: 'underline' }}>Trotzdem anzeigen</Text>
          </Notice>
        </TouchableOpacity>
      ) : null}

      {list.length === 0 ? (
        <Card style={{ alignItems: 'center' }}>
          <P>Keine Praxis entspricht Ihren Filtern.</P>
          <Btn label="Filter anpassen" variant="secondary" size="sm" style={{ marginTop: 10 }} onPress={() => navigation.navigate('Search')} />
        </Card>
      ) : (
        list.map((p) => <ResultCard key={p.id} p={p} navigation={navigation} />)
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({});
