/* Chat-Thread als eigener Screen: Tastatur verdeckt nichts (KeyboardAvoidingView
   mit Header-Offset), Bild-Anhang, Abschlussnotizen, Sterne-Bewertung.
   Nutzt den neuen Chat-Store (useChats) über chatId. */
import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Animated, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { C, R } from '../theme';
import { Meta, StarRating, toast } from '../components';
import { VNIcon } from '../icons';
import { Glyph } from './ChatsScreen';
import { botConversationReply, botGreetingText, botImageReply } from '../bot';
import { useChats } from '../lib/ChatContext';

/* Animierte 3-Punkte-Tippanzeige */
function TypingDots() {
  const vals = React.useRef([new Animated.Value(0.4), new Animated.Value(0.4), new Animated.Value(0.4)]).current;
  React.useEffect(() => {
    const loops = vals.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 160),
      Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.4, duration: 300, useNativeDriver: true }),
      Animated.delay((2 - i) * 160),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingVertical: 4 }}>
      {vals.map((v, i) => <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.ink3, opacity: v }} />)}
    </View>
  );
}

export default function ChatThreadScreen({ route, navigation }) {
  const { chatId, quickReplies } = route.params;
  const { chatById, labels, addMessage, markRead, settings } = useChats();
  const chat = chatById(chatId);
  const me = chat && chat.role === 'owner' ? 'owner' : 'clinic';
  const other = me === 'owner' ? 'clinic' : 'owner';
  const [typing, setTyping] = React.useState(false);
  const handledRef = React.useRef('');
  const timersRef = React.useRef([]);

  const [draft, setDraft] = React.useState('');
  const [pendingImg, setPendingImg] = React.useState(null);
  const scrollRef = React.useRef(null);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  React.useEffect(() => { if (chat) markRead(chatId); }, [chatId]);
  React.useEffect(() => { if (chat) navigation.setOptions({ title: chat.title }); }, [chat && chat.title]);

  // Auto-Antwort-Bot 2.0: reagiert, wenn die letzte Nachricht von MIR ist
  // (oder Chat leer → Begrüßung). Kann mehrteilige Antworten senden.
  const msgLen = chat ? chat.messages.length : 0;
  React.useEffect(() => {
    if (!chat || !settings || !settings.botEnabled) return;
    const arr = chat.messages;
    const lastM = arr[arr.length - 1];
    const sig = chat.id + ':' + arr.length + ':' + (lastM ? lastM.from + (lastM.type || '') : 'empty');
    if (handledRef.current === sig) return;

    const isGreeting = arr.length === 0 && settings.botGreeting;
    const isReply = lastM && lastM.from === me && lastM.type !== 'note';
    if (!isGreeting && !isReply) return;
    handledRef.current = sig;

    const schedule = (fn, delay) => { const t = setTimeout(fn, delay); timersRef.current.push(t); };
    const practiceName = chat.role === 'owner' ? chat.title : 'Tierarztpraxis Drautal';

    let texts;
    if (isGreeting) texts = [botGreetingText(other, practiceName)];
    else if (lastM.type === 'image') texts = [botImageReply(other)];
    else texts = botConversationReply({ messages: arr.slice(0, -1), userText: lastM.text || '', fromRole: other, practiceName }).texts;

    // Mehrere Nachrichten nacheinander — Tipp-Dauer wächst mit Textlänge.
    let delay = 120;
    texts.forEach((txt) => {
      const typeDur = settings.botTyping ? Math.min(2400, 650 + txt.length * 16) : 350;
      if (settings.botTyping) schedule(() => setTyping(true), delay);
      delay += typeDur;
      schedule(() => { setTyping(false); addMessage(chat.id, { from: other, text: txt, time: 'jetzt' }); }, delay);
      delay += 500;
    });

    return () => { setTyping(false); timersRef.current.forEach(clearTimeout); timersRef.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgLen, chatId, settings && settings.botEnabled]);

  if (!chat) {
    return (
      <View style={{ flex: 1, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: C.ink3 }}>Dieser Chat ist nicht mehr verfügbar.</Text>
      </View>
    );
  }

  const msgs = chat.messages;
  const chatLabels = (chat.labels || []).map((id) => labels.find((l) => l.id === id)).filter(Boolean);

  const send = (text) => {
    const t = (text != null ? text : draft).trim();
    if (pendingImg && text == null) { addMessage(chatId, { from: me, type: 'image', src: pendingImg, text: t, time: 'jetzt' }); setPendingImg(null); setDraft(''); return; }
    if (!t) return;
    addMessage(chatId, { from: me, text: t, time: 'jetzt' });
    if (text == null) setDraft('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!res.canceled && res.assets && res.assets[0]) { setPendingImg(res.assets[0].uri); toast('Bild bereit zum Senden.', 'info'); }
  };

  const hasNote = msgs.some((m) => m.type === 'note');
  const last = msgs[msgs.length - 1];
  const lastIsOwnerReply = last && last.from === 'owner' && last.type !== 'note';
  const showFeedback = me === 'owner' && hasNote && !lastIsOwnerReply;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.surface2 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
      <View style={st.subHead}>
        <View style={[st.avatar, { backgroundColor: chat.color + '22' }]}><Glyph name={chat.icon} s={18} c={chat.color} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.name}>{chat.title}</Text>
          {chat.sub ? <Meta style={{ marginTop: 0 }}>{chat.sub}</Meta> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 5 }}>
          {chatLabels.slice(0, 2).map((l) => (
            <View key={l.id} style={{ backgroundColor: l.color + '22', borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 8 }}>
              <Text style={{ color: l.color, fontSize: 10.5, fontWeight: '700' }}>{l.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 10 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled">
        {msgs.length === 0 ? <Text style={{ color: C.ink3, textAlign: 'center', marginTop: 30 }}>Schreibe die erste Nachricht.</Text> : null}
        {msgs.map((m, i) => {
          if (m.type === 'note') {
            return (
              <View key={i} style={st.note}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><VNIcon.note s={14} c={C.blueInk} /><Text style={st.noteLabel}>Abschlussnotiz der Praxis</Text></View>
                <Text style={st.noteText}>{m.text}</Text>
                <Meta>{m.time}</Meta>
              </View>
            );
          }
          const mine = m.from === me;
          if (m.type === 'image') {
            return (
              <View key={i} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View style={[st.imgBubble, mine ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }]}>
                  <Image source={{ uri: m.src }} style={st.img} resizeMode="cover" />
                  {m.text ? <Text style={st.imgCaption}>{m.text}</Text> : null}
                </View>
                <Meta style={{ marginTop: 2 }}>{m.time}</Meta>
              </View>
            );
          }
          return (
            <View key={i} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <View style={[st.bubble, mine ? st.bubbleMe : st.bubbleOther]}><Text style={[st.bubbleText, mine && { color: '#fff' }]}>{m.text}</Text></View>
              <Meta style={{ marginTop: 2 }}>{m.time}</Meta>
            </View>
          );
        })}
        {typing ? (
          <View style={{ alignItems: 'flex-start' }}>
            <View style={[st.bubble, st.bubbleOther, { paddingVertical: 6, paddingHorizontal: 12 }]}><TypingDots /></View>
          </View>
        ) : null}
      </ScrollView>

      {showFeedback ? (
        <View style={st.quickBar}>
          <Meta style={{ fontWeight: '700', marginTop: 0 }}>Rückmeldung:</Meta>
          <TouchableOpacity style={st.quick} onPress={() => { send('Danke für die Rückmeldung!'); toast('Antwort gesendet.', 'success'); }}><Text style={st.quickText}>Danke!</Text></TouchableOpacity>
          <StarRating value={0} size={22} onChange={(n) => { send('Bewertung: ' + '★'.repeat(n) + ' (' + n + '/5)'); toast('Vielen Dank für Ihre Bewertung!', 'success'); }} />
        </View>
      ) : null}

      {quickReplies && quickReplies.length ? (
        <View style={st.quickBar}>
          {quickReplies.map((q) => <TouchableOpacity key={q} style={st.quick} onPress={() => { send(q); toast('Antwort gesendet.', 'success'); }}><Text style={st.quickText}>{q}</Text></TouchableOpacity>)}
        </View>
      ) : null}

      {pendingImg ? (
        <View style={st.preview}>
          <Image source={{ uri: pendingImg }} style={st.previewImg} />
          <Meta style={{ flex: 1, marginTop: 0 }}>Bild angehängt</Meta>
          <TouchableOpacity onPress={() => setPendingImg(null)} hitSlop={8}><VNIcon.x s={18} c={C.ink2} /></TouchableOpacity>
        </View>
      ) : null}

      <View style={[st.compose, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity style={st.attach} onPress={pickImage} hitSlop={6}><VNIcon.camera s={20} c={C.ink2} /></TouchableOpacity>
        <TextInput style={st.input} value={draft} onChangeText={setDraft} placeholder={pendingImg ? 'Bildunterschrift (optional) …' : 'Nachricht schreiben …'} placeholderTextColor={C.ink3} onSubmitEditing={() => send()} returnKeyType="send" blurOnSubmit={false} />
        <TouchableOpacity style={st.sendBtn} onPress={() => send()}><VNIcon.send s={17} c="#fff" /></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  subHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line2 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14.5, fontWeight: '700', color: C.ink },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
  bubbleMe: { backgroundColor: C.teal600, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14.5, lineHeight: 20, color: C.ink },
  imgBubble: { maxWidth: '75%', borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: C.line },
  img: { width: 220, height: 160 },
  imgCaption: { fontSize: 13, color: C.ink2, padding: 8 },
  note: { backgroundColor: C.blueBg, borderRadius: 12, padding: 12, gap: 5 },
  noteLabel: { fontSize: 12, fontWeight: '700', color: C.blueInk },
  noteText: { fontSize: 13.5, lineHeight: 19, color: C.blueInk },
  quickBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line2 },
  quick: { backgroundColor: C.teal50, borderWidth: 1, borderColor: C.teal100, borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 11 },
  quickText: { fontSize: 12.5, color: C.teal700, fontWeight: '600' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line2 },
  previewImg: { width: 44, height: 44, borderRadius: 8 },
  compose: { flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingTop: 10, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line2, alignItems: 'center' },
  attach: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: C.surface2, borderRadius: R.pill, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14.5, color: C.ink },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.teal600, alignItems: 'center', justifyContent: 'center' },
});
