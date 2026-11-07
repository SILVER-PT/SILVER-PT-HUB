import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { LineChart } from "react-native-gifted-charts";
import { api, fmtDate, today, uploadFile, useFetch } from "@/src/api";
import { Btn, Card, Chip, ChipRow, Empty, ErrorText, Field, H, Loading, Screen, Sheet, T } from "@/src/ui";
import { useMediaPicker } from "@/src/media";
import { DatePicker } from "@/src/calendar";
import { useTheme } from "@/src/theme";

const blank = () => ({ section: "Emocromo", name: "", value: "", unit: "", ref_min: "", ref_max: "" });
const SECTIONS = ["Emocromo", "Glicemia", "Lipidi", "Fegato", "Reni", "Tiroide", "Ormoni", "Ferro", "Vitamine", "Elettroliti", "Infiammazione", "Altro"];
const str = (v: any) => (v == null ? "" : String(v));

export default function Blood() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { data, loading, reload } = useFetch<any[]>(`/blood-tests?client_id=${clientId}`);
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const picker = useMediaPicker();

  const names = Array.from(new Set((data || []).flatMap((b) => b.values.map((v: any) => v.name))));
  const chosen = sel && names.includes(sel) ? sel : names[0];
  const pts = [...(data || [])].reverse().map((b) => ({ b, v: b.values.find((x: any) => x.name === chosen) })).filter((x) => x.v && x.v.value != null)
    .map(({ b, v }) => ({ value: v.value, label: `${b.date.slice(8, 10)}/${b.date.slice(5, 7)}`, ref: v }));

  const scan = async () => {
    setErr("");
    const a = await picker.pick("images", { base64: true });
    if (!a?.base64) return;
    setBusy("scan");
    try {
      const path = await uploadFile(a, "referto.jpg").catch(() => null);
      const r = await api("/ai/blood-scan", { method: "POST", body: { image_base64: a.base64 } });
      setForm({ date: r.date || today(), lab: r.lab || "", file_path: path, notes: "", values: (r.values || []).map((v: any) => ({ ...v, value: str(v.value), ref_min: str(v.ref_min), ref_max: str(v.ref_max) })) });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };
  const attach = async () => {
    const a = await picker.pick("images");
    if (!a) return;
    setBusy("file");
    try {
      const path = await uploadFile(a, "referto.jpg");
      setForm((f: any) => ({ ...f, file_path: path }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };
  const save = async () => {
    setBusy("save");
    setErr("");
    try {
      const body = { client_id: clientId, ...form };
      await api(form.id ? `/blood-tests/${form.id}` : "/blood-tests", { method: form.id ? "PUT" : "POST", body });
      setForm(null);
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };
  const del = async () => {
    await api(`/blood-tests/${form.id}`, { method: "DELETE" });
    setForm(null);
    reload();
  };
  const setV = (i: number, k: string, v: string) => setForm((f: any) => ({ ...f, values: f.values.map((x: any, j: number) => (j === i ? { ...x, [k]: v } : x)) }));
  const prevOf = (b: any, name: string) => {
    const idx = data!.indexOf(b);
    for (const o of data!.slice(idx + 1)) {
      const v = o.values.find((x: any) => x.name === name);
      if (v?.value != null) return v.value;
    }
    return null;
  };

  return (
    <Screen title="Analisi del sangue" back right={<Btn testID="blood-new-button" small icon="add" title="Nuovo" onPress={() => setForm({ date: today(), lab: "", notes: "", values: [blank()] })} />}>
      <Btn testID="blood-scan-button" icon="scan" variant="ghost" title="Scansiona referto con AI" loading={busy === "scan"} onPress={scan} />
      {busy === "scan" ? <T muted>Lettura del referto in corso…</T> : null}
      <ErrorText text={err} />
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? <Empty icon="water-outline" text="Nessun referto. Scansiona o inserisci i valori a mano." /> : null}
      {names.length ? (
        <>
          <H>Andamento</H>
          <ChipRow>{names.map((n) => <Chip key={n} testID={`blood-chip-${n}`} label={n} active={n === chosen} onPress={() => setSel(n)} />)}</ChipRow>
          <Card accent testID="blood-chart">
            <T style={{ fontWeight: "900" }}>{chosen} {pts[0]?.ref?.unit ? `(${pts[0].ref.unit})` : ""}</T>
            {pts[0]?.ref?.ref_min != null || pts[0]?.ref?.ref_max != null ? <T muted style={{ fontSize: 12 }}>Riferimento: {pts[0].ref.ref_min ?? "—"} – {pts[0].ref.ref_max ?? "—"}</T> : null}
            {pts.length ? (
              <View style={{ overflow: "hidden" }}>
                <LineChart data={pts} width={Math.min(width, 600) - 120} height={160} color={colors.laser} dataPointsColor={colors.onSurface} thickness={3} curved
                  noOfSections={4} rulesColor={colors.divider} yAxisColor={colors.border} xAxisColor={colors.border} yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }} spacing={Math.max(44, (Math.min(width, 600) - 180) / Math.max(1, pts.length - 1))} initialSpacing={16} />
              </View>
            ) : <T muted>Nessun valore numerico.</T>}
          </Card>
        </>
      ) : null}
      {data?.map((b) => {
        const secs = Array.from(new Set(b.values.map((v: any) => v.section))) as string[];
        return (
          <Card key={b.id} testID={`blood-card-${b.id}`} onPress={() => setForm({ ...b, values: b.values.map((v: any) => ({ ...v, value: str(v.value), ref_min: str(v.ref_min), ref_max: str(v.ref_max) })) })}>
            <T style={{ fontWeight: "900" }}>{fmtDate(b.date)}{b.lab ? ` · ${b.lab}` : ""}</T>
            {secs.map((s) => (
              <View key={s} style={{ gap: 2 }}>
                <T style={{ color: colors.brandPrimary, fontWeight: "800", fontSize: 12, marginTop: 4 }}>{s.toUpperCase()}</T>
                {b.values.filter((v: any) => v.section === s).map((v: any, i: number) => {
                  const out = v.value != null && ((v.ref_min != null && v.value < v.ref_min) || (v.ref_max != null && v.value > v.ref_max));
                  const prev = prevOf(b, v.name);
                  return (
                    <View key={i} style={{ flexDirection: "row", gap: 6 }}>
                      <T style={{ flex: 1, fontSize: 13 }}>{v.name}</T>
                      <T style={{ fontSize: 13, fontWeight: "800", color: out ? colors.warning : colors.onSurface }}>{v.value ?? "—"} {v.unit}</T>
                      {prev != null && v.value != null ? <T muted style={{ fontSize: 12, width: 64, textAlign: "right" }}>{v.value - prev >= 0 ? "▲" : "▼"} {Math.round((v.value - prev) * 100) / 100}</T> : <View style={{ width: 64 }} />}
                    </View>
                  );
                })}
              </View>
            ))}
          </Card>
        );
      })}
      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? "Modifica referto" : "Nuovo referto"}>
        {form ? (
          <>
            <DatePicker testID="blood-date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            <Field testID="blood-lab-input" label="Laboratorio" value={form.lab} onChangeText={(v) => setForm({ ...form, lab: v })} />
            <Btn small variant="dark" icon="attach" title={form.file_path ? "Referto allegato ✓" : "Allega foto del referto"} loading={busy === "file"} onPress={attach} />
            {form.values.map((v: any, i: number) => (
              <Card key={i} style={{ gap: 6 }}>
                <ChipRow>{SECTIONS.map((s) => <Chip key={s} label={s} active={v.section === s} onPress={() => setV(i, "section", s)} />)}</ChipRow>
                <Field placeholder="Sezione personalizzata" value={SECTIONS.includes(v.section) ? "" : v.section} onChangeText={(x) => setV(i, "section", x || "Altro")} />
                <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-end" }}>
                  <Field testID={`blood-name-${i}`} label="Valore" placeholder="es. Glicemia" value={v.name} onChangeText={(x) => setV(i, "name", x)} style={{ flex: 2 }} />
                  <Pressable onPress={() => setForm({ ...form, values: form.values.filter((_: any, j: number) => j !== i) })} style={{ padding: 12 }}><Ionicons name="trash-outline" size={20} color={colors.muted} /></Pressable>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Field testID={`blood-value-${i}`} label="Risultato" keyboardType="decimal-pad" value={v.value} onChangeText={(x) => setV(i, "value", x)} style={{ flex: 1 }} />
                  <Field label="Unità" value={v.unit} onChangeText={(x) => setV(i, "unit", x)} style={{ flex: 1 }} />
                  <Field label="Min" keyboardType="decimal-pad" value={v.ref_min} onChangeText={(x) => setV(i, "ref_min", x)} style={{ flex: 1 }} />
                  <Field label="Max" keyboardType="decimal-pad" value={v.ref_max} onChangeText={(x) => setV(i, "ref_max", x)} style={{ flex: 1 }} />
                </View>
              </Card>
            ))}
            <Btn testID="blood-add-value" small variant="ghost" icon="add" title="Aggiungi valore" onPress={() => setForm({ ...form, values: [...form.values, { ...blank(), section: form.values[form.values.length - 1]?.section || "Emocromo" }] })} />
            <Field label="Note" multiline value={form.notes || ""} onChangeText={(v) => setForm({ ...form, notes: v })} />
            <ErrorText text={err} />
            <Btn testID="blood-save-button" icon="save" title="Salva referto" loading={busy === "save"} onPress={save} />
            {form.id ? <Btn testID="blood-delete-button" variant="ghost" icon="trash" title="Elimina referto" onPress={del} /> : null}
          </>
        ) : null}
      </Sheet>
      {picker.element}
    </Screen>
  );
}
