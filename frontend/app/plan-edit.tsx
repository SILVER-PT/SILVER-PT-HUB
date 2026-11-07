import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api, num } from "@/src/api";
import { Btn, Card, Chip, ChipRow, ErrorText, Field, H, Loading, Screen, Sheet, T, Toggle } from "@/src/ui";
import { useTheme } from "@/src/theme";
import { AiPlanSheet, DISTRICTS, PROTOCOLS, TECHNIQUES, applyProtocol, findMax } from "@/src/plan-tools";
import { ExerciseImages, ExercisePicker } from "@/src/exercises";
import { ClientReminder } from "@/src/client-reminder";

const newEx = () => ({ name: "", sets: "3", reps: "10", load: "", rir: "2", rest: "90s", notes: "", type: "reps", technique: "", images: [] as string[], district: "" });
const APPROACHES = ["Ipertrofia", "Forza", "Ricomposizione", "Dimagrimento", "Powerbuilding", "Contest prep", "Ricondizionamento"];

// Planned weekly sets per district = sets of each exercise tagged with that district (days repeat once a week).
const plannedVolume = (plan: any) => {
  const out: Record<string, number> = {};
  plan.days.forEach((d: any) => d.exercises.forEach((e: any) => { if (e.district) out[e.district] = (out[e.district] || 0) + (num(e.sets) || 0); }));
  return out;
};

function VolumeCard({ plan, upd, clientId }: { plan: any; upd: (fn: (p: any) => void) => void; clientId: string }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const v = plan.volume || { weekly_total: "", per_district: {} };
  const planned = plannedVolume(plan);
  const plannedTot = Object.values(planned).reduce((a, b) => a + b, 0);
  const askAi = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api("/ai/volume", { method: "POST", body: { client_id: clientId, goal: plan.approach, freq: String(plan.days.length), districts: DISTRICTS } });
      upd((p) => { p.volume = { weekly_total: String(r.weekly_total ?? ""), per_district: Object.fromEntries(Object.entries(r.per_district || {}).map(([k, x]) => [k, String(x)])), ai: true, rationale: r.rationale || "" }; });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card accent testID="volume-card">
      <H>Volume settimanale (serie)</H>
      <T muted style={{ fontSize: 12 }}>Scegli tu il totale e i volumi per distretto, oppure lascia decidere all&apos;AI. Il conteggio previsto usa il distretto assegnato a ogni esercizio.</T>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <Field testID="volume-total-input" label="Totale settimanale" keyboardType="number-pad" value={String(v.weekly_total ?? "")} onChangeText={(x) => upd((p) => { p.volume = { ...v, weekly_total: x, ai: false }; })} style={{ flex: 1 }} />
        <View style={{ flex: 1, paddingBottom: 12 }}><T muted style={{ fontSize: 12 }}>Previsto in scheda</T><T style={{ fontWeight: "900", color: v.weekly_total && plannedTot > num(v.weekly_total) ? colors.warning : colors.onSurface }}>{plannedTot} serie</T></View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {DISTRICTS.map((d) => (
          <View key={d} style={{ width: "31%", flexGrow: 1 }}>
            <Field testID={`volume-${d}`} label={`${d}${planned[d] ? ` (${planned[d]})` : ""}`} keyboardType="number-pad" value={String(v.per_district?.[d] ?? "")}
              onChangeText={(x) => upd((p) => { p.volume = { ...v, ai: false, per_district: { ...(v.per_district || {}), [d]: x } }; })} />
          </View>
        ))}
      </View>
      {v.ai && v.rationale ? <T muted style={{ fontSize: 12 }}>AI: {v.rationale}</T> : null}
      <ErrorText text={err} />
      <Btn testID="volume-ai-button" small variant="ghost" icon="sparkles" title="Decide l'AI" loading={busy} onPress={askAi} />
    </Card>
  );
}

