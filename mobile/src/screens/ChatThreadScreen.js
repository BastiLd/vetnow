/* Chat-Thread als eigener Screen: Tastatur verdeckt nichts (KeyboardAvoidingView
   mit Header-Offset), Bild-Anhang, Abschlussnotizen, Sterne-Bewertung.
   Nutzt den neuen Chat-Store (useChats) über chatId. */
import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Animated, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { C, R } from '../theme';
import { Meta, StarRating, toast } from '../components';
import { VNIcon } from '../icons';
import { Glyph } from './ChatsScreen';
import { aiChat, vetSystemPrompt, toAiMessages } from '../lib/ai';
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

const hasReaction = (m) => Object.keys(m.reactions || {}).length > 0;

/* WhatsApp-Look: ein kleines Badge, das auf der unteren Blasenkante sitzt
   (max. eine Reaktion je Seite). Der Wrapper bekommt bei vorhandener Reaktion
   unten Platz, damit das absolut positionierte Badge INNERHALB der
   Wrapper-Grenzen bleibt — Android würde es sonst abschneiden. */
function BubbleWrap({ m, mine, children }) {
  const on = hasReaction(m);
  return (
    <View style={[st.bubbleWrap, on && st.bubbleWrapReact]}>
      {children}
      {on ? (
        <View style={[st.reaction, mine ? { right: 8 } : { left: 8 }]}>
          {Object.entries(m.reactions).map(([side, emoji]) => (
            <Text key={side} style={{ fontSize: 12 }}>{emoji}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* Zeitzeile: Uhrzeit + optional „(bearbeitet)" + Herkunft der Antwort.
   `source` ist optional — alte Nachrichten zeigen wie bisher nur die Zeit. */
function messageStamp(m) {
  const src = m.source === 'ai-vision' ? ' · KI · Bild'
    : m.source === 'ai' ? ' · KI'
      : m.source === 'bot' ? ' · Bot'
        : m.source === 'error' ? ' · Hinweis' : '';
  return m.time + (m.editedAt ? ' · (bearbeitet)' : '') + src;
}

export default function ChatThreadScreen({ route, navigation }) {
  const { chatId, quickReplies } = route.params;
  const { chatById, labels, addMessage, markRead, settings, editMessage, deleteMessage, toggleReaction } = useChats();
  const chat = chatById(chatId);
  const me = chat && chat.role === 'owner' ? 'owner' : 'clinic';
  const other = me === 'owner' ? 'clinic' : 'owner';
  const [typing, setTyping] = React.useState(false);
  const handledRef = React.useRef('');
  const timersRef = React.useRef([]);
  const botTimersRef = React.useRef([]);

  const [draft, setDraft] = React.useState('');
  const [pendingImg, setPendingImg] = React.useState(null);
  const [pendingImgB64, setPendingImgB64] = React.useState(null);
  const [editIdx, setEditIdx] = React.useState(null); // Index der Nachricht im Bearbeiten-Modus
  const scrollRef = React.useRef(null);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  React.useEffect(() => { if (chat) markRead(chatId); }, [chatId]);
  React.useEffect(() => { if (chat) navigation.setOptions({ title: chat.title }); }, [chat && chat.title]);

  /* Mehrteilige Bot-Antworten nacheinander senden. Bewusst NICHT über
     timersRef: dessen Cleanup läuft schon beim nächsten Nachrichten-Update
     und würde die zweite Nachricht verschlucken. Diese Timer werden nur beim
     Chat-Wechsel/Verlassen abgeräumt. */
  const sendBotTexts = (targetId, from, texts) => {
    const list = (texts || []).filter(Boolean).slice(0, 3);
    if (!list.length) { setTyping(false); return; }
    list.forEach((tx, i) => {
      const t = setTimeout(() => {
        botTimersRef.current = botTimersRef.current.filter((x) => x !== t);
        if (i === 0) setTyping(false);
        addMessage(targetId, { from, text: tx, time: 'jetzt', source: 'bot' });
      }, 450 + i * 950);
      botTimersRef.current.push(t);
    });
  };
  React.useEffect(() => () => { botTimersRef.current.forEach(clearTimeout); botTimersRef.current = []; }, [chatId]);

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

    let alive = true;
    const practiceName = chat.role === 'owner' ? chat.title : 'Tierarztpraxis Drautal';

    // Zuerst die KI (Ollama über das Studio). Ist sie nicht erreichbar —
    // z. B. bei einer Vorführung ohne Netz —, übernimmt der eingebaute
    // Regel-Bot aus bot.js. Der Chat bleibt so nie stumm und zeigt nie eine
    // technische Fehlermeldung.
    (async () => {
      try {
        if (settings.botTyping) setTyping(true);
        const sys = { role: 'system', content: vetSystemPrompt(other, practiceName) };
        const history = isGreeting
          ? [sys, { role: 'user', content: '(Der Chat wurde gerade geöffnet — begrüße kurz und freundlich.)' }]
          : [sys, ...toAiMessages(arr, other, null)];
        const r = await aiChat({ messages: history, model: settings.aiModel, aiBaseUrl: settings.aiBaseUrl });
        if (!alive) return;
        setTyping(false);
        addMessage(chat.id, { from: other, text: r.text, time: 'jetzt', source: r.vision ? 'ai-vision' : 'ai', aiModel: r.model });
      } catch (err) {
        if (!alive) return;
        /* Unterscheiden statt alles verschlucken: KI offline → Bot übernimmt
           still. Problem mit dem BILD → sichtbarer Hinweis, sonst erfährt man
           nie, dass das Foto nie angekommen ist. */
        if (err && err.visible) {
          setTyping(false);
          addMessage(chat.id, { from: other, text: '⚠️ ' + err.message, time: 'jetzt', source: 'error' });
          return;
        }
        let texts;
        if (isGreeting) texts = [botGreetingText(other, practiceName)];
        else if (lastM && lastM.type === 'image') texts = [botImageReply(other)];
        else texts = botConversationReply({ messages: arr, userText: (lastM && lastM.text) || '', fromRole: other, practiceName }).texts;
        sendBotTexts(chat.id, other, texts);
      }
    })();

    return () => { alive = false; setTyping(false); timersRef.current.forEach(clearTimeout); timersRef.current = []; };
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
    if (editIdx != null && text == null) {
      if (!t) { toast('Text darf nicht leer sein.', 'error'); return; }
      editMessage(chatId, editIdx, t); setEditIdx(null); setDraft(''); toast('Nachricht bearbeitet.', 'success'); return;
    }
    if (pendingImg && text == null) {
      // srcB64 = Bilddaten für die KI, src = Pfad für die Anzeige.
      addMessage(chatId, { from: me, type: 'image', src: pendingImg, srcB64: pendingImgB64 || undefined, text: t, time: 'jetzt' });
      setPendingImg(null); setPendingImgB64(null); setDraft(''); return;
    }
    if (!t) return;
    addMessage(chatId, { from: me, text: t, time: 'jetzt' });
    if (text == null) setDraft('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  };

  const cancelEdit = () => { setEditIdx(null); setDraft(''); };

  /* Langes Drücken auf eine Blase → Menü. Bewusst das im Projekt schon
     genutzte Alert-Mehrknopf-Muster (wie ChatsScreen), keine neue Komponente. */
  const REACTIONS = ['👍', '❤️', '😂', '😮'];
  const openMsgMenu = (m, i) => {
    if (m.deleted || m.type === 'note') return;
    const mine = m.from === me;
    const opts = [{
      text: 'Reagieren', onPress: () => Alert.alert('Reaktion', 'Womit möchten Sie reagieren?', [
        ...REACTIONS.map((e) => ({ text: e, onPress: () => toggleReaction(chatId, i, me, e) })),
        { text: 'Abbrechen', style: 'cancel' },
      ]),
    }];
    if (mine && !m.type) opts.push({ text: 'Bearbeiten', onPress: () => { setEditIdx(i); setDraft(m.text || ''); } });
    if (mine) {
      opts.push({
        text: 'Löschen', style: 'destructive', onPress: () => Alert.alert('Nachricht löschen?', 'Der Inhalt wird entfernt.', [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Löschen', style: 'destructive', onPress: () => { deleteMessage(chatId, i); if (editIdx === i) cancelEdit(); toast('Nachricht gelöscht.', 'info'); } },
        ]),
      });
    }
    opts.push({ text: 'Abbrechen', style: 'cancel' });
    Alert.alert('Nachricht', mine ? 'Ihre Nachricht' : 'Nachricht der Gegenseite', opts);
  };

  /* Ein Bild aus dem Picker aufbereiten.
     WICHTIG: Der Picker liefert nur einen Dateipfad (file:///…) — darin stecken
     KEINE Bilddaten. Genau deshalb konnte bisher kein Bild bei der KI ankommen.
     Wir rechnen das Foto deshalb auf MAX_IMAGE_PX herunter und holen uns die
     Rohdaten als Base64 (`srcB64`). `src` bleibt der Pfad, weil <Image> ihn
     zum Anzeigen braucht. */
  const MAX_IMAGE_PX = 1024;
  const prepareImage = async (asset) => {
    try {
      const long = Math.max(asset.width || 0, asset.height || 0);
      const ctx = ImageManipulator.manipulate(asset.uri);
      if (long > MAX_IMAGE_PX) {
        if ((asset.width || 0) >= (asset.height || 0)) ctx.resize({ width: MAX_IMAGE_PX });
        else ctx.resize({ height: MAX_IMAGE_PX });
      }
      const img = await ctx.renderAsync();
      const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      return { uri: out.uri, b64: out.base64 || '' };
    } catch {
      // Verkleinern fehlgeschlagen → wenigstens anzeigen können.
      return { uri: asset.uri, b64: asset.base64 || '' };
    }
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (res.canceled || !res.assets || !res.assets[0]) return;
    const p = await prepareImage(res.assets[0]);
    setPendingImg(p.uri); setPendingImgB64(p.b64);
    toast('Bild bereit zum Senden.', 'info');
  };

  /* Kamera: braucht kein zusätzliches Paket, aber zur Laufzeit die Erlaubnis.
     Die Berechtigung selbst kommt aus dem Config-Plugin in app.json und ist
     erst nach einem NEUEN nativen Build (EAS) im Manifest. */
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { toast('Kamera-Zugriff nicht erlaubt.', 'error'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (res.canceled || !res.assets || !res.assets[0]) return;
    const p = await prepareImage(res.assets[0]);
    setPendingImg(p.uri); setPendingImgB64(p.b64);
    toast('Foto bereit zum Senden.', 'info');
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets || !res.assets[0]) return;
    const f = res.assets[0];
    addMessage(chatId, { from: me, type: 'file', src: f.uri, fileName: f.name || 'Datei', fileMime: f.mimeType || '', text: '', time: 'jetzt' });
    toast('Datei gesendet.', 'success');
  };

  const openAttach = () => Alert.alert('Anhang', 'Was möchten Sie anhängen?', [
    { text: '📷 Kamera', onPress: takePhoto },
    { text: '🖼️ Galerie', onPress: pickImage },
    { text: '📎 Datei', onPress: pickFile },
    { text: 'Abbrechen', style: 'cancel' },
  ]);

  const hasNote = msgs.some((m) => m.type === 'note');
  const last = msgs[msgs.length - 1];
  const lastIsOwnerReply = last && last.from === 'owner' && last.type !== 'note';
  const showFeedback = me === 'owner' && hasNote && !lastIsOwnerReply;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.surface2 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
      <View style={st.subHead}>
        <View style={[st.avatar, { backgroundColor: chat.color + '22' }]}><Glyph name={chat.icon} s={18} c={chat.color} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.name} numberOfLines={1}>{chat.title}</Text>
          {chat.sub ? <Meta style={{ marginTop: 0 }} numberOfLines={1}>{chat.sub}</Meta> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 5, flexShrink: 0 }}>
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
          if (m.deleted) {
            return (
              <View key={i} style={[st.msgCol, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
                <View style={st.bubbleWrap}>
                  <View style={[st.bubble, st.bubbleDeleted]}><Text style={st.deletedText}>Nachricht gelöscht</Text></View>
                </View>
                <Meta style={{ marginTop: 2 }}>{m.time}</Meta>
              </View>
            );
          }
          const stamp = messageStamp(m);
          if (m.type === 'image') {
            return (
              <View key={i} style={[st.msgCol, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
                <BubbleWrap m={m} mine={mine}>
                  <TouchableOpacity activeOpacity={0.85} onLongPress={() => openMsgMenu(m, i)} delayLongPress={300}
                    style={[st.imgBubble, mine ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }]}>
                    <Image source={{ uri: m.src }} style={st.img} resizeMode="cover" />
                    {m.text ? <Text style={st.imgCaption}>{m.text}</Text> : null}
                  </TouchableOpacity>
                </BubbleWrap>
                <Meta style={{ marginTop: 2 }}>{stamp}</Meta>
              </View>
            );
          }
          if (m.type === 'file') {
            return (
              <View key={i} style={[st.msgCol, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
                <BubbleWrap m={m} mine={mine}>
                  <TouchableOpacity activeOpacity={0.85} onLongPress={() => openMsgMenu(m, i)} delayLongPress={300} style={st.fileBubble}>
                    <View style={st.fileIc}><VNIcon.note s={16} c={C.teal700} /></View>
                    <View style={{ flexShrink: 1, minWidth: 0 }}>
                      <Text style={st.fileName} numberOfLines={1}>{m.fileName || 'Datei'}</Text>
                      {m.text ? <Text style={st.imgCaption} numberOfLines={2}>{m.text}</Text> : null}
                    </View>
                  </TouchableOpacity>
                </BubbleWrap>
                <Meta style={{ marginTop: 2 }}>{stamp}</Meta>
              </View>
            );
          }
          return (
            <View key={i} style={[st.msgCol, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
              <BubbleWrap m={m} mine={mine}>
                <TouchableOpacity activeOpacity={0.85} onLongPress={() => openMsgMenu(m, i)} delayLongPress={300}
                  style={[st.bubble, mine ? st.bubbleMe : st.bubbleOther, editIdx === i && { borderWidth: 2, borderColor: C.yellow }]}>
                  <Text style={[st.bubbleText, mine && { color: '#fff' }]}>{m.text}</Text>
                </TouchableOpacity>
              </BubbleWrap>
              <Meta style={{ marginTop: 2 }}>{stamp}</Meta>
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

      {editIdx != null ? (
        <View style={st.preview}>
          <VNIcon.pencil s={16} c={C.teal700} />
          <Meta style={{ flex: 1, marginTop: 0 }}>Nachricht bearbeiten</Meta>
          <TouchableOpacity onPress={cancelEdit} hitSlop={8}><VNIcon.x s={18} c={C.ink2} /></TouchableOpacity>
        </View>
      ) : null}

      {pendingImg ? (
        <View style={st.preview}>
          <Image source={{ uri: pendingImg }} style={st.previewImg} />
          <Meta style={{ flex: 1, marginTop: 0 }}>Bild angehängt</Meta>
          <TouchableOpacity onPress={() => { setPendingImg(null); setPendingImgB64(null); }} hitSlop={8}><VNIcon.x s={18} c={C.ink2} /></TouchableOpacity>
        </View>
      ) : null}

      <View style={[st.compose, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity style={st.attach} onPress={openAttach} hitSlop={6}><VNIcon.camera s={20} c={C.ink2} /></TouchableOpacity>
        <TextInput style={st.input} value={draft} onChangeText={setDraft} placeholder={editIdx != null ? 'Nachricht bearbeiten …' : pendingImg ? 'Bildunterschrift (optional) …' : 'Nachricht schreiben …'} placeholderTextColor={C.ink3} onSubmitEditing={() => send()} returnKeyType="send" blurOnSubmit={false} />
        <TouchableOpacity style={st.sendBtn} onPress={() => send()}><VNIcon.send s={17} c="#fff" /></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  subHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line2 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14.5, fontWeight: '700', color: C.ink },
  /* Die Breitenbegrenzung sitzt am Wrapper, nicht mehr an der Blase selbst —
     sonst würde sich die Prozentangabe gegen den schrumpfenden Wrapper
     auflösen statt gegen die Zeilenbreite. */
  msgCol: { width: '100%' },
  bubbleWrap: { maxWidth: '84%' },
  bubbleWrapReact: { paddingBottom: 12 },
  bubble: { borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
  bubbleMe: { backgroundColor: C.teal600, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14.5, lineHeight: 20, color: C.ink },
  bubbleDeleted: { backgroundColor: C.surface3, borderWidth: 1, borderColor: C.line },
  deletedText: { fontSize: 14, color: C.ink3, fontStyle: 'italic' },
  /* Badge sitzt absolut auf der unteren Blasenkante (WhatsApp-Look). Der
     2px-Rand in Hintergrundfarbe erzeugt den „ausgestanzten" Effekt. */
  reaction: {
    position: 'absolute', bottom: 0, flexDirection: 'row', gap: 2, alignItems: 'center',
    height: 20, paddingHorizontal: 5, borderRadius: R.pill,
    backgroundColor: C.surface, borderWidth: 2, borderColor: C.surface2,
  },
  fileBubble: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line },
  fileIc: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.teal50, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 13.5, fontWeight: '700', color: C.ink },
  imgBubble: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: C.line },
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
