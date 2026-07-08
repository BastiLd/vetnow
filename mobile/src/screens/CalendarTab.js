/* Termine-Tab: voller Kalender (Tag / Woche / Monat) — 1:1-Portierung von screens-f.jsx,
   inkl. Termin-Detail (Bestätigen / Abschließen mit Notiz / Absagen), Neuer Termin & Blockzeit. */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { C, S, R, STATUS_COLOR } from '../theme';
import { Card, SectionLabel, Notice, Btn, Field, Input, ChoiceGrid, Meta, P, toast } from '../components';
import { VNIcon, AnimalGlyph, ANIMAL_ICON } from '../icons';
import { APPT_STATUS, ANIMAL_LABEL, ANIMALS, MONTHS_DE, DOW_DE, blocksFor } from '../data';
import { useAppState } from '../lib/AdminContext';
import { useChats } from '../lib/ChatContext';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseISO = (iso) => new Date(iso + 'T00:00:00');
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return ymd(d); };
const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function ApptTag({ status }) {
  const stt = APPT_STATUS[status];
  const sc = STATUS_COLOR[stt.cls] || STATUS_COLOR.grey;
  return (
    <View style={[cs.apptTag, { backgroundColor: sc.bg }]}>
      {status === 'done' ? <VNIcon.check s={11} c={sc.ink} /> : null}
      <Text style={[cs.apptTagText, { color: sc.ink }]}>{stt.label}</Text>
    </View>
  );
}

function StatusDots({ list }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3, marginTop: 3 }}>
      {list.slice(0, 4).map((s, i) => (
        <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: STATUS_COLOR[APPT_STATUS[s].cls]?.dot || C.grey }} />
      ))}
    </View>
  );
}

/* ---- Modal-Hülle ---- */
function Sheet({ visible, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={cs.modalBg} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={cs.modal}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18 }}>
              {children}
            </ScrollView>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

function ModalHead({ title, onClose }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <Text style={{ fontSize: 16.5, fontWeight: '700', color: C.ink }}>{title}</Text>
      <TouchableOpacity onPress={onClose} hitSlop={8} style={cs.iconBtn}><VNIcon.x s={18} c={C.ink2} /></TouchableOpacity>
    </View>
  );
}

