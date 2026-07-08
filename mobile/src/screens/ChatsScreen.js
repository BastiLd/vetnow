/* VetNow — Chats (Mobile): Liste mit Label-Filter, Erstellen/Bearbeiten
   (Farbe, Icon, Bereich, Labels), Anpinnen, Löschen, Label-Verwaltung, Einstellungen.
   Öffnet den Thread als eigenen Screen (ChatThread). */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, Switch as RNSwitch, StyleSheet } from 'react-native';
import { C, S, R } from '../theme';
import { Card, SectionLabel, Btn, Field, Input, H2, P, Meta, toast } from '../components';
import { VNIcon } from '../icons';
import { CHAT_ROLES } from '../data';
import { useChats } from '../lib/ChatContext';

export const PALETTE = ['#0f9b8e', '#0c7d72', '#2e6f9e', '#16a34a', '#e3a008', '#dc2626', '#8a5d05', '#6c7d79', '#7c3aed', '#db2777'];
export const ICON_CHOICES = ['chat', 'paw2', 'dog', 'cat', 'rabbit', 'horse', 'bird', 'turtle', 'siren', 'cal', 'building', 'shield', 'heart', 'star', 'phone', 'note', 'home', 'cross', 'mail', 'user'];

export function Glyph({ name, s, c }) {
  const I = VNIcon[name] || VNIcon.chat;
  return <I s={s} c={c} />;
}

