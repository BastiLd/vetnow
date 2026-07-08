/* Tierhalter: Meine Nachrichten (Konversationen mit Praxen) */
import React from 'react';
import { View, ScrollView } from 'react-native';
import { C, S } from '../theme';
import { Card, H2, P } from '../components';
import ConvoList, { ChatDisclaimer } from '../ConvoList';
import { useAppState } from '../lib/AdminContext';

export default function MessagesScreen({ navigation }) {
  const { data } = useAppState();
  const convos = data.OWNER_CONVERSATIONS;
  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5, gap: S.s4, paddingBottom: S.s8 }}>
      <View>
        <H2>Meine Nachrichten</H2>
        <P style={{ marginTop: 5 }}>Ihre Anfragen und Konversationen mit Praxen.</P>
      </View>
      <ChatDisclaimer />
      {convos.length === 0 ? (
        <Card style={{ alignItems: 'center' }}><P>Noch keine Nachrichten vorhanden.</P></Card>
      ) : (
        <ConvoList kind="owner" convos={convos} navigation={navigation} feedback />
      )}
    </ScrollView>
  );
}
