import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { api, fmtDate } from "@/src/api";
import { Btn, Card, Comments, ErrorText, Field, Loading, Screen, T } from "@/src/ui";
import { makeStyles, useTheme } from "@/src/theme";

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

export default function Session() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const s = useStyles();
  const { colors } = useTheme();
  const [sess, setSess] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<{ end: number; total: number; name: string } | null>(null);
  const [now, setNow] = useState(Date.now());
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
  useEffect(() => {
    if (!sess || sess.status !== "in_progress") return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - new Date(sess.started_at).getTime()) / 1000)), 1000);
    return () => clearInterval(t);
  }, [sess]);

  if (!sess) return <Screen title="Sessione" back>{err ? <ErrorText text={err} /> : <Loading />}</Screen>;
  const live = sess.status === "in_progress";

  const persist = async (next: any, finish = false) => {
    const r = await api(`/sessions/${id}`, { method: "PUT", body: { exercises: next.exercises, notes: next.notes || "", finish } });
    return r;
  };

  const setVal = (ei: number, si: number, k: string, v: any) => {
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
      if (secs > 0) { setNow(Date.now()); setRest({ end: Date.now() + secs * 1000, total: secs, name: c.exercises[ei].name }); }
    }
    setSess(c);
    persist(c).catch((e) => setErr(e.message));
  };

  const finish = async () => {
    setBusy(true);
    try {
      setSess(await persist(sess, true));
      router.back();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doneSets = sess.exercises.reduce((a: number, e: any) => a + e.sets.filter((x: any) => x.completed).length, 0);
  const totSets = sess.exercises.reduce((a: number, e: any) => a + e.sets.length, 0);
  const mm = fmtSec(elapsed);
  const dur = sess.finished_at ? Math.round((new Date(sess.finished_at).getTime() - new Date(sess.started_at).getTime()) / 60000) : 0;

  const cell = (ei: number, si: number, k: string, st: any, w = 54) => (
    <TextInput
      testID={`set-${k}-${ei}-${si}`}
      editable={live}
      value={st[k] == null ? "" : String(st[k])}
      onChangeText={(v) => setVal(ei, si, k, v)}
      keyboardType="decimal-pad"
      placeholder={k === "execution" ? "1-10" : String(st[k.replace("done", "planned")] ?? "")}
      placeholderTextColor={colors.muted}
      style={[s.cell, { width: w }]}
    />
  );

  return (
    <Screen title={sess.day_name} back>
      <Card accent testID="session-header-card" style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <T muted style={{ fontSize: 12, fontWeight: "700" }}>{sess.plan_name.toUpperCase()}</T>
          <T style={{ fontWeight: "900", fontSize: 18 }}>{live ? "Sessione in corso" : `Completata · ${fmtDate(sess.started_at, true)}`}</T>
          <T muted testID="session-progress-text">{doneSets}/{totSets} serie{!live && dur ? ` · durata ${dur} min · ${new Date(sess.started_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}–${new Date(sess.finished_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : ""}</T>
        </View>
        {live ? <Text testID="session-timer" style={s.timer}>{mm}</Text> : <Ionicons name="checkmark-done-circle" size={36} color={colors.success} />}
      </Card>
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
      {sess.exercises.map((e: any, ei: number) => (
        <Card key={ei} testID={`session-exercise-${ei}`}>
          <T style={{ fontWeight: "900", fontSize: 17 }}>{e.name}{e.technique ? <T style={{ color: colors.brandPrimary, fontSize: 13 }}>{`  · ${e.technique}`}</T> : null}</T>
          {e.protocol ? <T muted style={{ fontSize: 12, fontWeight: "800" }}>{e.protocol.toUpperCase()}</T> : null}
          {e.notes || e.rest ? <T muted style={{ fontSize: 13 }}>{e.rest ? `Recupero ${e.rest}` : ""}{e.notes ? ` · ${e.notes}` : ""}</T> : null}
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
              <Pressable testID={`set-complete-${ei}-${si}`} disabled={!live} onPress={() => toggle(ei, si)} style={[s.check, st.completed && s.checkOn]}>
                <Ionicons name="checkmark" size={18} color={st.completed ? colors.onBrandPrimary : colors.muted} />
              </Pressable>
            </View>
          ))}
        </Card>
      ))}
      <T muted style={{ fontSize: 12 }}>Ese = qualità di esecuzione da 1 a 10. Tocca ✓ per salvare la serie.</T>
      <Field testID="session-notes-input" label="Note sessione" multiline editable={live} value={sess.notes} onChangeText={(v) => setSess((p: any) => ({ ...p, notes: v }))} />
      <ErrorText text={err} />
      {live ? <Btn testID="session-finish-button" icon="flag" title="Termina sessione" loading={busy} onPress={finish} /> : null}
      {!live ? (
        <Comments items={sess.comments || []} onSend={async (text) => { await api(`/sessions/${id}/comments`, { method: "POST", body: { text } }); load(); }} />
      ) : null}
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
