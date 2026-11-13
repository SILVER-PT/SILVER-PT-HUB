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
import { Select } from "@/src/select";

// Importiamo il motore anatomico di body-muscles (compatibile web/react)
// Se usi react-native puro senza webview, gestiamo i distretti tramite griglia interattiva avanzata sincronizzata
import BodyMuscles from "body-muscles";

const newEx = () => ({ name: "", sets: "3", reps: "10", load: "", rir: "2", rest: "90s", notes: "", type: "reps", technique: "", images: [] as string[], district: "", resistanceProfile: "Multiarticolare" });
const APPROACHES = ["Ipertrofia", "Forza", "Ricomposizione", "Dimagrimento", "Powerbuilding", "Contest prep", "Ricondizionamento"];
const RESISTANCE_PROFILES = ["Multiarticolare", "Allungamento", "Accorciamento", "Isometria"];

const generatePlanName = (approach: string, notes: string) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const appName = approach || "Ipertrofia";
  const desc = notes ? notes.split(" ")[0] : "cardio HIIT";
  return `${yyyy}.${mm}.${dd} - ${appName} - ${desc}`;
};

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
  const mode = v.mode || "district";
  const planned = plannedVolume(plan);
  const plannedTot = Object.values(planned).reduce((a, b) => a + b, 0);
  const setV = (patch: any) => upd((p) => { p.volume = { ...(p.volume || {}), ...patch }; });
  const askAi = async () => {
    setBusy(true);
    setErr("");
    try {
      const given = mode === "total" ? { totale: v.weekly_total } : mode === "upperlower" ? { totale: v.weekly_total, upper: v.upper, lower: v.lower } : { totale: v.weekly_total, ...(v.per_district || {}) };
      const r = await api("/ai/volume", { method: "POST", body: { client_id: clientId, goal: plan.approach, freq: String(plan.days.length), districts: DISTRICTS, given } });
      setV({ weekly_total: String(r.weekly_total ?? v.weekly_total ?? ""), per_district: Object.fromEntries(Object.entries(r.per_district || {}).map(([k, x]) => [k, String(x)])), ai: true, rationale: r.rationale || "", mode: "district" });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card accent testID="volume-card">
      <H>Volume settimanale (serie)</H>
      <T muted style={{ fontSize: 12 }}>Decidi quanto vuoi: solo il totale, upper/lower o ogni distretto. L&apos;AI completa e suddivide il resto.</T>
      <ChipRow>
        {[["total", "Solo totale"], ["upperlower", "Upper / Lower"], ["district", "Per distretto"]].map(([k, l]) => (
          <Chip key={k} testID={`volume-mode-${k}`} label={l} active={mode === k} onPress={() => setV({ mode: k })} />
        ))}
      </ChipRow>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <Field testID="volume-total-input" label="Totale settimanale" keyboardType="number-pad" value={String(v.weekly_total ?? "")} onChangeText={(x) => setV({ weekly_total: x, ai: false })} style={{ flex: 1 }} />
        <View style={{ flex: 1, paddingBottom: 12 }}><T muted style={{ fontSize: 12 }}>Previsto in scheda</T><T style={{ fontWeight: "900", color: v.weekly_total && plannedTot > num(v.weekly_total) ? colors.warning : colors.onSurface }}>{plannedTot} serie</T></View>
      </View>
      {mode === "upperlower" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field testID="volume-upper" label="Upper" keyboardType="number-pad" value={String(v.upper ?? "")} onChangeText={(x) => setV({ upper: x })} style={{ flex: 1 }} />
          <Field testID="volume-lower" label="Lower" keyboardType="number-pad" value={String(v.lower ?? "")} onChangeText={(x) => setV({ lower: x })} style={{ flex: 1 }} />
        </View>
      ) : null}
      {mode === "district" ? (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {DISTRICTS.map((d) => (
          <View key={d} style={{ width: "31%", flexGrow: 1 }}>
            <Field testID={`volume-${d}`} label={`${d}${planned[d] ? ` (${planned[d]})` : ""}`} keyboardType="number-pad" value={String(v.per_district?.[d] ?? "")}
              onChangeText={(x) => setV({ ai: false, per_district: { ...(v.per_district || {}), [d]: x } })} />
          </View>
        ))}
      </View>
      ) : null}
      {v.ai && v.rationale ? <T muted style={{ fontSize: 12 }}>AI: {v.rationale}</T> : null}
      <ErrorText text={err} />
      <Btn testID="volume-ai-button" small variant="ghost" icon="sparkles" title={mode === "district" ? "Completa con AI" : "Suddividi con AI"} loading={busy} onPress={askAi} />
    </Card>
  );
}

