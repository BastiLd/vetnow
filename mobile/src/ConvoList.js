/* Konversationsliste — öffnet den Chat-Thread-Screen (Root-Stack). */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from './theme';
import { Card, Meta, Notice } from './components';
import { AnimalGlyph } from './icons';
import { useAppState } from './lib/AdminContext';

export function ChatDisclaimer() {
  return <Notice type="warn">Keine medizinische Beratung. Bei akuten Notfällen bitte immer zusätzlich telefonisch Kontakt aufnehmen.</Notice>;
}

/* kind: 'owner' | 'clinic'; convos: [{id,title,sub,animal,date}] */
export default function ConvoList({ kind, convos, navigation, feedback, quickReplies }) {
  const { ownerChats, clinicChats, ownerUnread, clinicUnread } = useAppState();
  const chats = kind === 'owner' ? ownerChats : clinicChats;
  const unread = kind === 'owner' ? ownerUnread : clinicUnread;
  const lastText = (c) => {
    const m = chats[c.id] || [];
    const l = m[m.length - 1];
    return l ? (l.type === 'note' ? 'Abschlussnotiz' : l.type === 'image' ? '📷 Bild' : l.text) : '';
  };
  return (
    <Card pad={false}>
      {convos.map((c, i) => (
        <TouchableOpacity
          key={c.id}
          style={[st.item, i > 0 && { borderTopWidth: 1, borderTopColor: C.line2 }]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ChatThread', {
            kind, convoId: c.id, title: c.title, sub: c.sub, animal: c.animal,
            feedback: !!feedback, quickReplies: quickReplies || null,
          })}
        >
          <View style={st.avatar}><AnimalGlyph animal={c.animal} s={20} c={C.teal700} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.name}>{c.title}</Text>
            <Text style={st.snippet} numberOfLines={1}>{c.sub} · {lastText(c)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Meta style={{ marginTop: 0 }}>{c.date}</Meta>
            {unread[c.id] > 0 ? <View style={st.unread}><Text style={st.unreadText}>{unread[c.id]}</Text></View> : null}
          </View>
        </TouchableOpacity>
      ))}
    </Card>
  );
}

const st = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.teal50, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14.5, fontWeight: '700', color: C.ink },
  snippet: { fontSize: 12.5, color: C.ink3, marginTop: 2 },
  unread: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.teal600, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
});
