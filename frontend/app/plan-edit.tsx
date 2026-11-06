import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api } from "@/src/api";
import { Btn, Card, Chip, ChipRow, ErrorText, Field, Loading, Screen, T, Toggle } from "@/src/ui";
import { useTheme } from "@/src/theme";
import { AiPlanSheet, PROTOCOLS, TECHNIQUES, applyProtocol, findMax } from "@/src/plan-tools";

const newEx = () => ({ name: "", sets: "3", reps: "10", load: "", rir: "2", rest: "90s", notes: "", type: "reps", technique: "" });
const APPROACHES = ["Ipertrofia", "Forza", "Ricomposizione", "Dimagrimento", "Powerbuilding", "Contest prep", "Ricondizionamento"];

export default function PlanEdit() {
  const { clientId, planId } = useLocalSearchParams<{ clientId: string; planId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [plan, setPlan] = useState<any>(planId ? null : { name: "", notes: "", days: [{ name: "Giorno A", exercises: [newEx()] }] });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [maxes, setMaxes] = useState<Record<string, number>>({});

  useEffect(() => {
    api(`/clients/${clientId}/maxes`).then(setMaxes).catch(() => {});
  }, [clientId]);

  useEffect(() => {
    if (planId) api(`/plans/${planId}`).then(setPlan).catch((e) => setErr(e.message));
  }, [planId]);

  if (!plan) return <Screen title="Scheda" back><Loading /></Screen>;

  const upd = (fn: (p: any) => void) => setPlan((p: any) => { const c = JSON.parse(JSON.stringify(p)); fn(c); return c; });

  const save = async () => {
    if (!plan.name.trim()) return setErr("Inserisci il nome della scheda");
    setBusy(true);
    try {
      const body = { client_id: clientId, name: plan.name, notes: plan.notes, days: plan.days, approach: plan.approach || "", active: plan.active !== false };
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
      <Btn testID="ai-plan-open-button" icon="sparkles" variant="ghost" title="Genera con AI / Guidata ISSA" onPress={() => setAiOpen(true)} />
      <AiPlanSheet visible={aiOpen} onClose={() => setAiOpen(false)} clientId={clientId} onPlan={(g) => setPlan((p: any) => ({ ...p, name: p.name || g.name || "", approach: g.approach || p.approach, notes: g.notes || p.notes, days: g.days?.length ? g.days : p.days }))} />
      <Field testID="plan-name-input" label="Nome scheda" placeholder="es. Ipertrofia - Blocco 1" value={plan.name} onChangeText={(v) => upd((p) => { p.name = v; })} />
      <Field testID="plan-notes-input" label="Note" multiline value={plan.notes} onChangeText={(v) => upd((p) => { p.notes = v; })} />
      <T muted>Approccio</T>
      <ChipRow>
        {APPROACHES.map((a) => <Chip key={a} testID={`approach-chip-${a}`} label={a} active={plan.approach === a} onPress={() => upd((p) => { p.approach = p.approach === a ? "" : a; })} />)}
      </ChipRow>
      <Field testID="plan-approach-input" placeholder="Oppure scrivi l'approccio (es. DUP, 5/3/1)" value={plan.approach || ""} onChangeText={(v) => upd((p) => { p.approach = v; })} />
      <Toggle testID="plan-active-toggle" label="Scheda attiva" hint="Se disattivata resta nello storico ma il cliente non la vede in Home" value={plan.active !== false} onChange={(v) => upd((p) => { p.active = v; })} />
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
                <ChipRow>
                  <Chip testID={`ex-type-reps-${di}-${ei}`} label="Ripetizioni" active={e.type !== "time"} onPress={() => f("type")("reps")} />
                  <Chip testID={`ex-type-time-${di}-${ei}`} label="A tempo (sec)" active={e.type === "time"} onPress={() => f("type")("time")} />
                </ChipRow>
                {e.scheme?.length ? (
                  <View style={{ gap: 4 }} testID={`ex-scheme-${di}-${ei}`}>
                    <T style={{ fontWeight: "800", fontSize: 13, color: colors.brandPrimary }}>{e.protocol}</T>
                    <T muted style={{ fontSize: 12 }}>{e.scheme.map((x: any, i: number) => `${i + 1}) ${x.reps}×${x.load}`).join("  ")}</T>
                    <Pressable testID={`ex-scheme-remove-${di}-${ei}`} style={{ minHeight: 44, justifyContent: "center" }} onPress={() => upd((p) => { const x = p.days[di].exercises[ei]; delete x.scheme; x.protocol = ""; })}>
                      <T style={{ color: colors.muted, fontSize: 12, textDecorationLine: "underline" }}>Rimuovi protocollo</T>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Field testID={`ex-sets-${di}-${ei}`} label="Serie" keyboardType="number-pad" value={String(e.sets)} onChangeText={f("sets")} style={{ flex: 1 }} />
                    <Field testID={`ex-reps-${di}-${ei}`} label={e.type === "time" ? "Sec" : "Rip"} value={String(e.reps)} onChangeText={f("reps")} style={{ flex: 1 }} />
                    <Field testID={`ex-load-${di}-${ei}`} label="Kg" keyboardType="decimal-pad" value={String(e.load)} onChangeText={f("load")} style={{ flex: 1 }} />
                    <Field testID={`ex-rir-${di}-${ei}`} label="RIR" keyboardType="number-pad" value={String(e.rir)} onChangeText={f("rir")} style={{ flex: 1 }} />
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Field testID={`ex-rest-${di}-${ei}`} label="Recupero" value={e.rest} onChangeText={f("rest")} style={{ width: 100 }} />
                  <Field testID={`ex-notes-${di}-${ei}`} label="Note tecniche" value={e.notes} onChangeText={f("notes")} style={{ flex: 1 }} />
                </View>
                <T muted style={{ fontSize: 11, fontWeight: "700" }}>TECNICA DI INTENSITÀ</T>
                <ChipRow>
                  {TECHNIQUES.map((t) => <Chip key={t} testID={`ex-tech-${di}-${ei}-${t}`} label={t} active={e.technique === t} onPress={() => f("technique")(e.technique === t ? "" : t)} />)}
                </ChipRow>
                {e.type !== "time" ? (
                  <>
                    <T muted style={{ fontSize: 11, fontWeight: "700" }}>PROTOCOLLO ISSA{findMax(maxes, e.name) ? ` · 1RM stimato ${findMax(maxes, e.name)} kg` : " · carichi in %1RM"}</T>
                    <ChipRow>
                      {PROTOCOLS.map((pr) => (
                        <Chip key={pr.name} testID={`ex-proto-${di}-${ei}-${pr.name}`} label={pr.name} active={e.protocol === pr.name}
                          onPress={() => upd((p) => { p.days[di].exercises[ei] = applyProtocol(p.days[di].exercises[ei], pr.name, findMax(maxes, e.name)); })} />
                      ))}
                    </ChipRow>
                  </>
                ) : null}
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
