import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, fmtDate, num, today, useFetch } from "@/src/api";
import { Btn, Card, Empty, ErrorText, Field, H, Loading, Screen, Sheet, Stat, T } from "@/src/ui";
import { useTheme } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { DatePicker } from "@/src/calendar";

export const CIRC = [["collo", "Collo"], ["spalle", "Spalle"], ["torace", "Torace"], ["braccio_dx", "Braccio dx"], ["braccio_sx", "Braccio sx"], ["vita", "Vita"], ["addome", "Addome (ombelico)"], ["fianchi", "Fianchi"], ["coscia_dx", "Coscia dx"], ["coscia_sx", "Coscia sx"], ["polpaccio_dx", "Polpaccio dx"], ["polpaccio_sx", "Polpaccio sx"]];
export const FOLDS = [["pettorale", "Pettorale"], ["ascellare", "Ascellare media"], ["tricipite", "Tricipite"], ["sottoscapolare", "Sottoscapolare"], ["addominale", "Addominale"], ["soprailiaca", "Soprailiaca"], ["coscia", "Coscia"]];

function Grid({ items, values, onChange, prefix }: { items: string[][]; values: any; onChange: (k: string, v: string) => void; prefix: string }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {items.map(([k, l]) => (
        <Field key={k} testID={`${prefix}-${k}-input`} label={l} keyboardType="decimal-pad" value={values[k] || ""} onChangeText={(v) => onChange(k, v)} style={{ width: "48%", flexGrow: 1 }} />
      ))}
    </View>
  );
}

export default function Measurements() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading, reload, error } = useFetch<any[]>(`/measurements?client_id=${clientId}`);
  const client = useFetch<any>(`/clients/${clientId}`);
  const { user } = useAuth();
  const canEdit = user?.role === "trainer" || (user?.role === "client" && !!user.visibility?.measurements);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [f, setF] = useState<any>({ date: today(), weight: "", height: "", circumferences: {}, skinfolds: {}, notes: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const openNew = () => {
    setEditId(null);
    setF({ date: today(), weight: "", height: String(client.data?.profile?.height || ""), circumferences: {}, skinfolds: {}, notes: "" });
    setOpen(true);
  };

  const strs = (o: any) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, String(v)]));
  const openEdit = (m: any) => {
    setEditId(m.id);
    setF({ date: m.date, weight: m.weight ? String(m.weight) : "", height: m.height ? String(m.height) : "", circumferences: strs(m.circumferences), skinfolds: strs(m.skinfolds), notes: m.notes || "" });
    setOpen(true);
  };

  const toNums = (o: any) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "").map(([k, v]) => [k, num(v)]));

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      await api(editId ? `/measurements/${editId}` : "/measurements", { method: editId ? "PUT" : "POST", body: { client_id: clientId, date: f.date, notes: f.notes, weight: num(f.weight) || null, height: num(f.height) || null,
        circumferences: toNums(f.circumferences), skinfolds: toNums(f.skinfolds) } });
      setOpen(false);
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const noAge = !client.data?.profile?.birth_date;

  const remove = async () => {
    setConfirmDel(false);
    try {
      await api(`/measurements/${editId}`, { method: "DELETE" });
      setOpen(false);
      reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <Screen title="Misure ISSA" back right={canEdit ? <Btn testID="new-measurement-button" small icon="add" title="Nuova" onPress={openNew} /> : null}>
      {error ? <Empty icon="lock-closed-outline" text={error} /> : null}
      {data && data.length > 1 ? <Btn testID="measurements-charts-button" variant="ghost" icon="stats-chart" title="Grafici misure" onPress={() => router.push(`/progress/${clientId}`)} /> : null}
      {noAge && !error ? <Card><T muted>Per il calcolo della % di grasso (Jackson-Pollock + Siri) inserisci sesso e data di nascita nel profilo.</T></Card> : null}
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? <Empty icon="body-outline" text="Nessuna misurazione registrata." /> : null}
      {data?.map((m, i) => (
        <Card key={m.id} accent={i === 0} testID={`measurement-card-${m.id}`}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <T style={{ fontWeight: "900", flex: 1 }}>{fmtDate(m.date)}</T>
            {canEdit ? <Btn testID={`measurement-edit-${m.id}`} small variant="dark" icon="create" title="Modifica" onPress={() => openEdit(m)} /> : null}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Stat label="Peso" value={m.weight} unit="kg" />
            <Stat testID={`measurement-bf-${m.id}`} label="% Grasso" value={m.body_fat} unit="%" />
            <Stat label="Magra" value={m.lean_mass} unit="kg" />
          </View>
          {m.method ? <T muted style={{ fontSize: 12 }}>{m.method} · Σ {m.sum_folds} mm{m.bmi ? ` · BMI ${m.bmi}` : ""}</T> : m.bmi ? <T muted style={{ fontSize: 12 }}>BMI {m.bmi}</T> : null}
          {Object.keys(m.circumferences || {}).length ? <H>Circonferenze (cm)</H> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {CIRC.filter(([k]) => m.circumferences?.[k]).map(([k, l]) => (
              <T key={k} style={{ fontSize: 13, width: "48%" }}><T muted style={{ fontSize: 13 }}>{l}: </T>{m.circumferences[k]}</T>
            ))}
          </View>
          {Object.keys(m.skinfolds || {}).length ? <H>Pliche (mm)</H> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {FOLDS.filter(([k]) => m.skinfolds?.[k]).map(([k, l]) => (
              <T key={k} style={{ fontSize: 13, width: "48%" }}><T muted style={{ fontSize: 13 }}>{l}: </T>{m.skinfolds[k]}</T>
            ))}
          </View>
          {m.notes ? <T muted>{m.notes}</T> : null}
        </Card>
      ))}

      <Sheet visible={open} onClose={() => setOpen(false)} title={editId ? "Modifica misurazione" : "Nuova misurazione"}>
        <T muted>Data · {f.date}</T>
        <DatePicker testID="measure-date" value={f.date} onChange={(v) => setF({ ...f, date: v })} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field testID="measure-weight-input" label="Peso kg" keyboardType="decimal-pad" value={f.weight} onChangeText={(v) => setF({ ...f, weight: v })} style={{ flex: 1 }} />
          <Field testID="measure-height-input" label="Altezza" keyboardType="decimal-pad" value={f.height} onChangeText={(v) => setF({ ...f, height: v })} style={{ flex: 1 }} />
        </View>
        <H>Circonferenze (cm)</H>
        <Grid prefix="circ" items={CIRC} values={f.circumferences} onChange={(k, v) => setF({ ...f, circumferences: { ...f.circumferences, [k]: v } })} />
        <H>Pliche (mm)</H>
        <T muted style={{ fontSize: 12, color: colors.muted }}>3 pliche: uomo pettorale/addominale/coscia, donna tricipite/soprailiaca/coscia. Con tutte e 7 si usa JP7.</T>
        <Grid prefix="fold" items={FOLDS} values={f.skinfolds} onChange={(k, v) => setF({ ...f, skinfolds: { ...f.skinfolds, [k]: v } })} />
        <Field testID="measure-notes-input" label="Note" multiline value={f.notes} onChangeText={(v) => setF({ ...f, notes: v })} />
        <ErrorText text={err} />
        <Btn testID="measure-save-button" title="Salva misurazione" loading={busy} onPress={save} />
        {editId ? <Btn testID="measure-delete-button" variant="ghost" icon="trash" title={confirmDel ? "Tocca di nuovo per confermare" : "Elimina misurazione"} onPress={() => (confirmDel ? remove() : setConfirmDel(true))} /> : null}
      </Sheet>
    </Screen>
  );
}
