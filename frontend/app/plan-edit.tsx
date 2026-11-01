import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api } from "@/src/api";
import { Btn, Card, ErrorText, Field, Loading, Screen, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

const newEx = () => ({ name: "", sets: "3", reps: "10", load: "", rir: "2", rest: "90s", notes: "" });

export default function PlanEdit() {
  const { clientId, planId } = useLocalSearchParams<{ clientId: string; planId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [plan, setPlan] = useState<any>(planId ? null : { name: "", notes: "", days: [{ name: "Giorno A", exercises: [newEx()] }] });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (planId) api(`/plans/${planId}`).then(setPlan).catch((e) => setErr(e.message));
  }, [planId]);

  if (!plan) return <Screen title="Scheda" back><Loading /></Screen>;

  const upd = (fn: (p: any) => void) => setPlan((p: any) => { const c = JSON.parse(JSON.stringify(p)); fn(c); return c; });

  const save = async () => {
    if (!plan.name.trim()) return setErr("Inserisci il nome della scheda");
    setBusy(true);
    try {
      const body = { client_id: clientId, name: plan.name, notes: plan.notes, days: plan.days };
      if (planId) await api(`/plans/${planId}`, { method: "PUT", body });
      else await api("/plans", { method: "POST", body });
      router.back();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={planId ? "Modifica scheda" : "Nuova scheda"} back>
      <Field testID="plan-name-input" label="Nome scheda" placeholder="es. Ipertrofia - Blocco 1" value={plan.name} onChangeText={(v) => upd((p) => { p.name = v; })} />
      <Field testID="plan-notes-input" label="Note" multiline value={plan.notes} onChangeText={(v) => upd((p) => { p.notes = v; })} />
      {plan.days.map((d: any, di: number) => (
        <Card key={di} accent testID={`plan-day-${di}`}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
            <Field testID={`day-name-input-${di}`} label={`Giorno ${di + 1}`} value={d.name} onChangeText={(v) => upd((p) => { p.days[di].name = v; })} style={{ flex: 1 }} />
            <Pressable testID={`day-remove-${di}`} onPress={() => upd((p) => { p.days.splice(di, 1); })} style={{ padding: 12 }}>
              <Ionicons name="trash-outline" size={20} color={colors.muted} />
            </Pressable>
          </View>
          {d.exercises.map((e: any, ei: number) => {
            const f = (k: string) => (v: string) => upd((p) => { p.days[di].exercises[ei][k] = v; });
            return (
              <View key={ei} style={{ gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.divider }}>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                  <Field testID={`ex-name-${di}-${ei}`} label={`Esercizio ${ei + 1}`} placeholder="es. Panca piana" value={e.name} onChangeText={f("name")} style={{ flex: 1 }} />
                  <Pressable testID={`ex-remove-${di}-${ei}`} onPress={() => upd((p) => { p.days[di].exercises.splice(ei, 1); })} style={{ padding: 12 }}>
                    <Ionicons name="close-circle-outline" size={22} color={colors.muted} />
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Field testID={`ex-sets-${di}-${ei}`} label="Serie" keyboardType="number-pad" value={String(e.sets)} onChangeText={f("sets")} style={{ flex: 1 }} />
                  <Field testID={`ex-reps-${di}-${ei}`} label="Rip" value={String(e.reps)} onChangeText={f("reps")} style={{ flex: 1 }} />
                  <Field testID={`ex-load-${di}-${ei}`} label="Kg" keyboardType="decimal-pad" value={String(e.load)} onChangeText={f("load")} style={{ flex: 1 }} />
                  <Field testID={`ex-rir-${di}-${ei}`} label="RIR" keyboardType="number-pad" value={String(e.rir)} onChangeText={f("rir")} style={{ flex: 1 }} />
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Field testID={`ex-rest-${di}-${ei}`} label="Recupero" value={e.rest} onChangeText={f("rest")} style={{ width: 100 }} />
                  <Field testID={`ex-notes-${di}-${ei}`} label="Note tecniche" value={e.notes} onChangeText={f("notes")} style={{ flex: 1 }} />
                </View>
              </View>
            );
          })}
          <Btn testID={`add-exercise-${di}`} small variant="ghost" icon="add" title="Esercizio" onPress={() => upd((p) => { p.days[di].exercises.push(newEx()); })} />
        </Card>
      ))}
      <Btn testID="add-day-button" variant="dark" icon="add" title="Aggiungi giorno" onPress={() => upd((p) => { p.days.push({ name: `Giorno ${String.fromCharCode(65 + p.days.length)}`, exercises: [newEx()] }); })} />
      <ErrorText text={err} />
      <T muted style={{ fontSize: 12 }}>Il cliente vedrà la scheda subito nella sua Home.</T>
      <Btn testID="plan-save-button" icon="save" title="Salva e invia scheda" loading={busy} onPress={save} />
    </Screen>
  );
}
