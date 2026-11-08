import { View } from "react-native";
import { useRouter } from "expo-router";
import { fmtDate, useFetch } from "@/src/api";
import { Avatar, Card, Empty, H, Loading, Screen, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

export default function TeamLive() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: d } = useFetch<any>("/dashboard");
  const clients = useFetch<any[]>("/clients");
  if (!d) return <Screen title="Clienti" back><Loading /></Screen>;
  const onlineIds = new Set(d.online.map((o: any) => o.id));
  return (
    <Screen title={`Clienti (${d.clients})`} back>
      <H>{`In sessione ora (${d.active_sessions.length})`}</H>
      {d.active_sessions.length === 0 ? <T muted>Nessuna sessione attiva.</T> : null}
      {d.active_sessions.map((s: any) => (
        <Card key={s.id} accent testID={`live-session-${s.id}`} onPress={() => router.push(`/session/${s.id}`)} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Avatar path={s.avatar} name={s.client_name} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: "800" }}>{s.client_name}</T>
            <T muted style={{ fontSize: 12 }}>{s.day_name} · {s.status === "paused" ? "in pausa" : "in corso"} da {fmtDate(s.started_at, true)}</T>
          </View>
          <T style={{ color: colors.brandPrimary, fontWeight: "900" }}>LIVE</T>
        </Card>
      ))}
      <H>{`Connessi (${d.online.length})`}</H>
      {d.online.length === 0 ? <T muted>Nessun cliente connesso negli ultimi 5 minuti.</T> : null}
      <H>Tutti</H>
      {clients.data?.length === 0 ? <Empty icon="people-outline" text="Nessun cliente." /> : null}
      {clients.data?.map((c) => (
        <Card key={c.id} testID={`team-client-${c.id}`} onPress={() => router.push(`/client/${c.id}`)} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Avatar path={c.avatar} name={c.name} />
          <T style={{ flex: 1, fontWeight: "700" }}>{c.name}</T>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: onlineIds.has(c.id) ? colors.success : colors.border }} />
        </Card>
      ))}
    </Screen>
  );
}