/* ---- Termin-Detail: Status ändern + Abschlussnotiz ---- */
function ApptModal({ appt, onClose, onStatus, onComplete }) {
  const [noteMode, setNoteMode] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [noteText, setNoteText] = React.useState(appt.note || 'Behandlung verlief gut, bitte weiter beobachten.');
  return (
    <Sheet visible onClose={onClose}>
      <ModalHead title={'Termin · ' + appt.time} onClose={onClose} />
      <View style={{ gap: 9 }}>
        <View style={cs.kvRow}><VNIcon.user s={15} c={C.ink3} /><Text style={cs.kvText}>{appt.name}</Text></View>
        <View style={cs.kvRow}><AnimalGlyph animal={appt.animal} s={15} c={C.ink3} /><Text style={cs.kvText}>{ANIMAL_LABEL[appt.animal]}</Text></View>
        <View style={cs.kvRow}><VNIcon.siren s={15} c={C.ink3} /><Text style={cs.kvText}>{appt.reason}</Text></View>
        <ApptTag status={appt.status} />
        {appt.note ? (
          <View style={cs.noteBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <VNIcon.note s={14} c={C.blueInk} />
              <Text style={cs.noteLabel}>Abschlussnotiz</Text>
            </View>
            <Text style={cs.noteBody}>{appt.note}</Text>
          </View>
        ) : null}
      </View>

      {!noteMode ? (
        <View style={{ marginTop: 18, gap: 8 }}>
          <SectionLabel style={{ marginBottom: 2 }}>Status ändern</SectionLabel>
          <Btn label="Bestätigen" icon="check" variant="secondary" block onPress={() => { onStatus('confirmed'); toast('Termin bestätigt.', 'success'); }} />
          <Btn label="Abschließen" icon="checkCircle" block onPress={() => setNoteMode(true)} />
          {confirmCancel
            ? <Btn label="Wirklich absagen?" icon="alert" variant="danger" block onPress={() => { onStatus('cancelled'); toast('Termin abgesagt.', 'info'); onClose(); }} />
            : <Btn label="Absagen" icon="x" variant="secondary" block style={{ borderColor: C.redBg }} onPress={() => setConfirmCancel(true)} />}
        </View>
      ) : (
        <View style={{ marginTop: 18 }}>
          <SectionLabel style={{ marginBottom: 8 }}>Abschlussnotiz für Tierhalter:in</SectionLabel>
          <Input value={noteText} onChangeText={setNoteText} multiline placeholder="z. B. Behandlung verlief gut, bitte weiter beobachten." />
          <Meta style={{ marginVertical: 8 }}>Die Notiz erscheint als Abschluss-Nachricht im Chat mit der/dem Tierhalter:in.</Meta>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn label="Zurück" variant="secondary" style={{ flex: 1 }} onPress={() => setNoteMode(false)} />
            <Btn label="Senden" icon="send" style={{ flex: 1 }} onPress={() => {
              if (!noteText.trim()) { toast('Bitte Notiz eingeben.', 'error'); return; }
              onComplete(noteText.trim());
              toast('Termin abgeschlossen, Notiz gesendet.', 'success');
              onClose();
            }} />
          </View>
        </View>
      )}
    </Sheet>
  );
}

/* ---- Neuer Termin (Demo) ---- */
function NewApptModal({ onClose }) {
  const [animal, setAnimal] = React.useState(null);
  const [time, setTime] = React.useState(null);
  const TIMES = ['Vormittag (8–12 Uhr)', 'Mittag (12–14 Uhr)', 'Nachmittag (14–17 Uhr)', 'Abend (ab 17 Uhr)', 'So bald wie möglich'];
  return (
    <Sheet visible onClose={onClose}>
      <ModalHead title="Neuen Termin anlegen" onClose={onClose} />
      <View style={{ gap: 14 }}>
        <Field label="Tierhalter:in / Tier"><Input placeholder="z. B. Mimi (Frau Wieser)" /></Field>
        <Field label="Tierart">
          <ChoiceGrid options={ANIMALS.map((a) => ({ ...a, icon: ANIMAL_ICON[a.key] }))} value={animal} onChange={setAnimal} />
        </Field>
        <Field label="Wunschdatum"><Input defaultValue="04.06.2026" /></Field>
        <Field label="Bevorzugte Uhrzeit">
          <ChoiceGrid options={TIMES.map((t) => ({ key: t, label: t }))} value={time} onChange={setTime} cols={1} />
        </Field>
        <Field label="Grund"><Input placeholder="z. B. Kontrolle" /></Field>
        <Btn label="Termin speichern" size="lg" block onPress={() => { toast('Termin angelegt.', 'success'); onClose(); }} />
      </View>
    </Sheet>
  );
}

/* ---- Blockzeit (Demo) ---- */
function BlockModal({ onClose }) {
  return (
    <Sheet visible onClose={onClose}>
      <ModalHead title="Blockzeit eintragen" onClose={onClose} />
      <Meta style={{ marginBottom: 12 }}>Blockzeiten (z. B. Mittagspause, OP-Zeiten) werden im Kalender als graue Balken markiert und nicht zur Terminbuchung freigegeben.</Meta>
      <View style={{ gap: 14 }}>
        <Field label="Bezeichnung"><Input placeholder="z. B. Mittagspause, OP-Zeit" /></Field>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field label="Von" style={{ flex: 1 }}><Input defaultValue="12:00" /></Field>
          <Field label="Bis" style={{ flex: 1 }}><Input defaultValue="13:00" /></Field>
        </View>
        <Btn label="Blockzeit speichern" size="lg" block onPress={() => { toast('Blockzeit eingetragen.', 'success'); onClose(); }} />
      </View>
    </Sheet>
  );
}

/* ---- Monat/Jahr-Auswahl ---- */
function MonthYearPicker({ y, m, onPick, onClose }) {
  const [year, setYear] = React.useState(y);
  return (
    <Sheet visible onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 14 }}>
        <TouchableOpacity style={cs.iconBtn} onPress={() => setYear((v) => v - 1)}><VNIcon.back s={18} c={C.ink2} /></TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '800', color: C.ink }}>{year}</Text>
        <TouchableOpacity style={cs.iconBtn} onPress={() => setYear((v) => v + 1)}><VNIcon.chevronR s={18} c={C.ink2} /></TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {MONTHS_DE.map((name, i) => {
          const on = i === m && year === y;
          return (
            <TouchableOpacity key={i} style={[cs.monBtn, on && { backgroundColor: C.teal50, borderColor: C.teal600 }]} onPress={() => onPick(year, i)}>
              <Text style={[{ fontSize: 13.5, fontWeight: '600', color: C.ink }, on && { color: C.teal700, fontWeight: '700' }]}>{name.slice(0, 3)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Sheet>
  );
}

/* ---- Tages-Timeline ---- */
function DayTimeline({ iso, appts, onOpen, onNew }) {
  const d = parseISO(iso);
  const longTitle = WD_LONG[d.getDay()] + ', ' + pad(d.getDate()) + '. ' + MONTHS_DE[d.getMonth()];
  const blocks = blocksFor(iso).map((b) => ({ ...b, block: true }));
  const items = appts.map((a, i) => ({ ...a, _idx: i }));
  const timeline = [...items, ...blocks].sort((x, y) => (x.time < y.time ? -1 : x.time > y.time ? 1 : 0));

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{longTitle}</Text>
        <Meta style={{ marginTop: 0 }}>{appts.length === 0 ? 'Keine Termine' : appts.length + (appts.length === 1 ? ' Termin' : ' Termine')}</Meta>
      </View>

      {timeline.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <VNIcon.cal s={24} c={C.ink3} />
          <P style={{ marginTop: 8 }}>Für diesen Tag sind keine Termine eingetragen.</P>
          <Btn label="Termin anlegen" icon="plus" variant="secondary" size="sm" style={{ marginTop: 12 }} onPress={onNew} />
        </Card>
      ) : (
        <View style={{ gap: 8 }}>
          {timeline.map((item, i) =>
            item.block ? (
              <View key={'b' + i} style={cs.blockBar}>
                <Text style={cs.blockTime}>{item.time}</Text>
                <VNIcon.clock s={14} c={C.greyInk} />
                <Text style={cs.blockLabel}>{item.label} ({item.time}–{item.end})</Text>
              </View>
            ) : (
              <TouchableOpacity key={i} activeOpacity={0.7} onPress={() => onOpen(item._idx)}>
                <Card pad={false} style={[{ padding: 12 }, item.status === 'cancelled' && { opacity: 0.55 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={cs.apptTime}>{item.time}</Text>
                    <View style={cs.apptIcon}><AnimalGlyph animal={item.animal} s={18} c={C.teal700} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={cs.apptName} numberOfLines={1}>{item.name}</Text>
                      <Meta numberOfLines={1}>{item.note ? item.note : item.reason}</Meta>
                    </View>
                    <ApptTag status={item.status} />
                  </View>
                </Card>
              </TouchableOpacity>
            )
          )}
        </View>
      )}
    </View>
  );
}

/* ---- Haupt-Kalender ---- */
export default function CalendarTab() {
  const { data: D, clinicAppts, setApptStatus, completeAppt } = useAppState();
  const { addMessage, chatById } = useChats();
  const completeWithNote = (iso, idx, note) => {
    const convoId = completeAppt(iso, idx, note);
    if (convoId) { const cid = 'ch-' + convoId; if (chatById(cid)) addMessage(cid, { type: 'note', text: note, time: 'jetzt' }); }
  };
  const today = D.TODAY_ISO;
  const [view, setView] = React.useState('day');
  const [sel, setSel] = React.useState(today);
  const selD = parseISO(sel);
  const [cursor, setCursor] = React.useState({ y: selD.getFullYear(), m: selD.getMonth() });
  const [pickOpen, setPickOpen] = React.useState(false);
  const [modal, setModal] = React.useState(null); // {idx} | 'new' | 'block'

  const apptsOf = (iso) => clinicAppts[iso] || [];
  const dayAppts = apptsOf(sel);

  // Woche (Mo–So) um sel
  const mon0 = (selD.getDay() + 6) % 7;
  const monday = new Date(selD); monday.setDate(selD.getDate() - mon0);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });

  // Monatsraster (6 Wochen)
  const first = new Date(cursor.y, cursor.m, 1);
  const startW = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startW; i++) { const d = new Date(cursor.y, cursor.m, 1 - (startW - i)); cells.push(d); }
  const dim = new Date(cursor.y, cursor.m + 1, 0).getDate();
  for (let day = 1; day <= dim; day++) cells.push(new Date(cursor.y, cursor.m, day));
  while (cells.length < 42) { const last = cells[cells.length - 1]; const nd = new Date(last); nd.setDate(last.getDate() + 1); cells.push(nd); }

  const monthTitle = MONTHS_DE[cursor.m] + ' ' + cursor.y;
  const dayTitle = pad(selD.getDate()) + '. ' + MONTHS_DE[selD.getMonth()] + ' ' + selD.getFullYear();
  const weekTitle = (() => {
    const a = weekDays[0], b = weekDays[6];
    return pad(a.getDate()) + '. ' + MONTHS_DE[a.getMonth()].slice(0, 3) + ' – ' + pad(b.getDate()) + '. ' + MONTHS_DE[b.getMonth()].slice(0, 3);
  })();

  const goPrev = () => {
    if (view === 'month') setCursor((c) => { const m = c.m - 1; return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m }; });
    else if (view === 'week') setSel((s) => addDays(s, -7));
    else setSel((s) => addDays(s, -1));
  };
  const goNext = () => {
    if (view === 'month') setCursor((c) => { const m = c.m + 1; return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m }; });
    else if (view === 'week') setSel((s) => addDays(s, 7));
    else setSel((s) => addDays(s, 1));
  };
  const goToday = () => { setSel(today); const d = parseISO(today); setCursor({ y: d.getFullYear(), m: d.getMonth() }); };
  const pickDay = (d) => { setSel(ymd(d)); setView('day'); };

  const title = view === 'month' ? monthTitle : view === 'week' ? weekTitle : dayTitle;

  return (
    <View style={{ gap: S.s4 }}>
      <Notice type="warn">Keine medizinische Beratung. Bei akuten Notfällen bitte immer telefonisch Kontakt aufnehmen.</Notice>

      {/* Toolbar */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity style={cs.iconBtn} onPress={goPrev}><VNIcon.back s={18} c={C.ink2} /></TouchableOpacity>
          {view === 'month' ? (
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} onPress={() => setPickOpen(true)}>
              <Text style={cs.calTitle}>{title}</Text>
              <VNIcon.chevron s={15} c={C.ink2} />
            </TouchableOpacity>
          ) : (
            <Text style={cs.calTitle}>{title}</Text>
          )}
          <TouchableOpacity style={cs.iconBtn} onPress={goNext}><VNIcon.chevronR s={18} c={C.ink2} /></TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Btn label="Heute" variant="secondary" size="sm" onPress={goToday} />
          <View style={cs.viewSeg}>
            {[['day', 'Tag'], ['week', 'Woche'], ['month', 'Monat']].map(([k, l]) => (
              <TouchableOpacity key={k} style={[cs.segBtn, view === k && cs.segOn]} onPress={() => setView(k)}>
                <Text style={[cs.segText, view === k && { color: C.teal700, fontWeight: '700' }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="Neuer Termin" icon="plus" size="sm" onPress={() => setModal('new')} />
        <Btn label="Blockzeit" icon="plus" variant="secondary" size="sm" onPress={() => setModal('block')} />
      </View>

      {/* Legende */}
      <View style={cs.legend}>
        {[['yellow', 'Offen'], ['blue', 'Bestätigt'], ['green', 'Erledigt'], ['red', 'Abgesagt'], ['grey', 'Blockzeit']].map(([c, l]) => (
          <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_COLOR[c].dot }} />
            <Meta style={{ marginTop: 0 }}>{l}</Meta>
          </View>
        ))}
      </View>

      {/* Monat */}
      {view === 'month' ? (
        <Card>
          <View style={{ flexDirection: 'row' }}>
            {DOW_DE.map((d) => <Text key={d} style={cs.dow}>{d}</Text>)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((d, i) => {
              const iso = ymd(d);
              const muted = d.getMonth() !== cursor.m;
              const isToday = iso === today;
              const isSel = iso === sel;
              const list = apptsOf(iso);
              return (
                <TouchableOpacity key={i} style={[cs.cell, isSel && cs.cellSel, isToday && cs.cellToday]} onPress={() => pickDay(d)}>
                  <Text style={[cs.cellNum, muted && { color: C.ink3, opacity: 0.5 }, isToday && { color: C.teal700, fontWeight: '800' }]}>{d.getDate()}</Text>
                  {list.length > 0 ? <StatusDots list={list.map((a) => a.status)} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      ) : null}

      {/* Woche */}
      {view === 'week' ? (
        <View style={{ flexDirection: 'row', gap: 5 }}>
          {weekDays.map((d, i) => {
            const iso = ymd(d);
            const list = apptsOf(iso);
            const isToday = iso === today; const isSel = iso === sel;
            return (
              <TouchableOpacity key={i} style={[cs.weekDay, isSel && { borderColor: C.teal600, backgroundColor: C.teal50 }, isToday && !isSel && { borderColor: C.teal100 }]} onPress={() => pickDay(d)}>
                <Meta style={{ marginTop: 0 }}>{DOW_DE[i]}</Meta>
                <Text style={[cs.weekNum, isToday && { color: C.teal700 }]}>{d.getDate()}</Text>
                <Meta style={{ marginTop: 0, fontSize: 10.5 }}>{list.length > 0 ? list.length : '–'}</Meta>
                {list.length > 0 ? <StatusDots list={list.map((a) => a.status)} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {/* Tages-Timeline (bei Tag & Woche) */}
      {(view === 'day' || view === 'week') ? (
        <DayTimeline iso={sel} appts={dayAppts} onOpen={(idx) => setModal({ idx })} onNew={() => setModal('new')} />
      ) : null}

      {modal === 'new' ? <NewApptModal onClose={() => setModal(null)} /> : null}
      {modal === 'block' ? <BlockModal onClose={() => setModal(null)} /> : null}
      {modal && typeof modal === 'object' && dayAppts[modal.idx] ? (
        <ApptModal
          appt={dayAppts[modal.idx]}
          onClose={() => setModal(null)}
          onStatus={(stx) => setApptStatus(sel, modal.idx, stx)}
          onComplete={(note) => completeWithNote(sel, modal.idx, note)}
        />
      ) : null}
      {pickOpen && view === 'month' ? (
        <MonthYearPicker y={cursor.y} m={cursor.m} onClose={() => setPickOpen(false)}
          onPick={(yy, mm) => { setCursor({ y: yy, m: mm }); setPickOpen(false); }} />
      ) : null}
    </View>
  );
}

const cs = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(17,32,30,0.45)', justifyContent: 'center', padding: 18 },
  modal: { backgroundColor: C.surface, borderRadius: R.xl, maxHeight: 560, overflow: 'hidden' },
  iconBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  calTitle: { fontSize: 15.5, fontWeight: '700', color: C.ink },
  viewSeg: { flex: 1, flexDirection: 'row', backgroundColor: C.surface3, borderRadius: R.pill, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 7, borderRadius: R.pill, alignItems: 'center' },
  segOn: { backgroundColor: C.surface, shadowColor: C.ink, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  dow: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: C.ink3, paddingBottom: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 0.9, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  cellSel: { backgroundColor: C.teal50, borderWidth: 1.5, borderColor: C.teal600 },
  cellToday: { borderWidth: 1, borderColor: C.teal100 },
  cellNum: { fontSize: 13.5, fontWeight: '600', color: C.ink },
  weekDay: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2, borderWidth: 1.5, borderColor: C.line, borderRadius: R.md, backgroundColor: C.surface },
  weekNum: { fontSize: 15, fontWeight: '800', color: C.ink },
  blockBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.greyBg, borderRadius: R.md, padding: 10 },
  blockTime: { fontSize: 13, fontWeight: '700', color: C.greyInk },
  blockLabel: { flex: 1, fontSize: 13, color: C.greyInk },
  apptTime: { fontSize: 13.5, fontWeight: '800', color: C.teal700, width: 42 },
  apptIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.teal50, alignItems: 'center', justifyContent: 'center' },
  apptName: { fontSize: 14, fontWeight: '700', color: C.ink },
  apptTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 9, alignSelf: 'flex-start' },
  apptTagText: { fontSize: 11.5, fontWeight: '700' },
  kvRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kvText: { fontSize: 14, color: C.ink2 },
  noteBox: { backgroundColor: C.blueBg, borderRadius: 10, padding: 11, gap: 4, marginTop: 4 },
  noteLabel: { fontSize: 11.5, fontWeight: '700', color: C.blueInk },
  noteBody: { fontSize: 13, lineHeight: 18, color: C.blueInk },
  monBtn: { width: '22.5%', paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: C.line, borderRadius: R.md },
});
