import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { fmtDate, useFetch } from "@/src/api";
import { Card, Chip, ChipRow, Empty, Loading, Screen, Stat, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

export default function PlansHistory() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading } = useFetch<any[]>("/plans/history");
  const [approach, setApproach] = useState("Tutti");
  const approaches = ["Tutti", ...new Set((data || []).map((p) => p.approach || "Non specificato"))];
  const list = (data || []).filter((p) => approach === "Tutti" || (p.approach || "Non specificato") === approach);
  const counts = (data || []).reduce((a: any, p) => ({ ...a, [p.approach || "Non specificato"]: (a[p.approach || "Non specificato"] || 0) + 1 }), {});

  return (
    <Screen title="Storico schede" back>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Stat label="Schede" value={data?.length ?? 0} />
        <Stat label="Attive" value={(data || []).filter((p) => p.active !== false).length} />
        <Stat label="Approcci" value={approaches.length - 1} />
      </View>
      <ChipRow>
        {approaches.map((a) => <Chip key={a} testID={`approach-filter-${a}`} label={a === "Tutti" ? a : `${a} (${counts[a]})`} active={a === approach} onPress={() => setApproach(a)} />)}
      </ChipRow>
      {loading && !data ? <Loading /> : null}
      {data && list.length === 0 ? <Empty icon="archive-outline" text="Nessuna scheda creata." /> : null}
      {list.map((p) => (
        <Card key={p.id} testID={`history-plan-${p.id}`} onPress={() => router.push({ pathname: "/plan-edit", params: { clientId: p.client_id, planId: p.id } })}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <T style={{ fontWeight: "900", flex: 1 }}>{p.name || "Senza nome"}</T>
            <T style={{ fontSize: 12, fontWeight: "800", color: p.active === false ? colors.muted : colors.success }}>{p.active === false ? "ARCHIVIATA" : "ATTIVA"}</T>
          </View>
          <T muted style={{ fontSize: 13 }}>{p.client_name} · {p.approach || "Approccio non specificato"}</T>
          <T muted style={{ fontSize: 12 }}>{fmtDate(p.created_at)} · {p.days_count} giorni · {p.sessions_done} sessioni completate</T>
        </Card>
      ))}
    </Screen>
  );
}
