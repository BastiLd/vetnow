/* VetNow — RN-Basisbausteine im Look des Web-Design-Systems (base.css/redesign.css).
   Statt SVG-Icons werden Emoji-Glyphen genutzt (bewusste Vereinfachung, keine Zusatz-Library). */
import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch as RNSwitch, StyleSheet } from 'react-native';
import { C, S, R, STATUS_COLOR } from './theme';
import { STATUS } from './data';

export const ANIMAL_EMOJI = { cat: '🐱', dog: '🐶', small: '🐰', horse: '🐴', bird: '🦜', exotic: '🐢', other: '🐾' };
export const SERVICE_EMOJI = { emergency: '🚨', regular: '📅', euthanasia: '🕊️', housecall: '🏠' };

export function Card({ children, style, pad = true }) {
  return <View style={[st.card, pad && { padding: S.s4 }, style]}>{children}</View>;
}

export function SectionLabel({ children, style }) {
  return <Text style={[st.sectionLabel, style]}>{children}</Text>;
}

export function StatusDot({ status, size = 10 }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: STATUS_COLOR[status]?.dot || C.grey }} />;
}

export function StatusBadge({ status, size }) {
  const sc = STATUS_COLOR[status] || STATUS_COLOR.grey;
  const label = STATUS[status]?.label || status;
  const big = size === 'lg';
  return (
    <View style={[st.badge, { backgroundColor: sc.bg }, big && { paddingVertical: 7, paddingHorizontal: 14 }]}>
      <StatusDot status={status} size={big ? 11 : 9} />
      <Text style={[st.badgeText, { color: sc.ink }, big && { fontSize: 14 }]}>{label}</Text>
    </View>
  );
}

export function Tag({ children, emoji, accent }) {
  return (
    <View style={[st.tag, accent && { backgroundColor: C.teal50, borderColor: C.teal100 }]}>
      {emoji ? <Text style={{ fontSize: 12 }}>{emoji}</Text> : null}
      <Text style={[st.tagText, accent && { color: C.teal700 }]}>{children}</Text>
    </View>
  );
}

export function TagRow({ children, style }) {
  return <View style={[st.tagRow, style]}>{children}</View>;
}

const NOTICE_STYLES = {
  info:   { bg: C.blueBg,   ink: C.blueInk,   icon: 'ℹ️' },
  warn:   { bg: C.yellowBg, ink: C.yellowInk, icon: '⚠️' },
  danger: { bg: C.redBg,    ink: C.redInk,    icon: '🚨' },
  grey:   { bg: C.greyBg,   ink: C.greyInk,   icon: '⚠️' },
  success:{ bg: C.greenBg,  ink: C.greenInk,  icon: '✅' },
};
export function Notice({ type = 'info', children, style }) {
  const n = NOTICE_STYLES[type] || NOTICE_STYLES.info;
  return (
    <View style={[st.notice, { backgroundColor: n.bg }, style]}>
      <Text style={{ fontSize: 14 }}>{n.icon}</Text>
      <Text style={[st.noticeText, { color: n.ink }]}>{children}</Text>
    </View>
  );
}