function ColorPicker({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {PALETTE.map((col) => (
        <TouchableOpacity key={col} onPress={() => onChange(col)}
          style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: col, borderWidth: value === col ? 3 : 1, borderColor: value === col ? C.ink : C.line }} />
      ))}
    </View>
  );
}
function IconPicker({ value, color, onChange }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {ICON_CHOICES.map((name) => (
        <TouchableOpacity key={name} onPress={() => onChange(name)}
          style={{ width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: value === name ? (color || C.teal600) : C.surface3, borderWidth: 1, borderColor: C.line }}>
          <Glyph name={name} s={18} c={value === name ? '#fff' : C.ink2} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Sheet({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cs.modalBg}>
        <View style={cs.sheet}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.line2 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={cs.iconBtn}><VNIcon.x s={18} c={C.ink2} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ---- Chat-Editor ---- */
function ChatEditor({ initial, labels, onSave, onClose }) {
  const [f, setF] = React.useState({
    title: initial?.title || '', sub: initial?.sub || '', role: initial?.role || 'owner',
    color: initial?.color || '#0f9b8e', icon: initial?.icon || 'chat', animal: initial?.animal || 'other',
    labels: initial?.labels ? [...initial.labels] : [],
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const toggleLabel = (id) => set('labels', f.labels.includes(id) ? f.labels.filter((x) => x !== id) : [...f.labels, id]);
  const submit = () => { if (!f.title.trim()) { toast('Bitte einen Namen eingeben.', 'error'); return; } onSave(f); };
  return (
    <Sheet visible onClose={onClose} title={initial ? 'Chat bearbeiten' : 'Neuer Chat'}>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: f.color, alignItems: 'center', justifyContent: 'center' }}>
            <Glyph name={f.icon} s={24} c="#fff" />
          </View>
          <Input value={f.title} onChangeText={(v) => set('title', v)} placeholder="Name (z. B. Familie Berger)" style={{ flex: 1 }} />
        </View>
        <Field label="Untertitel"><Input value={f.sub} onChangeText={(v) => set('sub', v)} placeholder="z. B. Balu (Hund) · Notfall" /></Field>
        <Field label="Bereich">
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {CHAT_ROLES.map((r) => (
              <TouchableOpacity key={r.key} onPress={() => set('role', r.key)}
                style={[cs.roleBtn, f.role === r.key && { borderColor: C.teal600, backgroundColor: C.teal50 }]}>
                <Text style={[{ fontSize: 11.5, fontWeight: '600', color: C.ink2, textAlign: 'center' }, f.role === r.key && { color: C.teal700 }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>
        <Field label="Farbe"><ColorPicker value={f.color} onChange={(v) => set('color', v)} /></Field>
        <Field label="Icon"><IconPicker value={f.icon} color={f.color} onChange={(v) => set('icon', v)} /></Field>
        {labels.length > 0 && (
          <Field label="Labels">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {labels.map((l) => {
                const on = f.labels.includes(l.id);
                return (
                  <TouchableOpacity key={l.id} onPress={() => toggleLabel(l.id)}
                    style={[cs.labelChip, { borderColor: on ? l.color : C.line2, backgroundColor: on ? l.color + '22' : C.surface3 }]}>
                    <Glyph name={l.icon} s={12} c={on ? l.color : C.ink3} />
                    <Text style={[cs.labelChipText, { color: on ? l.color : C.ink2 }]}>{l.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>
        )}
        <Btn label={initial ? 'Speichern' : 'Chat erstellen'} size="lg" block onPress={submit} />
      </View>
    </Sheet>
  );
}

/* ---- Label-Verwaltung ---- */
function LabelManager({ labels, onClose, createLabel, updateLabel, deleteLabel }) {
  const [edit, setEdit] = React.useState(null);
  const [f, setF] = React.useState({ name: '', color: '#7c3aed', icon: 'star' });
  const startNew = () => { setF({ name: '', color: '#7c3aed', icon: 'star' }); setEdit('new'); };
  const startEdit = (l) => { setF({ name: l.name, color: l.color, icon: l.icon }); setEdit(l.id); };
  const submit = () => {
    if (!f.name.trim()) { toast('Bitte einen Namen eingeben.', 'error'); return; }
    if (edit === 'new') { createLabel(f); toast('Label erstellt.', 'success'); } else { updateLabel(edit, f); toast('Label gespeichert.', 'success'); }
    setEdit(null);
  };
  return (
    <Sheet visible onClose={onClose} title="Labels verwalten">
      {edit ? (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: f.color, alignItems: 'center', justifyContent: 'center' }}><Glyph name={f.icon} s={20} c="#fff" /></View>
            <Input value={f.name} onChangeText={(v) => setF({ ...f, name: v })} placeholder="Label-Name" style={{ flex: 1 }} />
          </View>
          <Field label="Farbe"><ColorPicker value={f.color} onChange={(v) => setF({ ...f, color: v })} /></Field>
          <Field label="Icon"><IconPicker value={f.icon} color={f.color} onChange={(v) => setF({ ...f, icon: v })} /></Field>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn label="Zurück" variant="secondary" style={{ flex: 1 }} onPress={() => setEdit(null)} />
            <Btn label="Speichern" style={{ flex: 1 }} onPress={submit} />
          </View>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {labels.length === 0 ? <Meta>Noch keine Labels.</Meta> : null}
          {labels.map((l) => (
            <View key={l.id} style={cs.labelRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: l.color, alignItems: 'center', justifyContent: 'center' }}><Glyph name={l.icon} s={15} c="#fff" /></View>
                <Text style={{ fontWeight: '600', color: C.ink }}>{l.name}</Text>
              </View>
              <TouchableOpacity style={cs.smallBtn} onPress={() => startEdit(l)}><VNIcon.pencil s={14} c={C.ink2} /></TouchableOpacity>
              <TouchableOpacity style={cs.smallBtn} onPress={() => { deleteLabel(l.id); toast('Label gelöscht.', 'info'); }}><VNIcon.x s={14} c={C.redInk} /></TouchableOpacity>
            </View>
          ))}
          <Btn label="Neues Label" icon="plus" block style={{ marginTop: 6 }} onPress={startNew} />
        </View>
      )}
    </Sheet>
  );
}

/* ---- Einstellungen ---- */
function ChatSettings({ settings, setSetting, onClose, resetSeed, clearAll }) {
  const rows = [
    ['showLabels', 'Labels & Filter anzeigen'],
    ['enableOwner', 'Bereich „Meine Tiere“'],
    ['enablePosteingang', 'Bereich „Praxis-Posteingang“'],
    ['enableNetwork', 'Bereich „Praxis-Netzwerk“'],
    ['showPinned', 'Angepinnte Chats oben'],
    ['autoSeed', 'Vorgefertigte Chats beim ersten Start'],
  ];
  return (
    <Sheet visible onClose={onClose} title="Chat-Einstellungen">
      <View style={{ gap: 6 }}>
        {rows.map(([k, label]) => (
          <View key={k} style={cs.settingRow}>
            <Text style={{ flex: 1, fontSize: 14, color: C.ink, fontWeight: '600' }}>{label}</Text>
            <RNSwitch value={!!settings[k]} onValueChange={(v) => setSetting(k, v)} trackColor={{ true: C.teal500, false: C.line }} thumbColor="#fff" />
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Btn label="Vorlagen zurücksetzen" icon="refresh" variant="secondary" style={{ flex: 1 }} onPress={() => { resetSeed(); toast('Vorlagen wiederhergestellt.', 'success'); onClose(); }} />
          <Btn label="Alle löschen" variant="secondary" style={{ flex: 1 }} onPress={() => Alert.alert('Alle Chats löschen?', 'Das kann nicht rückgängig gemacht werden.', [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: () => { clearAll(); toast('Alle Chats gelöscht.', 'info'); onClose(); } }])} />
        </View>
      </View>
    </Sheet>
  );
}

/* ---- Chat-Zeile ---- */
function ChatRow({ chat, labels, onOpen, onMenu }) {
  const last = chat.messages[chat.messages.length - 1];
  const lastText = last ? (last.type === 'note' ? 'Abschlussnotiz' : last.type === 'image' ? '📷 Bild' : last.text) : 'Noch keine Nachricht';
  const chatLabels = (chat.labels || []).map((id) => labels.find((l) => l.id === id)).filter(Boolean);
  return (
    <TouchableOpacity style={cs.row} activeOpacity={0.7} onPress={onOpen} onLongPress={onMenu}>
      <View style={[cs.avatar, { backgroundColor: chat.color + '22' }]}><Glyph name={chat.icon} s={20} c={chat.color} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {chat.pinned ? <VNIcon.star s={12} c={C.yellow} fill={C.yellow} /> : null}
          <Text style={cs.name} numberOfLines={1}>{chat.title}</Text>
        </View>
        <Text style={cs.snippet} numberOfLines={1}>{lastText}</Text>
        {chatLabels.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {chatLabels.map((l) => <Text key={l.id} style={[cs.pill, { color: l.color, backgroundColor: l.color + '1a' }]}>{l.name}</Text>)}
          </View>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {chat.unread > 0 ? <View style={cs.unread}><Text style={cs.unreadText}>{chat.unread}</Text></View> : null}
        <TouchableOpacity onPress={onMenu} hitSlop={8}><VNIcon.chevron s={16} c={C.ink3} /></TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatsScreen({ navigation }) {
  const cx = useChats();
  const { visibleChats, labels, settings } = cx;
  const [filter, setFilter] = React.useState(null);
  const [editor, setEditor] = React.useState(null);
  const [labelMgr, setLabelMgr] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  let list = filter ? visibleChats.filter((c) => (c.labels || []).includes(filter) || c.role === filter) : visibleChats;
  if (settings.showPinned) list = [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const openMenu = (chat) => {
    Alert.alert(chat.title, chat.sub || '', [
      { text: 'Öffnen', onPress: () => navigation.navigate('ChatThread', { chatId: chat.id }) },
      { text: 'Bearbeiten', onPress: () => setEditor(chat) },
      { text: chat.pinned ? 'Loslösen' : 'Anpinnen', onPress: () => cx.togglePin(chat.id) },
      { text: 'Löschen', style: 'destructive', onPress: () => { cx.deleteChat(chat.id); toast('Chat gelöscht.', 'info'); } },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.surface2 }}>
      <ScrollView contentContainerStyle={{ padding: S.s5, gap: S.s3, paddingBottom: S.s8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <H2>Chats</H2>
            <Meta style={{ marginTop: 0 }}>{visibleChats.length} {visibleChats.length === 1 ? 'Unterhaltung' : 'Unterhaltungen'}</Meta>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={cs.headBtn} onPress={() => setLabelMgr(true)}><VNIcon.filter s={18} c={C.ink2} /></TouchableOpacity>
            <TouchableOpacity style={cs.headBtn} onPress={() => setSettingsOpen(true)}><VNIcon.refresh s={18} c={C.ink2} /></TouchableOpacity>
            <Btn label="Neu" icon="plus" size="sm" onPress={() => setEditor('new')} />
          </View>
        </View>

        {settings.showLabels && labels.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            <TouchableOpacity style={[cs.filterChip, filter === null && { backgroundColor: C.teal50, borderColor: C.teal100 }]} onPress={() => setFilter(null)}>
              <Text style={[cs.filterText, filter === null && { color: C.teal700 }]}>Alle</Text>
            </TouchableOpacity>
            {labels.map((l) => (
              <TouchableOpacity key={l.id} style={[cs.filterChip, { borderColor: filter === l.id ? l.color : C.line2, backgroundColor: filter === l.id ? l.color + '22' : C.surface3 }]} onPress={() => setFilter(filter === l.id ? null : l.id)}>
                <Glyph name={l.icon} s={13} c={filter === l.id ? l.color : C.ink3} />
                <Text style={[cs.filterText, { color: filter === l.id ? l.color : C.ink2 }]}>{l.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {list.length === 0 ? (
          <Card style={{ alignItems: 'center' }}>
            <P>Keine Chats {filter ? 'mit diesem Label' : 'vorhanden'}.</P>
            <Btn label="Chat erstellen" icon="plus" size="sm" style={{ marginTop: 10 }} onPress={() => setEditor('new')} />
          </Card>
        ) : (
          <Card pad={false}>
            {list.map((c, i) => (
              <View key={c.id} style={i > 0 ? { borderTopWidth: 1, borderTopColor: C.line2 } : null}>
                <ChatRow chat={c} labels={labels} onOpen={() => navigation.navigate('ChatThread', { chatId: c.id })} onMenu={() => openMenu(c)} />
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {editor ? (
        <ChatEditor initial={editor === 'new' ? null : editor} labels={labels}
          onClose={() => setEditor(null)}
          onSave={(data) => {
            if (editor === 'new') { const id = cx.createChat(data); toast('Chat erstellt.', 'success'); setEditor(null); navigation.navigate('ChatThread', { chatId: id }); }
            else { cx.updateChat(editor.id, data); toast('Chat gespeichert.', 'success'); setEditor(null); }
          }} />
      ) : null}
      {labelMgr ? <LabelManager labels={labels} onClose={() => setLabelMgr(false)} createLabel={cx.createLabel} updateLabel={cx.updateLabel} deleteLabel={cx.deleteLabel} /> : null}
      {settingsOpen ? <ChatSettings settings={settings} setSetting={cx.setSetting} onClose={() => setSettingsOpen(false)} resetSeed={cx.resetSeed} clearAll={cx.clearAll} /> : null}
    </View>
  );
}

const cs = StyleSheet.create({
  headBtn: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: C.line2, backgroundColor: C.surface3, borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 11 },
  filterText: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14.5, fontWeight: '700', color: C.ink, flexShrink: 1 },
  snippet: { fontSize: 12.5, color: C.ink3, marginTop: 2 },
  pill: { fontSize: 10.5, fontWeight: '700', paddingVertical: 2, paddingHorizontal: 7, borderRadius: R.pill, overflow: 'hidden' },
  unread: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.teal600, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  modalBg: { flex: 1, backgroundColor: 'rgba(17,32,30,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  roleBtn: { flex: 1, borderWidth: 1.5, borderColor: C.line, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' },
  labelChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 10 },
  labelChipText: { fontSize: 12.5, fontWeight: '600' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line2 },
  smallBtn: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line2 },
});
