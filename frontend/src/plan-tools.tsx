import { useState } from "react";
import { View } from "react-native";
import { api } from "@/src/api";
import { Btn, Chip, ChipRow, ErrorText, Field, Sheet, T } from "@/src/ui";

export const TECHNIQUES = ["Superset", "Drop set", "Rest-pause", "Myo-reps", "Cluster set", "Giant set", "Negative", "Stripping", "Pre-affaticamento"];

type Step = { reps: string; pct: number };
// ISSA / classic loading protocols as %1RM per set.
export const PROTOCOLS: { name: string; steps: Step[]; rir?: string; technique?: string; rest?: string }[] = [
  { name: "Piramidale crescente", steps: [12, 10, 8, 6].map((r, i) => ({ reps: String(r), pct: [65, 70, 75, 80][i] })), rir: "2", rest: "90s" },
  { name: "Piramidale decrescente", steps: [6, 8, 10, 12].map((r, i) => ({ reps: String(r), pct: [80, 75, 70, 65][i] })), rir: "2", rest: "90s" },
  { name: "Doppia piramide", steps: [12, 10, 8, 8, 10, 12].map((r, i) => ({ reps: String(r), pct: [65, 70, 75, 75, 70, 65][i] })), rir: "2", rest: "90s" },
  { name: "Onde (wave loading)", steps: [7, 5, 3, 7, 5, 3].map((r, i) => ({ reps: String(r), pct: [75, 80, 85, 77.5, 82.5, 87.5][i] })), rir: "1", rest: "3'" },
  { name: "5x5 forza", steps: Array(5).fill({ reps: "5", pct: 80 }), rir: "1", rest: "3'" },
  { name: "German Volume 10x10", steps: Array(10).fill({ reps: "10", pct: 60 }), rir: "1", rest: "60s" },
  { name: "Rest-pause", steps: [{ reps: "8+4+2", pct: 82.5 }, { reps: "8+4+2", pct: 82.5 }], rir: "0", technique: "Rest-pause", rest: "2'" },
  { name: "Drop set a cedimento", steps: [{ reps: "8", pct: 80 }, { reps: "10", pct: 65 }, { reps: "12", pct: 50 }], rir: "0", technique: "Drop set", rest: "0s" },
  { name: "Heavy duty (cedimento)", steps: [{ reps: "6-8", pct: 82.5 }], rir: "0", technique: "Negative", rest: "3'" },
];

const round25 = (x: number) => Math.round(x / 2.5) * 2.5;

export function findMax(maxes: Record<string, number>, name: string) {
  const n = name.trim().toLowerCase();
  const k = Object.keys(maxes).find((m) => m.toLowerCase() === n) || Object.keys(maxes).find((m) => n && (m.toLowerCase().includes(n) || n.includes(m.toLowerCase())));
  return k ? maxes[k] : 0;
}

export function applyProtocol(ex: any, protoName: string, oneRm: number) {
  const p = PROTOCOLS.find((x) => x.name === protoName)!;
  const scheme = p.steps.map((s) => ({ reps: s.reps, load: oneRm ? String(round25((oneRm * s.pct) / 100)) : `${s.pct}%`, rir: p.rir || "" }));
  return { ...ex, protocol: p.name, scheme, sets: String(scheme.length), reps: scheme[0].reps, load: scheme[0].load, rir: p.rir || ex.rir, rest: p.rest || ex.rest, technique: p.technique || ex.technique || "" };
}

export const DISTRICTS = ["Petto", "Dorso", "Spalle", "Bicipiti", "Tricipiti", "Quadricipiti", "Femorali", "Glutei", "Polpacci", "Addome"];

