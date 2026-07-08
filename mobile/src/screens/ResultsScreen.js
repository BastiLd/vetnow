/* Ergebnisliste mit Filter-Chips, Ampel-Sortierung, Anruf/Route/Details */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { C, S } from '../theme';
import { Card, StatusBadge, Tag, TagRow, Notice, Btn, ConfirmLine, KV, H2, H3, P, Meta, toast } from '../components';
import { ANIMAL_ICON, SERVICE_ICON } from '../icons';
import { ANIMAL_LABEL, SERVICE_LABEL, SPECIALTY_LABEL, sortPractices } from '../data';
import { useAppState } from '../lib/AdminContext';

export function applyFilters(practices, filters) {
  const animals = filters.animals || [];
  const situations = filters.situations || [];
  const districts = filters.districts || [];
  const list = practices.filter((p) => {
    if (animals.length && !animals.some((a) => a === 'other' || p.animals.includes(a))) return false;
    if (situations.length && !situations.some((s) => p.services.includes(s))) return false;
    if (districts.length && !districts.some((d) => p.district.startsWith(d))) return false;
    if (filters.specialties && filters.specialties.length && !filters.specialties.some((s) => (p.specialties || []).includes(s))) return false;
    if (filters.onlyConfirmed && p.status === 'grey') return false;
    if (filters.onlyGreen && p.status !== 'green') return false;
    if (filters.housecall && !p.services.includes('housecall')) return false;
    if (filters.is24h && !/24/.test(p.hoursShort || '')) return false;
    return true;
  });
  return sortPractices(list);
}

export function callPractice(p) {
  Linking.openURL('tel:' + p.phone.replace(/\s/g, '')).catch(() => toast('Anruf konnte nicht gestartet werden.', 'error'));
}

/* Route in der Karten-App öffnen (Apple Maps / Google Maps) */
export function openRoute(p) {
  const q = encodeURIComponent(p.address);
  const url = Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${q}` : `geo:0,0?q=${q}`;
  Linking.openURL(url).catch(() => toast('Karten-App konnte nicht geöffnet werden.', 'error'));
}

function ResultCard({ p, navigation }) {
  const grey = p.status === 'grey';
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <H3>{p.name}</H3>
          <KV icon="pin" style={{ marginTop: 4 }}>{p.district} · {p.address}</KV>
        </View>
        <StatusBadge status={p.status} />
      </View>

      <View style={{ marginTop: 10 }}><ConfirmLine practice={p} /></View>

      {grey ? (
        <Notice type="grey" style={{ marginTop: 10 }}>Status nicht aktuell bestätigt — bitte unbedingt telefonisch prüfen.</Notice>
      ) : (
        <View style={{ marginTop: 10, gap: 5 }}>
          <KV icon="siren" color={C.ink2}>{p.emergency}</KV>
          <KV icon="clock">{p.hoursShort}</KV>
        </View>
      )}

      {p.absent ? (
        <Notice type="warn" style={{ marginTop: 10 }}>Abwesend ({p.absenceRange}). <Text style={{ fontWeight: '700' }}>Vertretung: {p.vertretung}</Text></Notice>
      ) : null}

      {p.specialties && p.specialties.length > 0 ? (
        <TagRow style={{ marginTop: 12 }}>
          {p.specialties.map((s) => <Tag key={s} icon="cross">{SPECIALTY_LABEL[s] || s}</Tag>)}
        </TagRow>
      ) : null}
      <TagRow style={{ marginTop: 8 }}>
        {p.animals.map((a) => <Tag key={a} icon={ANIMAL_ICON[a]}>{ANIMAL_LABEL[a]}</Tag>)}
        {p.services.map((s) => <Tag key={s} icon={SERVICE_ICON[s]} accent>{SERVICE_LABEL[s]}</Tag>)}
      </TagRow>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <Btn label="Anrufen" icon="phone" style={{ flex: 1 }} onPress={() => callPractice(p)} />
        <Btn label="Route" icon="route" variant="secondary" style={{ flex: 1 }} onPress={() => openRoute(p)} />
      </View>
      <Btn label="Details ansehen" variant="ghost" size="sm" block style={{ marginTop: 6 }}
        onPress={() => navigation.navigate('Detail', { practiceId: p.id })} />
    </Card>
  );
}

export default function ResultsScreen({ navigation }) {
  const { data, filters, setFilters } = useAppState();
  const list = applyFilters(data.PRACTICES, filters);
  const hiddenGrey = filters.onlyConfirmed ? (applyFilters(data.PRACTICES, { ...filters, onlyConfirmed: false }).length - list.length) : 0;

  const chips = [];
  (filters.animals || []).forEach((a) => chips.push(ANIMAL_LABEL[a]));
  (filters.situations || []).forEach((s) => chips.push(SERVICE_LABEL[s]));
  (filters.districts || []).forEach((d) => chips.push(d));
  (filters.specialties || []).forEach((s) => chips.push(SPECIALTY_LABEL[s]));
  if (filters.onlyConfirmed) chips.push('Nur bestätigte');
  if (filters.onlyGreen) chips.push('Heute erreichbar');
  if (filters.housecall) chips.push('Hausbesuch');
  if (filters.is24h) chips.push('24 h');

  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5, gap: S.s4, paddingBottom: S.s7 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <H2>{list.length} {list.length === 1 ? 'Praxis' : 'Praxen'} gefunden</H2>
          <Meta>Grün zuerst · grau und rot zuletzt</Meta>
        </View>
        <Btn label="Filter" icon="filter" variant="secondary" size="sm" onPress={() => navigation.navigate('Search')} />
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