// Selettore Anatomico avanzato integrato con la logica vettoriale di Body Muscles
function InteractiveAnatomySelector({ selectedDistricts, onToggleDistrict }: { selectedDistricts: string[]; onToggleDistrict: (d: string) => void }) {
  const { colors } = useTheme();
  const [gender, setGender] = useState<"male" | "female">("male");
  const [viewMode, setViewMode] = useState<"front" | "back">("front");

  const districtsList = [
    { id: "Petto", label: "Pettorali", muscleKey: "chest" },
    { id: "Spalle", label: "Spalle", muscleKey: "shoulders" },
    { id: "Bicipiti", label: "Bicipiti", muscleKey: "biceps" },
    { id: "Tricipiti", label: "Tricipiti", muscleKey: "triceps" },
    { id: "Addome", label: "Addome", muscleKey: "abs" },
    { id: "Dorso", label: "Dorso", muscleKey: "upper-back" },
    { id: "Quadricipiti", label: "Quadricipiti", muscleKey:quadriceps => "quadriceps" },
    { id: "Femorali", label: "Femorali", muscleKey: "hamstrings" },
    { id: "Glutei", label: "Glutei", muscleKey: "gluteal" },
    { id: "Polpacci", label: "Polpacci", muscleKey: "calves" },
    { id: "Avambracci", label: "Avambracci", muscleKey: "forearms" },
    { id: "Trapezio", label: "Trapezio", muscleKey: "trapezius" },
  ];

  return (
    <Card accent style={{ padding: 16, alignItems: "center" }}>
      <H style={{ marginBottom: 4, letterSpacing: 1 }}>MAPPA MUSCOLARE VETTORIALE</H>
      <T muted style={{ fontSize: 12, textAlign: "center", marginBottom: 14 }}>
        Seleziona i distretti di allenamento. I gruppi attivi si illuminano in rosso (<T style={{ color: "#e60000", fontWeight: "bold" }}>#e60000</T>).
      </T>

      {/* Switch Genere e Vista */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 14, gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 6, flex: 1 }}>
          <Pressable 
            onPress={() => setGender("male")}
            style={{ flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: gender === "male" ? "#e60000" : "#333", backgroundColor: gender === "male" ? "#e60000" : "#111", alignItems: "center" }}
          >
            <T style={{ color: "#fff", fontWeight: "bold", fontSize: 11 }}>UOMO</T>
          </Pressable>
          <Pressable 
            onPress={() => setGender("female")}
            style={{ flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: gender === "female" ? "#e60000" : "#333", backgroundColor: gender === "female" ? "#e60000" : "#111", alignItems: "center" }}
          >
            <T style={{ color: "#fff", fontWeight: "bold", fontSize: 11 }}>DONNA</T>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: 6, flex: 1 }}>
          <Pressable 
            onPress={() => setViewMode("front")}
            style={{ flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: viewMode === "front" ? "#e60000" : "#333", backgroundColor: viewMode === "front" ? "#e60000" : "#111", alignItems: "center" }}
          >
            <T style={{ color: "#fff", fontWeight: "bold", fontSize: 11 }}>FRONTE</T>
          </Pressable>
          <Pressable 
            onPress={() => setViewMode("back")}
            style={{ flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: viewMode === "back" ? "#e60000" : "#333", backgroundColor: viewMode === "back" ? "#e60000" : "#111", alignItems: "center" }}
          >
            <T style={{ color: "#fff", fontWeight: "bold", fontSize: 11 }}>RETRO</T>
          </Pressable>
        </View>
      </View>

      {/* Render della mappa vettoriale interattiva stile workout.lol */}
      <View style={{
        width: "100%",
        maxWidth: 280,
        height: 280,
        backgroundColor: "#050505",
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#222",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 14,
        overflow: "hidden"
      }}>
        <BodyMuscles
          model={gender}
          type={viewMode}
          data={selectedDistricts.map(d => ({
            name: districtsList.find(x => x.id === d)?.muscleKey || d.toLowerCase(),
            intensity: 3, // Intensità massima di illuminazione in rosso
          }))}
          onClick={(muscle: any) => {
            const found = districtsList.find(x => x.muscleKey === muscle.name || x.id.toLowerCase() === muscle.name.toLowerCase());
            if (found) onToggleDistrict(found.id);
          }}
          style={{ width: "100%", height: "100%" }}
        />
      </View>

      {/* Griglia rapida di controllo */}
      <View style={{
        width: "100%",
        maxWidth: 340,
        backgroundColor: "#050505",
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#222",
        padding: 10,
        marginBottom: 12,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 6
      }}>
        {districtsList.map((item) => {
          const isSelected = selectedDistricts.includes(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => onToggleDistrict(item.id)}
              style={({ pressed }) => [
                {
                  width: "31%",
                  minHeight: 40,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: isSelected ? "#e60000" : "#2a2a2a",
                  backgroundColor: isSelected ? "#e60000" : "#121212",
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 2,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
            >
              <T style={{ fontWeight: "900", fontSize: 10, color: isSelected ? "#fff" : colors.onSurface, textAlign: "center" }}>
                {item.id.toUpperCase()}
              </T>
            </Pressable>
          );
        })}
      </View>

      {/* Badge attivi */}
      <View style={{ width: "100%", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
        {selectedDistricts.length === 0 ? (
          <T muted style={{ fontSize: 12, fontStyle: "italic" }}>Nessun distretto selezionato</T>
        ) : (
          selectedDistricts.map((d) => (
            <View key={d} style={{ backgroundColor: "#e60000", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
              <T style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }}>{d.toUpperCase()} ✓</T>
            </View>
          ))
        )}
      </View>
    </Card>
  );
}

export default function PlanEdit() {
  const { clientId, planId } = useLocalSearchParams<{ clientId: string; planId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [plan, setPlan] = useState<any>(planId && planId !== "undefined" ? null : { name: generatePlanName("Ipertrofia", "cardio HIIT"), notes: "", days: [{ name: "Giorno A", districts: [], exercises: [newEx()] }], volume: { weekly_total: "", per_district: {} } });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [maxes, setMaxes] = useState<Record<string, number>>({});
  const [pick, setPick] = useState<{ di: number; ei: number } | null>(null);
  const [open, setOpen] = useState<string>("0-0");
  const [confirm, setConfirm] = useState(false);

  const isValidClient = Boolean(clientId && clientId !== "undefined");

  useEffect(() => { 
    if (isValidClient) {
      api(`/clients/${clientId}/maxes`).then(setMaxes).catch(() => {}); 
    }
  }, [clientId, isValidClient]);

  useEffect(() => { 
    if (planId && planId !== "undefined") {
      api(`/plans/${planId}`).then(setPlan).catch((e) => setErr(e.message)); 
    }
  }, [planId]);

  if (!plan) return <Screen title="Scheda" back><Loading /></Screen>;

  const upd = (fn: (p: any) => void) => setPlan((p: any) => { const c = JSON.parse(JSON.stringify(p)); fn(c); return c; });

  const save = async (notify: boolean) => {
    if (!isValidClient) {
      setErr("ID cliente non valido. Torna indietro e seleziona un cliente.");
      setConfirm(false);
      return;
    }
    setConfirm(false);
    setBusy(true);
    try {
      const body = { client_id: clientId, name: plan.name, notes: plan.notes, days: plan.days, approach: plan.approach || "", active: plan.active !== false, volume: plan.volume || {}, notify };
      if (planId && planId !== "undefined") await api(`/plans/${planId}`, { method: "PUT", body });
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
    <Screen title={planId && planId !== "undefined" ? "Modifica scheda" : "Nuova scheda"} back>
      {isValidClient ? <ClientReminder clientId={clientId} /> : null}
      <Btn testID="ai-plan-open-button" icon="sparkles" variant="ghost" title="Genera con AI / Guidata ISSA" onPress={() => setAiOpen(true)} />
      <AiPlanSheet visible={aiOpen} onClose={() => setAiOpen(false)} clientId={isValidClient ? clientId : ""} volume={plan.volume} onPlan={(g) => setPlan((p: any) => ({ ...p, name: p.name || g.name || "", approach: g.approach || p.approach, notes: g.notes || p.notes, days: g.days?.length ? g.days : p.days }))} />
      
      <Field testID="plan-name-input" label="Nome scheda (es. AAAA.MM.GG - Approccio - Note)" value={plan.name} onChangeText={(v) => upd((p) => { p.name = v; })} />
      <Field testID="plan-notes-input" label="Note" multiline value={plan.notes} onChangeText={(v) => {
        upd((p) => { 
          p.notes = v; 
          p.name = generatePlanName(p.approach, v);
        });
      }} />
      <Select testID="approach-select" label="Approccio" value={plan.approach || ""} options={APPROACHES} onChange={(v) => {
        upd((p) => { 
          p.approach = v; 
          p.name = generatePlanName(v, p.notes);
        });
      }} />
      
      <VolumeCard plan={plan} upd={upd} clientId={isValidClient ? clientId : ""} />
      <Toggle testID="plan-active-toggle" label="Scheda attiva" hint="Se disattivata resta nello storico ma il cliente non la vede in Home" value={plan.active !== false} onChange={(v) => upd((p) => { p.active = v; })} />
      
      {plan.days.map((d: any, di: number) => (
        <View key={di} style={{ gap: 12, marginTop: 12 }} testID={`plan-day-${di}`}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
            <Field testID={`day-name-input-${di}`} label={`Giorno ${di + 1}`} value={d.name} onChangeText={(v) => upd((p) => { p.days[di].name = v; })} style={{ flex: 1 }} />
            <Pressable testID={`day-remove-${di}`} onPress={() => upd((p) => { p.days.splice(di, 1); })} style={{ padding: 12 }}>
              <Ionicons name="trash-outline" size={20} color={colors.muted} />
            </Pressable>
          </View>

          <InteractiveAnatomySelector
            selectedDistricts={d.districts || []}
            onToggleDistrict={(districtName) => {
              upd((p) => {
                const day = p.days[di];
                if (!day.districts) day.districts = [];
                if (day.districts.includes(districtName)) {
                  day.districts = day.districts.filter((x: string) => x !== districtName);
                } else {
                  day.districts.push(districtName);
                }
              });
            }}
          />

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
                    <T muted style={{ fontSize: 12 }}>{e.resistanceProfile || "Multiarticolare"} · {e.sets}×{e.reps}{e.load ? ` @ ${e.load}kg` : ""} · RIR {e.rir || "—"}{e.district ? ` · ${e.district}` : ""}</T>
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
                    
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Select testID={`ex-district-${di}-${ei}`} label="Distretto Muscolare" value={e.district} options={d.districts?.length ? d.districts : DISTRICTS} onChange={f("district")} />
                      <Select testID={`ex-profile-${di}-${ei}`} label="Profilo Resistenza" value={e.resistanceProfile || "Multiarticolare"} options={RESISTANCE_PROFILES} allowClear={false} onChange={f("resistanceProfile")} />
                    </View>

                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Select testID={`ex-type-${di}-${ei}`} label="Tipo" value={e.type === "time" ? "A tempo (sec)" : "Ripetizioni"} options={["Ripetizioni", "A tempo (sec)"]} allowClear={false} onChange={(v) => f("type")(v === "Ripetizioni" ? "reps" : "time")} />
                    </View>

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
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Select testID={`ex-tech-${di}-${ei}`} label="Tecnica di intensità" value={e.technique} options={TECHNIQUES} onChange={f("technique")} />
                      {e.type !== "time" ? (
                        <Select testID={`ex-proto-${di}-${ei}`} label={findMax(maxes, e.name) ? `Protocollo · 1RM ${findMax(maxes, e.name)}kg` : "Protocollo ISSA (%1RM)"} value={e.protocol} options={PROTOCOLS.map((x) => x.name)}
                          onChange={(v) => upd((p) => { if (!v) { const x = p.days[di].exercises[ei]; delete x.scheme; x.protocol = ""; } else p.days[di].exercises[ei] = applyProtocol(p.days[di].exercises[ei], v, findMax(maxes, e.name)); })} />
                      ) : null}
                    </View>
                  </View>
                )}
              </Card>
            );
          })}
          
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn testID={`add-exercise-${di}`} small variant="ghost" icon="add" title="Aggiungi Esercizio" style={{ flex: 1 }} onPress={() => { upd((p) => { p.days[di].exercises.push(newEx()); }); setOpen(`${di}-${d.exercises.length}`); }} />
            <Btn testID={`add-superset-${di}`} small variant="dark" icon="git-merge" title="Superserie (+ Esercizio)" style={{ flex: 1 }} onPress={() => { upd((p) => { p.days[di].exercises.push({ ...newEx(), notes: "Superserie" }); }); setOpen(`${di}-${d.exercises.length}`); }} />
          </View>
        </View>
      ))}

      <Btn testID="add-day-button" variant="dark" icon="add" title="Aggiungi giorno" onPress={() => upd((p) => { p.days.push({ name: `Giorno ${String.fromCharCode(65 + p.days.length)}`, districts: [], exercises: [newEx()] }); })} />
      <ErrorText test err={err} />
      <Btn testID="plan-save-button" icon="save" title="Salva scheda" loading={busy} onPress={ask} />
      
      <ExercisePicker visible={!!pick} onClose={() => setPick(null)} initial={pick ? plan.days[pick.di]?.exercises[pick.ei]?.name || "" : ""}
        onPick={(x) => pick && upd((p) => { const e = p.days[pick.di].exercises[pick.ei]; e.images = x.images; if (!e.name && x.name) e.name = x.name; })} />
      
      <Sheet visible={confirm} onClose={() => setConfirm(false)} title="Notificare il cliente?">
        <T>Vuoi avvisare il cliente che la scheda è stata {planId && planId !== "undefined" ? "modificata" : "creata"}?</T>
        <Btn testID="plan-save-notify" icon="notifications" title="Salva e notifica" onPress={() => save(true)} />
        <Btn testID="plan-save-silent" variant="dark" icon="save" title="Salva senza notificare" onPress={() => save(false)} />
      </Sheet>
    </Screen>
  );
}
