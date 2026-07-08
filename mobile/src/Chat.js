/* Wiederverwendbarer Chat (Liste -> Thread) für Praxis-Dashboard & Tierhalter.
   Vereinfachungen ggü. Web: kein Bild-Anhang, Bewertung als Schnellantworten. */
import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { C, R } from './theme';
import { Card, Notice, Meta, ANIMAL_EMOJI } from './components';

export function ChatDisclaimer() {
  return <Notice type="warn">Keine medizinische Beratung. Bei akuten Notfällen bitte immer zusätzlich telefonisch Kontakt aufnehmen.</Notice>;
}

export default function ChatView({ convos, me, feedback, quickReplies }) {
  const [store, setStore] = React.useState(() => Object.fromEntries(convos.map((c) => [c.id, c.messages])));
  const [sel, setSel] = React.useState(null);
  const [draft, setDraft] = React.useState('');
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    // Konversationen können sich ändern (Admin-Schalter) — Store nachziehen
    setStore((s) => {
      const n = { ...s };
      convos.forEach((c) => { if (!n[c.id]) n[c.id] = c.messages; });
      return n;
    });
  }, [convos]);

  const active = convos.find((c) => c.id === sel);
  const msgs = active ? (store[active.id] || []) : [];
  const lastText = (c) => { const m = store[c.id] || []; const l = m[m.length - 1]; return l ? (l.type === 'note' ? 'Abschlussnotiz' : l.text) : ''; };

  const append = (msg) => setStore((s) => ({ ...s, [active.id]: [...(s[active.id] || []), msg] }));
  const send = (text) => {
    const t = (text != null ? text : draft).trim();
    if (!t || !active) return;
    append({ from: me, text: t, time: 'jetzt' });
    setDraft('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const hasNote = msgs.some((m) => m.type === 'note');
  const lastIsOwnerReply = msgs.length && msgs[msgs.length - 1].from === 'owner' && msgs[msgs.length - 1].type !== 'note';
  const showFeedback = feedback && me === 'owner' && hasNote && !lastIsOwnerReply;

  if (!active) {
    return (
      <Card pad={false}>
        {convos.map((c, i) => (
          <TouchableOpacity key={c.id} style={[st.item, i > 0 && { borderTopWidth: 1, borderTopColor: C.line2 }]} onPress={() => setSel(c.id)} activeOpacity={0.7}>
            <View style={st.avatar}><Text style={{ fontSize: 18 }}>{ANIMAL_EMOJI[c.animal] || '🐾'}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.name}>{c.title}</Text>
              <Text style={st.snippet} numberOfLines={1}>{c.sub} · {lastText(c)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Meta>{c.date}</Meta>
              {c.unread > 0 ? <View style={st.unread}><Text style={st.unreadText}>{c.unread}</Text></View> : null}
            </View>
          </TouchableOpacity>
        ))}
      </Card>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Card pad={false} style={{ overflow: 'hidden' }}>
        <View style={st.head}>
          <TouchableOpacity onPress={() => setSel(null)} style={st.backBtn}><Text style={{ fontSize: 16, color: C.ink2 }}>‹ Zurück</Text></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.name}>{active.title}</Text>
            <Meta>{active.sub}</Meta>
          </View>
        </View>
        <ScrollView ref={scrollRef} style={{ maxHeight: 380 }} contentContainerStyle={{ padding: 12, gap: 10 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          {msgs.map((m, i) => {
            if (m.type === 'note') {
              return (
                <View key={i} style={st.note}>
                  <Text style={st.noteLabel}>📋 Abschlussnotiz der Praxis</Text>
                  <Text style={st.noteText}>{m.text}</Text>
                  <Meta>{m.time}</Meta>
                </View>
              );
            }
            const mine = m.from === me;
            return (
              <View key={i} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View style={[st.bubble, mine ? st.bubbleMe : st.bubbleOther]}>
                  <Text style={[st.bubbleText, mine && { color: '#fff' }]}>{m.text}</Text>
                </View>
                <Meta style={{ marginTop: 2 }}>{m.time}</Meta>
              </View>
            );
          })}
        </ScrollView>

        {showFeedback ? (
          <View style={st.feedbackBar}>
            <Meta style={{ fontWeight: '700' }}>Rückmeldung geben:</Meta>
            {['Danke!', '★★★★★ (5/5)', '★★★★ (4/5)'].map((q) => (
              <TouchableOpacity key={q} style={st.quick} onPress={() => send(q === 'Danke!' ? 'Danke für die Rückmeldung!' : 'Bewertung: ' + q)}>
                <Text style={st.quickText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {quickReplies && quickReplies.length ? (
          <View style={st.feedbackBar}>
            {quickReplies.map((q) => (
              <TouchableOpacity key={q} style={st.quick} onPress={() => send(q)}>
                <Text style={st.quickText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={st.compose}>
          <TextInput
            style={st.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Nachricht schreiben …"
            placeholderTextColor={C.ink3}
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <TouchableOpacity style={st.sendBtn} onPress={() => send()}><Text style={{ color: '#fff', fontWeight: '800' }}>➤</Text></TouchableOpacity>
        </View>
      </Card>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.teal50, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14.5, fontWeight: '700', color: C.ink },
  snippet: { fontSize: 12.5, color: C.ink3, marginTop: 2 },
  unread: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.teal600, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: C.line2 },
  backBtn: { paddingVertical: 4, paddingRight: 6 },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
  bubbleMe: { backgroundColor: C.teal600, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: C.surface3, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, color: C.ink },
  note: { backgroundColor: C.blueBg, borderRadius: 12, padding: 12, gap: 4 },
  noteLabel: { fontSize: 12, fontWeight: '700', color: C.blueInk },
  noteText: { fontSize: 13.5, lineHeight: 19, color: C.blueInk },
  feedbackBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line2 },
  quick: { backgroundColor: C.teal50, borderWidth: 1, borderColor: C.teal100, borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 11 },
  quickText: { fontSize: 12.5, color: C.teal700, fontWeight: '600' },
  compose: { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: C.line2, alignItems: 'center' },
  input: { flex: 1, backgroundColor: C.surface2, borderRadius: R.pill, paddingVertical: 9, paddingHorizontal: 14, fontSize: 14, color: C.ink },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.teal600, alignItems: 'center', justifyContent: 'center' },
});
