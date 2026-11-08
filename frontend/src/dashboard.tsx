import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFetch } from "@/src/api";
import { SilverIcon } from "@/src/ui";
import { makeStyles } from "@/src/theme";

export function useDashboard() {
  return useFetch<any>("/dashboard");
}

// Management tiles for the trainer / dietitian home.
export function DashTiles({ d, nutri }: { d: any; nutri?: boolean }) {
  const s = useStyles();
  const router = useRouter();
  const tiles = [
    { key: "clients", icon: "people", label: "Clienti", value: d?.clients ?? "—", sub: d ? `${d.online.length} online · ${d.active_sessions.length} in sessione` : "", href: "/team-live" },
    { key: "appts", icon: "calendar", label: "Appuntamenti", value: d ? `${d.appointments_today}` : "—", sub: d ? `oggi · ${d.appointments_week} questa settimana` : "", href: "/(tabs)/agenda" },
    { key: "finance", icon: "cash", label: "Finanze", value: d ? `${Math.round(d.finance.monthly_estimate)}€` : "—", sub: d ? `al mese · ${d.finance.renewals_30d.length} rinnovi in 30 gg` : "", href: "/finance" },
    nutri
      ? { key: "plans", icon: "document-text", label: "Tariffe", value: "", sub: "prestazioni e listino", href: "/packages" }
      : { key: "exercises", icon: "barbell", label: "Esercizi", value: "", sub: "libreria per distretti + tuoi video", href: "/exercises" },
  ];
  return (
    <View style={s.grid}>
      {tiles.map((t) => (
        <Pressable key={t.key} testID={`dash-${t.key}`} onPress={() => router.push(t.href as any)} style={({ pressed }) => [s.tile, pressed && s.pressed]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <SilverIcon name={t.icon} />
            {t.value !== "" ? <Text testID={`dash-${t.key}-value`} style={s.value}>{t.value}</Text> : null}
          </View>
          <Text style={s.label}>{t.label}</Text>
          <Text style={s.sub} numberOfLines={2}>{t.sub}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "47%", flexGrow: 1, minHeight: 124, borderRadius: 18, borderWidth: 1, borderColor: c.silver, backgroundColor: c.surfaceSecondary, padding: 14, gap: 6 },
  pressed: { borderColor: c.brandPrimary, transform: [{ scale: 0.97 }] },
  value: { color: c.brandPrimary, fontSize: 26, fontWeight: "900" },
  label: { color: c.onSurface, fontWeight: "900", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5 },
  sub: { color: c.muted, fontSize: 12 },
}));