export function Btn({ label, onPress, variant = 'primary', size, block, style, disabled }) {
  const v = variant;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[
        st.btn,
        v === 'primary' && { backgroundColor: C.teal600 },
        v === 'secondary' && { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
        v === 'ghost' && { backgroundColor: 'transparent' },
        v === 'danger' && { backgroundColor: C.red },
        size === 'lg' && { paddingVertical: 15 },
        size === 'sm' && { paddingVertical: 8, paddingHorizontal: 12 },
        block && { alignSelf: 'stretch' },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      <Text style={[
        st.btnText,
        (v === 'primary' || v === 'danger') && { color: '#fff' },
        v === 'secondary' && { color: C.ink },
        v === 'ghost' && { color: C.teal700 },
        size === 'lg' && { fontSize: 16 },
        size === 'sm' && { fontSize: 13 },
      ]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Field({ label, req, error, children, style }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={st.fieldLabel}>{label}{req ? <Text style={{ color: C.redInk }}> *</Text> : null}</Text>
      {children}
      {error ? <Text style={st.fieldError}>⚠️ {error}</Text> : null}
    </View>
  );
}

export function Input(props) {
  return (
    <TextInput
      placeholderTextColor={C.ink3}
      {...props}
      style={[st.input, props.hasError && { borderColor: C.red }, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]}
    />
  );
}

/* Auswahl-Raster (Single- oder Multi-Select) — Ersatz für ChoiceGroup/Selects */
export function ChoiceGrid({ options, value, onChange, multi, cols = 2 }) {
  const isSel = (k) => (multi ? (value || []).includes(k) : value === k);
  const toggle = (k) => {
    if (multi) {
      const set = new Set(value || []);
      set.has(k) ? set.delete(k) : set.add(k);
      onChange([...set]);
    } else {
      onChange(value === k ? null : k);
    }
  };
  return (
    <View style={st.choiceGrid}>
      {options.map((o) => {
        const on = isSel(o.key);
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => toggle(o.key)}
            activeOpacity={0.7}
            style={[st.choice, { width: cols === 2 ? '48.5%' : '100%' }, on && st.choiceOn]}
          >
            {o.emoji ? <Text style={{ fontSize: 15 }}>{o.emoji}</Text> : null}
            <Text style={[st.choiceText, on && { color: C.teal700, fontWeight: '700' }]} numberOfLines={1}>{o.label}</Text>
            {on ? <Text style={{ color: C.teal600, fontWeight: '800' }}>✓</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function SwitchRow({ title, sub, on, onToggle }) {
  return (
    <TouchableOpacity style={st.switchRow} onPress={() => onToggle(!on)} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <SectionLabel>{title}</SectionLabel>
        {sub ? <Text style={st.meta}>{sub}</Text> : null}
      </View>
      <RNSwitch value={on} onValueChange={onToggle} trackColor={{ true: C.teal500, false: C.line }} thumbColor="#fff" />
    </TouchableOpacity>
  );
}

export function ConfirmLine({ practice }) {
  const grey = practice.status === 'grey';
  return (
    <Text style={[st.meta, grey && { color: C.greyInk }]}>
      🕐 Zuletzt bestätigt: <Text style={{ fontWeight: '700', color: grey ? C.greyInk : C.ink2 }}>{practice.confirmedAt}</Text>
    </Text>
  );
}

export function Meta({ children, style }) {
  return <Text style={[st.meta, style]}>{children}</Text>;
}

export function H1({ children, style }) { return <Text style={[st.h1, style]}>{children}</Text>; }
export function H2({ children, style }) { return <Text style={[st.h2, style]}>{children}</Text>; }
export function H3({ children, style }) { return <Text style={[st.h3, style]}>{children}</Text>; }
export function P({ children, style }) { return <Text style={[st.p, style]}>{children}</Text>; }

export function LegendMini() {
  const items = [
    ['green', 'Grün', 'Heute bestätigt erreichbar'],
    ['yellow', 'Gelb', 'Nur nach telefonischer Rücksprache'],
    ['red', 'Rot', 'Heute nicht verfügbar'],
    ['grey', 'Grau', 'Status nicht aktuell bestätigt'],
  ];
  return (
    <Card>
      <SectionLabel style={{ marginBottom: 10 }}>Das Ampel-System</SectionLabel>
      <View style={{ gap: 8 }}>
        {items.map(([c, t, d]) => (
          <View key={c} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ marginTop: 4 }}><StatusDot status={c} /></View>
            <Text style={[st.p, { flex: 1 }]}><Text style={{ fontWeight: '700' }}>{t}</Text> — {d}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

export const st = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: C.ink,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: C.ink2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderRadius: R.pill },
  badgeText: { fontSize: 12.5, fontWeight: '700' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface3, borderWidth: 1, borderColor: C.line2, paddingVertical: 4, paddingHorizontal: 9, borderRadius: R.pill },
  tagText: { fontSize: 12.5, color: C.ink2, fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  notice: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: R.md, alignItems: 'flex-start' },
  noticeText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '700', fontSize: 14.5 },
  fieldLabel: { fontSize: 13.5, fontWeight: '600', color: C.ink },
  fieldError: { fontSize: 12.5, color: C.redInk },
  input: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingVertical: 11, paddingHorizontal: 12, fontSize: 15, color: C.ink },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.line, borderRadius: R.md, paddingVertical: 12, paddingHorizontal: 12 },
  choiceOn: { borderColor: C.teal600, backgroundColor: C.teal50 },
  choiceText: { flex: 1, fontSize: 13.5, color: C.ink, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: 14 },
  meta: { fontSize: 12.5, color: C.ink3, marginTop: 2 },
  h1: { fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: -0.5, lineHeight: 31 },
  h2: { fontSize: 21, fontWeight: '700', color: C.ink, letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: '700', color: C.ink },
  p: { fontSize: 14.5, lineHeight: 21, color: C.ink2 },
});