const OPT = {
  goal: ["Ipertrofia", "Forza", "Ricomposizione", "Dimagrimento", "Contest prep", "Ricondizionamento"],
  split: ["Full body", "Upper / Lower", "Push / Pull / Legs", "Bro split", "Torso / Gambe + PPL"],
  freq: ["2", "3", "4", "5", "6"],
  districts: DISTRICTS,
  stimulus: ["Posizione di allungamento", "Posizione di accorciamento", "Entrambe"],
  target: ["Forza", "Ipertrofia", "Fibre rosse (lente/resistenza)", "Fibre bianche (esplosive)"],
  category: ["Gold standard", "Multiarticolari", "Mista"],
};

export function AiPlanSheet({ visible, onClose, clientId, onPlan, volume }: { visible: boolean; onClose: () => void; clientId: string; onPlan: (p: any) => void; volume?: any }) {
  const [mode, setMode] = useState<"prompt" | "guided">("guided");
  const [prompt, setPrompt] = useState("");
  const [p, setP] = useState<any>({ goal: "Ipertrofia", split: "Upper / Lower", freq: "4", districts: [], stimulus: "Entrambe", target: "Ipertrofia", category: "Mista", techniques: [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (k: string, v: string) => setP({ ...p, [k]: p[k].includes(v) ? p[k].filter((x: string) => x !== v) : [...p[k], v] });

  const gen = async () => {
    setBusy(true);
    setErr("");
    try {
      const plan = await api("/ai/plan", { method: "POST", body: { client_id: clientId, prompt, params: { ...(mode === "guided" ? { ...p, frequenza_settimanale: p.freq } : {}), volume_settimanale_serie: volume || {} } } });
      onPlan(plan);
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const one = (k: keyof typeof OPT, label: string) => (
    <View style={{ gap: 6 }}>
      <T muted style={{ fontSize: 12, fontWeight: "700" }}>{label}</T>
      <ChipRow>{OPT[k].map((o) => <Chip key={o} testID={`ai-${k}-${o}`} label={o} active={p[k] === o} onPress={() => setP({ ...p, [k]: o })} />)}</ChipRow>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Generatore scheda">
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip testID="ai-mode-guided" label="Guidata ISSA" active={mode === "guided"} onPress={() => setMode("guided")} />
        <Chip testID="ai-mode-prompt" label="Prompt libero AI" active={mode === "prompt"} onPress={() => setMode("prompt")} />
      </View>
      {mode === "guided" ? (
        <>
          <T muted style={{ fontSize: 12 }}>Obiettivi, composizione corporea e massimali del cliente vengono letti in automatico.</T>
          {one("goal", "Obiettivo")}
          {one("split", "Split")}
          {one("freq", "Frequenza settimanale")}
          <T muted style={{ fontSize: 12, fontWeight: "700" }}>Distretti prioritari</T>
          <ChipRow>{OPT.districts.map((o) => <Chip key={o} testID={`ai-district-${o}`} label={o} active={p.districts.includes(o)} onPress={() => toggle("districts", o)} />)}</ChipRow>
          {one("stimulus", "Stimolo biomeccanico")}
          {one("target", "Target")}
          {one("category", "Categoria esercizi")}
          <T muted style={{ fontSize: 12, fontWeight: "700" }}>Tecniche di intensità</T>
          <ChipRow>{TECHNIQUES.map((o) => <Chip key={o} testID={`ai-tech-${o}`} label={o} active={p.techniques.includes(o)} onPress={() => toggle("techniques", o)} />)}</ChipRow>
        </>
      ) : null}
      <Field testID="ai-plan-prompt-input" label={mode === "guided" ? "Note aggiuntive (facoltative)" : "Direttive per l'AI"} multiline placeholder="es. 60 minuti max, niente stacchi per lombalgia, focus glutei" value={prompt} onChangeText={setPrompt} />
      <ErrorText text={err} />
      {busy ? <T muted>L&apos;AI sta preparando la bozza (può richiedere 30-60 secondi)…</T> : null}
      <Btn testID="ai-plan-generate-button" icon="sparkles" title="Genera bozza" loading={busy} onPress={gen} />
    </Sheet>
  );
}
