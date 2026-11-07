import { View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useFetch } from "@/src/api";
import { Card, T } from "@/src/ui";
import { ANAMNESIS, daysTo } from "@/app/(tabs)/profile";
import { useTheme } from "@/src/theme";

// Reminder of client's anamnesis + bodybuilding category, shown while building plans / diets.
export function ClientReminder({ clientId }: { clientId: string }) {
  const { colors } = useTheme();
  const { data: c } = useFetch<any>(`/clients/${clientId}`);
  if (!c) return null;
  const p = c.profile || {};
  const an = ANAMNESIS.filter(([k]) => p.anamnesis?.[k]?.trim());
  const legacy = p.injuries?.trim();
  return (
    <View style={{ gap: 8 }}>
      {p.competitor ? (
        <Card testID="competitor-badge" style={{ flexDirection: "row", alignItems: "center", gap: 10, borderColor: colors.brandPrimary }}>
          <Ionicons name="trophy" size={20} color={colors.silver} />
          <T style={{ flex: 1, fontWeight: "800" }}>{p.category || "Bodybuilding"} · {p.off_season ? "OFF SEASON" : p.contest_date ? `GARA tra ${daysTo(p.contest_date)} giorni` : "In preparazione"}</T>
        </Card>
      ) : null}
      {an.length || legacy ? (
        <Card testID="anamnesis-reminder" style={{ borderColor: colors.warning, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="medkit" size={18} color={colors.warning} />
            <T style={{ fontWeight: "900", color: colors.warning }}>RICORDA L&apos;ANAMNESI DI {c.name.toUpperCase()}</T>
          </View>
          {legacy ? <T style={{ fontSize: 13 }}><T muted style={{ fontSize: 13 }}>Infortuni/patologie: </T>{p.injuries}</T> : null}
          {an.map(([k, l]) => <T key={k} style={{ fontSize: 13 }}><T muted style={{ fontSize: 13 }}>{l}: </T>{p.anamnesis[k]}</T>)}
        </Card>
      ) : null}
    </View>
  );
}
