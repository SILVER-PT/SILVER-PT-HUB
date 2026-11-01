import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { LineChart } from "react-native-gifted-charts";
import { useFetch } from "@/src/api";
import { Card, Chip, ChipRow, Empty, H, Loading, Screen, Stat, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

const METRICS = [["max_load", "Carico max", "kg"], ["total_reps", "Ripetizioni", ""], ["volume", "Volume", "kg"], ["avg_rir", "RIR medio", ""], ["avg_execution", "Esecuzione", "/10"]];

function Chart({ points, color }: { points: { value: number; label: string }[]; color: string }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const w = Math.min(width, 600) - 110;
  return (
    <LineChart
      data={points}
      width={w}
      height={180}
      spacing={points.length > 1 ? Math.max(40, w / Math.max(points.length - 1, 1) - 4) : 40}
      initialSpacing={16}
      color={color}
      thickness={3}
      dataPointsColor={colors.onSurface}
      areaChart
      startFillColor={color}
      endFillColor={colors.surface}
      startOpacity={0.4}
      endOpacity={0}
      curved
      noOfSections={4}
      rulesColor={colors.divider}
      yAxisColor={colors.border}
      xAxisColor={colors.border}
      yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
      xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
      scrollToEnd
    />
  );
}

export default function Progress() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { colors } = useTheme();
  const { data, loading } = useFetch<Record<string, any[]>>(`/progress?client_id=${clientId}`);
  const meas = useFetch<any[]>(`/measurements?client_id=${clientId}`);
  const names = Object.keys(data || {});
  const [ex, setEx] = useState<string | null>(null);
  const [metric, setMetric] = useState("max_load");
  const sel = ex && names.includes(ex) ? ex : names[0];
  const series = sel ? data![sel] : [];
  const m = METRICS.find((x) => x[0] === metric)!;
  const pts = series.map((p) => ({ value: p[metric], label: p.date.slice(5) }));
  const first = series[0]?.[metric];
  const last = series[series.length - 1]?.[metric];
  const body = [...(meas.data || [])].reverse();

  return (
    <Screen title="Progressi" back>
      {loading && !data ? <Loading /> : null}
      {data && names.length === 0 ? <Empty icon="trending-up-outline" text="Completa le prime sessioni per vedere i grafici." /> : null}
      {names.length > 0 && (
        <>
          <H>Esercizio</H>
          <ChipRow>{names.map((n) => <Chip key={n} testID={`progress-ex-${n}`} label={n} active={n === sel} onPress={() => setEx(n)} />)}</ChipRow>
          <ChipRow>{METRICS.map(([k, l]) => <Chip key={k} testID={`progress-metric-${k}`} label={l} active={k === metric} onPress={() => setMetric(k)} />)}</ChipRow>
          <Card accent testID="progress-chart-card">
            <T style={{ fontWeight: "900" }}>{sel} · {m[1]}</T>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Stat label="Inizio" value={first} unit={m[2]} />
              <Stat label="Ultimo" value={last} unit={m[2]} />
              <Stat testID="progress-delta" label="Δ" value={first != null && last != null ? Math.round((last - first) * 10) / 10 : null} unit={m[2]} />
            </View>
            <View style={{ overflow: "hidden", marginTop: 8 }}>
              <Chart points={pts} color={colors.laser} />
            </View>
          </Card>
        </>
      )}
      {body.length > 0 && (
        <>
          <H>Composizione corporea</H>
          <Card>
            <T style={{ fontWeight: "900" }}>Peso (kg)</T>
            <View style={{ overflow: "hidden" }}><Chart points={body.filter((b) => b.weight).map((b) => ({ value: b.weight, label: b.date.slice(5) }))} color={colors.silver} /></View>
          </Card>
          {body.some((b) => b.body_fat) ? (
            <Card>
              <T style={{ fontWeight: "900" }}>% Massa grassa</T>
              <View style={{ overflow: "hidden" }}><Chart points={body.filter((b) => b.body_fat).map((b) => ({ value: b.body_fat, label: b.date.slice(5) }))} color={colors.laser} /></View>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}
