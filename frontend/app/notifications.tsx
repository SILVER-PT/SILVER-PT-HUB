import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api, fmtDate, useFetch } from "@/src/api";
import { Btn, Card, Empty, Loading, Screen, T } from "@/src/ui";
import { browserNotifGranted, browserNotifSupported, enableBrowserNotif, resetBellCount } from "@/src/notify";
import { useTheme } from "@/src/theme";

export default function Notifications() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading } = useFetch<any[]>("/notifications");
  const [granted, setGranted] = useState(browserNotifGranted());
  useEffect(() => {
    if (data?.some((n) => !n.read)) api("/notifications/read", { method: "POST" }).then(resetBellCount).catch(() => {});
  }, [data]);
  return (
    <Screen title="Notifiche" back>
      {browserNotifSupported() && !granted ? (
        <Card accent testID="browser-notif-card">
          <T style={{ fontWeight: "800" }}>Avvisi nel browser</T>
          <T muted style={{ fontSize: 13 }}>Ricevi un avviso sul computer anche quando l&apos;app è in un&apos;altra scheda.</T>
          <Btn testID="browser-notif-enable" small icon="notifications" title="Attiva avvisi browser" onPress={async () => setGranted((await enableBrowserNotif()) === "granted")} />
        </Card>
      ) : null}
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? <Empty icon="notifications-outline" text="Nessuna notifica." /> : null}
      {data?.map((n) => (
        <Card key={n.id} testID={`notif-${n.id}`} accent={!n.read} onPress={n.link ? () => router.push(n.link) : undefined} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Ionicons name={n.read ? "notifications-outline" : "notifications"} size={22} color={n.read ? colors.muted : colors.brandPrimary} />
          <View style={{ flex: 1, gap: 2 }}>
            <T style={{ fontWeight: "800" }}>{n.title}</T>
            {n.body ? <T muted style={{ fontSize: 13 }}>{n.body}</T> : null}
            <T muted style={{ fontSize: 11 }}>{fmtDate(n.created_at, true)}</T>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