export default function PlanEdit() {
  const { clientId, planId } = useLocalSearchParams<{ clientId: string; planId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [plan, setPlan] = useState<any>(planId ? null : { name: "", notes: "", days: [{ name: "Giorno A", exercises: [newEx()] }], volume: { weekly_total: "", per_district: {} } });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [maxes, setMaxes] = useState<Record<string, number>>({});
  const [pick, setPick] = useState<{ di: number; ei: number } | null>(null);
  const [open, setOpen] = useState<string>("0-0");
  const [confirm, setConfirm] = useState(false);

  useEffect(() => { api(`/clients/${clientId}/maxes`).then(setMaxes).catch(() => {}); }, [clientId]);
  useEffect(() => { if (planId) api(`/plans/${planId}`).then(setPlan).catch((e) => setErr(e.message)); }, [planId]);

  if (!plan) return <Screen title="Scheda" back><Loading /></Screen>;

  const upd = (fn: (p: any) => void) => setPlan((p: any) => { const c = JSON.parse(JSON.stringify(p)); fn(c); return c; });

  const save = async (notify: boolean) => {
    setConfirm(false);
    setBusy(true);
    try {
      const body = { client_id: clientId, name: plan.name, notes: plan.notes, days: plan.days, approach: plan.approach || "", active: plan.active !== false, volume: plan.volume || {}, notify };
      if (planId) await api(`/plans/${planId}`, { method: "PUT", body });
      else await api("/plans", { method: "POST", body });
      if (router.canGoBack()) router.back();
      else router.replace(`/plans/${clientId}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const ask = () => {
    if (!plan.name.trim()) return setErr("Inserisci il nome della scheda");
    setConfirm(true);
  };

  return (
    <Screen title={planId ? "Modifica scheda" : "Nuova scheda"} back>
      <ClientReminder clientId={clientId} />
      <Btn testID="ai-plan-open-button" icon="sparkles" variant="ghost" title="Genera con AI / Guidata ISSA" onPress={() => setAiOpen(true)} />
      <AiPlanSheet visible={aiOpen} onClose={() => setAiOpen(false)} clientId={clientId} volume={plan.volume} onPlan={(g) => setPlan((p: any) => ({ ...p, name: p.name || g.name || "", approach: g.approach || p.approach, notes: g.notes || p.notes, days: g.days?.length ? g.days : p.days }))} />
      <Field testID="plan-name-input" label="Nome scheda" placeholder="es. Ipertrofia - Blocco 1" value={plan.name} onChangeText={(v) => upd((p) => { p.name = v; })} />
      <Field testID="plan-notes-input" label="Note" multiline value={plan.notes} onChangeText={(v) => upd((p) => { p.notes = v; })} />
      <T muted>Approccio</T>
      <ChipRow>
        {APPROACHES.map((a) => <Chip key={a} testID={`approach-chip-${a}`} label={a} active={plan.approach === a} onPress={() => upd((p) => { p.approach = p.approach === a ? "" : a; })} />)}
      </ChipRow>
      <Field testID="plan-approach-input" placeholder="Oppure scrivi l'approccio (es. DUP, 5/3/1)" value={plan.approach || ""} onChangeText={(v) => upd((p) => { p.approach = v; })} />
      <VolumeCard plan={plan} upd={upd} clientId={clientId} />
      <Toggle testID="plan-active-toggle" label="Scheda attiva" hint="Se disattivata resta nello storico ma il cliente non la vede in Home" value={plan.active !== false} onChange={(v) => upd((p) => { p.active = v; })} />
      {plan.days.map((d: any, di: number) => (
        <View key={di} style={{ gap: 8 }} testID={`plan-day-${di}`}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
            <Field testID={`day-name-input-${di}`} label={`Giorno ${di + 1}`} value={d.name} onChangeText={(v) => upd((p) => { p.days[di].name = v; })} style={{ flex: 1 }} />
            <Pressable testID={`day-remove-${di}`} onPress={() => upd((p) => { p.days.splice(di, 1); })} style={{ padding: 12 }}>
              <Ionicons name="trash-outline" size={20} color={colors.muted} />
            </Pressable>
          </View>
          {d.exercises.map((e: any, ei: number) => {
            const f = (k: string) => (v: any) => upd((p) => { p.days[di].exercises[ei][k] = v; });
            const key = `${di}-${ei}`;
            const isOpen = open === key;
            return (
              <Card key={ei} accent={isOpen} testID={`ex-card-${di}-${ei}`}>
                <Pressable testID={`ex-toggle-${di}-${ei}`} onPress={() => setOpen(isOpen ? "" : key)} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
                    <T style={{ color: colors.onBrandPrimary, fontWeight: "900", fontSize: 13 }}>{ei + 1}</T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: "900" }} numberOfLines={1}>{e.name || "Nuovo esercizio"}</T>
                    <T muted style={{ fontSize: 12 }}>{e.sets}×{e.reps}{e.load ? ` @ ${e.load}kg` : ""} · RIR {e.rir || "—"} · rec {e.rest || "—"}{e.district ? ` · ${e.district}` : ""}</T>
                  </View>
                  <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
                </Pressable>
                {!isOpen ? <ExerciseImages images={e.images} size={64} /> : (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                      <Field testID={`ex-name-${di}-${ei}`} label="Esercizio" placeholder="es. Panca piana" value={e.name} onChangeText={f("name")} style={{ flex: 1 }} />
                      <Pressable testID={`ex-remove-${di}-${ei}`} onPress={() => upd((p) => { p.days[di].exercises.splice(ei, 1); })} style={{ padding: 12 }}>
                        <Ionicons name="close-circle-outline" size={22} color={colors.muted} />
                      </Pressable>
                    </View>
                    <ExerciseImages images={e.images} />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Btn testID={`ex-images-${di}-${ei}`} small variant="dark" icon="images" title={e.images?.length ? "Cambia immagini" : "Aggiungi immagini"} style={{ flex: 1 }} onPress={() => setPick({ di, ei })} />
                      {e.images?.length ? <Btn small variant="ghost" icon="close" title="Rimuovi" onPress={() => f("images")([])} /> : null}
                    </View>
                    <T muted style={{ fontSize: 11, fontWeight: "700" }}>DISTRETTO</T>
                    <ChipRow>{DISTRICTS.map((x) => <Chip key={x} testID={`ex-district-${di}-${ei}-${x}`} label={x} active={e.district === x} onPress={() => f("district")(e.district === x ? "" : x)} />)}</ChipRow>
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
                )}
              </Card>
            );
          })}
          <Btn testID={`add-exercise-${di}`} small variant="ghost" icon="add" title="Esercizio" onPress={() => { upd((p) => { p.days[di].exercises.push(newEx()); }); setOpen(`${di}-${d.exercises.length}`); }} />
        </View>
      ))}
      <Btn testID="add-day-button" variant="dark" icon="add" title="Aggiungi giorno" onPress={() => upd((p) => { p.days.push({ name: `Giorno ${String.fromCharCode(65 + p.days.length)}`, exercises: [newEx()] }); })} />
      <ErrorText text={err} />
      <Btn testID="plan-save-button" icon="save" title="Salva scheda" loading={busy} onPress={ask} />
      <ExercisePicker visible={!!pick} onClose={() => setPick(null)} initial={pick ? plan.days[pick.di]?.exercises[pick.ei]?.name || "" : ""}
        onPick={(x) => pick && upd((p) => { const e = p.days[pick.di].exercises[pick.ei]; e.images = x.images; if (!e.name && x.name) e.name = x.name; })} />
      <Sheet visible={confirm} onClose={() => setConfirm(false)} title="Notificare il cliente?">
        <T>Vuoi avvisare il cliente che la scheda è stata {planId ? "modificata" : "creata"}?</T>
        <Btn testID="plan-save-notify" icon="notifications" title="Salva e notifica" onPress={() => save(true)} />
        <Btn testID="plan-save-silent" variant="dark" icon="save" title="Salva senza notificare" onPress={() => save(false)} />
      </Sheet>
    </Screen>
  );
}
