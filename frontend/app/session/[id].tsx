import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { api, fmtDate } from "@/src/api";
import { Btn, Card, Comments, ErrorText, Field, Loading, Screen, Sheet, T } from "@/src/ui";
import { makeStyles, useTheme } from "@/src/theme";
import { DatePicker, TimePicker } from "@/src/calendar";
import { ExerciseImages } from "@/src/exercises";

// "90s", "2'", "2m", "1:30", "120" -> seconds
export function parseRest(r?: string) {
  const v = String(r || "").trim().toLowerCase().replace(",", ".");
  if (!v) return 0;
  const mmss = v.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const ms = v.match(/^(\d+)\s*['m]\s*(\d+)/);
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);
  const n = parseFloat(v);
  if (isNaN(n)) return 0;
  return /'|m/.test(v) ? Math.round(n * 60) : Math.round(n);
}

const fmtSec = (t: number) => `${Math.floor(t / 60)}`.padStart(2, "0") + ":" + `${t % 60}`.padStart(2, "0");
const pad = (n: number) => String(n).padStart(2, "0");
const splitIso = (iso: string) => { const d = new Date(iso); return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; };
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

export default function Session() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const s = useStyles();
  const { colors } = useTheme();
  const [sess, setSess] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<{ end: number; total: number; name: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState<any>(null);
  const [askDelete, setAskDelete] = useState(false);
  const [askEnd, setAskEnd] = useState(false);
  const dirty = useRef(false);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(sess?.client_id ? `/plans/${sess.client_id}` : "/(tabs)"));
  const beep = useAudioPlayer(require("../../assets/sounds/beep.wav"));

  useEffect(() => { setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); }, []);
  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= rest.end) {
        clearInterval(t);
        setRest(null);
        try { beep.seekTo(0); beep.play(); } catch {}
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }, 250);
    return () => clearInterval(t);
  }, [rest, beep]);
  const restLeft = rest ? Math.max(0, Math.ceil((rest.end - now) / 1000)) : 0;

  const load = () => api(`/sessions/${id}`).then(setSess).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const status = sess?.status;
  // Real-time sync: coach and client see each other's logs while the session is open.
  useEffect(() => {
    if (!status || status === "completed") return;
    const t = setInterval(() => {
      if (dirty.current) return;
      api(`/sessions/${id}`).then((r) => { if (!dirty.current) setSess(r); }).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [id, status]);
  useEffect(() => {
    if (!sess || sess.status !== "in_progress") return;
    const calc = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(sess.started_at).getTime()) / 1000) - (sess.paused_total || 0)));
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [sess]);

  if (!sess) return <Screen title="Sessione" back>{err ? <ErrorText text={err} /> : <Loading />}</Screen>;
  const live = sess.status === "in_progress";
  const paused = sess.status === "paused";
  const completed = sess.status === "completed";
  const canEdit = live || editing;

  const persist = async (next: any, extra: any = {}) => {
    const r = await api(`/sessions/${id}`, { method: "PUT", body: { exercises: next.exercises, notes: next.notes || "", finish: false, ...extra } });
    dirty.current = false;
    return r;
  };
  const flush = () => { if (dirty.current && !editing) persist(sess).catch((e) => setErr(e.message)); };

  const setVal = (ei: number, si: number, k: string, v: any) => {
    dirty.current = true;
    setSess((p: any) => { const c = JSON.parse(JSON.stringify(p)); c.exercises[ei].sets[si][k] = v; return c; });
  };

  const toggle = async (ei: number, si: number) => {
    const c = JSON.parse(JSON.stringify(sess));
    const st = c.exercises[ei].sets[si];
    st.completed = !st.completed;
    if (st.completed) {
      st.done_reps = st.done_reps ?? st.planned_reps;
      st.done_load = st.done_load ?? st.planned_load;
      st.done_rir = st.done_rir ?? st.planned_rir;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const secs = parseRest(c.exercises[ei].rest);
      if (live && secs > 0) { setNow(Date.now()); setRest({ end: Date.now() + secs * 1000, total: secs, name: c.exercises[ei].name }); }
    }
    dirty.current = true;
    setSess(c);
    if (!editing) persist(c).catch((e) => setErr(e.message));
  };

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    setErr("");
    try { await fn(); } catch (e: any) { setErr(e.message); } finally { setBusy(""); }
  };
  const state = (action: string) => run(action, async () => {
    if (dirty.current) await persist(sess);
    setRest(null);
    setSess(await api(`/sessions/${id}/state`, { method: "PUT", body: { action } }));
  });
  const saveForLater = () => run("later", async () => {
    await persist(sess);
    if (live) await api(`/sessions/${id}/state`, { method: "PUT", body: { action: "pause" } });
    goBack();
  });
  const finish = () => run("finish", async () => {
    setAskEnd(false);
    setSess(await api(`/sessions/${id}`, { method: "PUT", body: { exercises: sess.exercises, notes: sess.notes || "", finish: true } }));
    dirty.current = false;
    setRest(null);
  });
  const del = () => run("delete", async () => {
    await api(`/sessions/${id}`, { method: "DELETE" });
    setAskDelete(false);
    goBack();
  });
  const startEdit = () => {
    const a = splitIso(sess.started_at);
    const b = splitIso(sess.finished_at || sess.started_at);
    setWhen({ date: a.date, start: a.time, end: b.time });
    setEditing(true);
  };
  const saveEdit = () => run("edit", async () => {
    const st = new Date(`${when.date}T${when.start}:00`);
    let en = new Date(`${when.date}T${when.end}:00`);
    if (isNaN(st.getTime()) || isNaN(en.getTime())) throw new Error("Data o ora non valida");
    if (en < st) en = new Date(en.getTime() + 86400000);
    setSess(await persist(sess, { started_at: st.toISOString(), finished_at: en.toISOString() }));
    setEditing(false);
  });

  const doneSets = sess.exercises.reduce((a: number, e: any) => a + e.sets.filter((x: any) => x.completed).length, 0);
  const totSets = sess.exercises.reduce((a: number, e: any) => a + e.sets.length, 0);
  const dur = sess.finished_at ? Math.max(0, Math.round(((new Date(sess.finished_at).getTime() - new Date(sess.started_at).getTime()) / 1000 - (sess.paused_total || 0)) / 60)) : 0;

  const cell = (ei: number, si: number, k: string, st: any, w = 54) => (
    <TextInput
      testID={`set-${k}-${ei}-${si}`}
      editable={canEdit}
      value={st[k] == null ? "" : String(st[k])}
      onChangeText={(v) => setVal(ei, si, k, v)}
      onEndEditing={flush}
      onBlur={flush}
      keyboardType="decimal-pad"
      placeholder={k === "execution" ? "1-10" : String(st[k.replace("done", "planned")] ?? "")}
      placeholderTextColor={colors.muted}
      style={[s.cell, { width: w }, !canEdit && { opacity: 0.8 }]}
    />
  );

  return (
    <Screen title={sess.day_name} back>
      <Card accent testID="session-header-card" style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <T muted style={{ fontSize: 12, fontWeight: "700" }}>{sess.plan_name.toUpperCase()}{sess.started_by && sess.started_by !== "client" ? " · AVVIATA DAL COACH" : ""}</T>
          <T testID="session-status-text" style={{ fontWeight: "900", fontSize: 18 }}>{live ? "Sessione in corso" : paused ? "In pausa · salvata per dopo" : `Completata · ${fmtDate(sess.started_at, true)}`}</T>
          <T muted testID="session-progress-text">{doneSets}/{totSets} serie{completed && dur ? ` · durata ${dur} min · ${hhmm(sess.started_at)}–${hhmm(sess.finished_at)}` : ""}</T>
          {!completed ? <T muted style={{ fontSize: 11 }}>🔴 Sincronizzata in tempo reale con il tuo coach</T> : null}
        </View>
        {live ? <Text testID="session-timer" style={s.timer}>{fmtSec(elapsed)}</Text> : paused ? <Ionicons name="pause-circle" size={36} color={colors.warning} /> : <Ionicons name="checkmark-done-circle" size={36} color={colors.success} />}
      </Card>
      {!completed ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {live ? <Btn testID="session-pause-button" small variant="dark" icon="pause" title="Pausa" loading={busy === "pause"} onPress={() => state("pause")} /> : null}
          {paused ? <Btn testID="session-resume-button" small icon="play" title="Riprendi" loading={busy === "resume"} onPress={() => state("resume")} /> : null}
          <Btn testID="session-later-button" small variant="dark" icon="bookmark" title="Salva per dopo ed esci" loading={busy === "later"} onPress={saveForLater} />
          <Btn testID="session-stop-button" small variant="ghost" icon="stop" title="Stop" onPress={() => setAskEnd(true)} />
        </View>
      ) : null}
      {paused ? <T muted style={{ fontSize: 12 }}>Sessione in pausa: il tempo è fermo. Puoi uscire e rientrare quando vuoi dallo storico sessioni.</T> : null}
      {rest ? (
        <Card accent testID="rest-timer-card" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Ionicons name="timer" size={28} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            <T muted style={{ fontSize: 12, fontWeight: "700" }}>RECUPERO · {rest.name.toUpperCase()}</T>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginTop: 6, overflow: "hidden" }}>
              <View style={{ height: 6, width: `${(restLeft / rest.total) * 100}%`, backgroundColor: colors.brandPrimary }} />
            </View>
          </View>
          <Text testID="rest-timer-text" style={s.timer}>{fmtSec(restLeft)}</Text>
          <Pressable testID="rest-skip-button" onPress={() => setRest(null)} style={{ padding: 8 }}><Ionicons name="close" size={22} color={colors.muted} /></Pressable>
        </Card>
      ) : null}
      {editing && when ? (
        <Card accent testID="session-edit-when">
          <T style={{ fontWeight: "900" }}>Data e ora della sessione</T>
          <DatePicker testID="session-edit-date" value={when.date} onChange={(v) => setWhen({ ...when, date: v })} />
          <T muted>Inizio · {when.start}</T>
          <TimePicker value={when.start} onChange={(v) => setWhen({ ...when, start: v })} />
          <T muted>Fine · {when.end}</T>
          <TimePicker value={when.end} onChange={(v) => setWhen({ ...when, end: v })} />
        </Card>
      ) : null}
      {sess.exercises.map((e: any, ei: number) => (
        <Card key={ei} testID={`session-exercise-${ei}`}>
          <T style={{ fontWeight: "900", fontSize: 17 }}>{e.name}{e.technique ? <T style={{ color: colors.brandPrimary, fontSize: 13 }}>{`  · ${e.technique}`}</T> : null}</T>
          {e.protocol ? <T muted style={{ fontSize: 12, fontWeight: "800" }}>{e.protocol.toUpperCase()}</T> : null}
          {e.notes || e.rest ? <T muted style={{ fontSize: 13 }}>{e.rest ? `Recupero ${e.rest}` : ""}{e.notes ? ` · ${e.notes}` : ""}</T> : null}
          <ExerciseImages images={e.images} size={72} />
          <View style={s.headRow}>
            <Text style={[s.th, { width: 28 }]}>#</Text>
            <Text style={[s.th, { flex: 1 }]}>Previsto</Text>
            <Text style={[s.th, { width: 54 }]}>Kg</Text>
            <Text style={[s.th, { width: 54 }]}>{e.type === "time" ? "Sec" : "Rip"}</Text>
            <Text style={[s.th, { width: 44 }]}>RIR</Text>
            <Text style={[s.th, { width: 44 }]}>Ese</Text>
            <View style={{ width: 36 }} />
          </View>
          {e.sets.map((st: any, si: number) => (
            <View key={si} style={[s.row, st.completed && s.rowDone]}>
              <Text style={[s.idx, { width: 28 }]}>{si + 1}</Text>
              <Text style={[s.planned, { flex: 1 }]} numberOfLines={2}>{e.type === "time" ? `${st.planned_reps}s` : st.planned_reps}{st.planned_load ? `×${st.planned_load}` : ""}{st.planned_rir !== "" ? ` R${st.planned_rir}` : ""}</Text>
              {cell(ei, si, "done_load", st)}
              {cell(ei, si, "done_reps", st)}
              {cell(ei, si, "done_rir", st, 44)}
              {cell(ei, si, "execution", st, 44)}
              <Pressable testID={`set-complete-${ei}-${si}`} disabled={!canEdit} onPress={() => toggle(ei, si)} style={[s.check, st.completed && s.checkOn]}>
                <Ionicons name="checkmark" size={18} color={st.completed ? colors.onBrandPrimary : colors.muted} />
              </Pressable>
            </View>
          ))}
        </Card>
      ))}
      {paused ? <T muted style={{ fontSize: 12 }}>Premi «Riprendi» per modificare le serie.</T> : <T muted style={{ fontSize: 12 }}>Ese = qualità di esecuzione da 1 a 10. Tocca ✓ per salvare la serie.</T>}
      <Field testID="session-notes-input" label="Note sessione" multiline editable={canEdit} value={sess.notes} onChangeText={(v) => { dirty.current = true; setSess((p: any) => ({ ...p, notes: v })); }} onBlur={flush} />
      <ErrorText text={err} />
      {live ? <Btn testID="session-finish-button" icon="flag" title="Termina e salva" loading={busy === "finish"} onPress={() => setAskEnd(true)} /> : null}
      {completed && !editing ? <Btn testID="session-edit-button" variant="dark" icon="create" title="Modifica sessione (valori, data e ora)" onPress={startEdit} /> : null}
      {editing ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn testID="session-edit-save" icon="save" title="Salva modifiche" loading={busy === "edit"} onPress={saveEdit} style={{ flex: 1 }} />
          <Btn testID="session-edit-cancel" variant="ghost" title="Annulla" onPress={() => { setEditing(false); dirty.current = false; load(); }} />
        </View>
      ) : null}
      <Btn testID="session-delete-button" variant="ghost" icon="trash" title="Cancella sessione" onPress={() => setAskDelete(true)} />
      {completed && !editing ? (
        <Comments items={sess.comments || []} onSend={async (text) => { await api(`/sessions/${id}/comments`, { method: "POST", body: { text } }); load(); }} />
      ) : null}
      <Sheet visible={askEnd} onClose={() => setAskEnd(false)} title="Terminare la sessione?">
        <T>Hai completato {doneSets}/{totSets} serie. Vuoi salvarla o cancellarla?</T>
        <Btn testID="session-end-save" icon="save" title="Salva sessione" loading={busy === "finish"} onPress={finish} />
        <Btn testID="session-end-delete" variant="dark" icon="trash" title="Cancella sessione" onPress={() => { setAskEnd(false); setAskDelete(true); }} />
        <Btn variant="ghost" title="Continua ad allenarti" onPress={() => setAskEnd(false)} />
      </Sheet>
      <Sheet visible={askDelete} onClose={() => setAskDelete(false)} title="Cancellare la sessione?">
        <T>La sessione e tutti i log verranno eliminati definitivamente.</T>
        <Btn testID="session-delete-confirm" icon="trash" title="Sì, cancella" loading={busy === "delete"} onPress={del} />
        <Btn variant="ghost" title="Annulla" onPress={() => setAskDelete(false)} />
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  timer: { color: c.brandPrimary, fontSize: 28, fontWeight: "900", fontVariant: ["tabular-nums"] },
  headRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  th: { color: c.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, borderRadius: 8 },
  rowDone: { backgroundColor: c.brandTertiary },
  idx: { color: c.silver, fontWeight: "900", textAlign: "center" },
  planned: { color: c.onSurfaceTertiary, fontSize: 12 },
  cell: { height: 40, borderRadius: 8, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, color: c.onSurface, textAlign: "center", fontWeight: "700", fontSize: 14 },
  check: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
}));
