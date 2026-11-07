import { useState } from "react";
import { View } from "react-native";
import { useFetch } from "@/src/api";
import { Card, Chip, ChipRow, H, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

const ROWS: [string, string, string][] = [
  ["sessions", "Sessioni", ""], ["sets", "Serie completate", ""], ["total_reps", "Ripetizioni totali", ""], ["volume", "Volume totale", "kg"],
  ["volume_per_session", "Volume / sessione", "kg"], ["avg_load", "Carico medio", "kg"], ["max_load", "Carico massimo", "kg"],
  ["avg_rir", "RIR medio", ""], ["avg_execution", "Esecuzione media", "/10"],
];

function Delta({ a, b, invert }: { a: any; b: any; invert?: boolean }) {
  const { colors } = useTheme();
  if (a == null || b == null || typeof a !== "number" || typeof b !== "number") return <T muted style={{ width: 64, textAlign: "right", fontSize: 12 }}>—</T>;
  const d = Math.round((b - a) * 10) / 10;
  const good = invert ? d < 0 : d > 0;
  return <T style={{ width: 64, textAlign: "right", fontSize: 12, fontWeight: "800", color: d === 0 ? colors.muted : good ? colors.success : colors.warning }}>{d > 0 ? "+" : ""}{d}</T>;
}

// Compare two workout plans (blocks): totals + per-exercise bests.
export function PlanCompare({ clientId }: { clientId: string }) {
  const { colors } = useTheme();
  const { data } = useFetch<any[]>(`/progress/plans?client_id=${clientId}`);
  const [pair, setPair] = useState<[number, number] | null>(null);
  if (!data || data.length === 0) return null;
  const n = data.length;
  const [ai, bi] = pair || [Math.max(0, n - 2), n - 1];
  const A = data[ai], B = data[bi];
  const exNames = Array.from(new Set([...Object.keys(A.exercises), ...Object.keys(B.exercises)]));
  const pick = (side: 0 | 1, i: number) => setPair(side === 0 ? [i, bi] : [ai, i]);
  return (
    <View style={{ gap: 8 }} testID="plan-compare">
      <H>Progressioni tra le schede</H>
      {n > 1 ? (
        <>
          <T muted style={{ fontSize: 12 }}>Scheda di partenza</T>
          <ChipRow>{data.map((p, i) => <Chip key={p.id} testID={`cmp-a-${i}`} label={p.name || `Scheda ${i + 1}`} active={i === ai} onPress={() => pick(0, i)} />)}</ChipRow>
          <T muted style={{ fontSize: 12 }}>Confronta con</T>
          <ChipRow>{data.map((p, i) => <Chip key={p.id} testID={`cmp-b-${i}`} label={p.name || `Scheda ${i + 1}`} active={i === bi} onPress={() => pick(1, i)} />)}</ChipRow>
        </>
      ) : null}
      <Card accent>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <View style={{ flex: 1.4 }} />
          <T style={{ flex: 1, fontSize: 11, fontWeight: "900", color: colors.silver }} numberOfLines={2}>{A.name}</T>
          {n > 1 ? <T style={{ flex: 1, fontSize: 11, fontWeight: "900", color: colors.brandPrimary }} numberOfLines={2}>{B.name}</T> : null}
          {n > 1 ? <T style={{ width: 64, textAlign: "right", fontSize: 11, fontWeight: "900" }}>Δ</T> : null}
        </View>
        {ROWS.map(([k, l, u]) => (
          <View key={k} style={{ flexDirection: "row", gap: 6, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.divider }}>
            <T muted style={{ flex: 1.4, fontSize: 12 }}>{l}{u ? ` (${u})` : ""}</T>
            <T style={{ flex: 1, fontSize: 13, fontWeight: "700" }}>{A[k] ?? "—"}</T>
            {n > 1 ? <T style={{ flex: 1, fontSize: 13, fontWeight: "700" }}>{B[k] ?? "—"}</T> : null}
            {n > 1 ? <Delta a={A[k]} b={B[k]} invert={k === "avg_rir"} /> : null}
          </View>
        ))}
      </Card>
      {exNames.length ? (
        <Card testID="plan-compare-exercises">
          <T style={{ fontWeight: "900" }}>Per esercizio · carico max / rip max / volume</T>
          {exNames.map((e) => {
            const a = A.exercises[e], b = B.exercises[e];
            return (
              <View key={e} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.divider, gap: 2 }}>
                <T style={{ fontWeight: "800", fontSize: 13 }}>{e}</T>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <T muted style={{ flex: 1, fontSize: 12 }}>{a ? `${a.max_load}kg · ${a.max_reps} rip · ${a.volume}` : "—"}</T>
                  {n > 1 ? <T style={{ flex: 1, fontSize: 12 }}>{b ? `${b.max_load}kg · ${b.max_reps} rip · ${b.volume}` : "—"}</T> : null}
                  {n > 1 ? <Delta a={a?.max_load} b={b?.max_load} /> : null}
                </View>
              </View>
            );
          })}
        </Card>
      ) : <T muted style={{ fontSize: 12 }}>Completa sessioni per vedere i confronti.</T>}
    </View>
  );
}
