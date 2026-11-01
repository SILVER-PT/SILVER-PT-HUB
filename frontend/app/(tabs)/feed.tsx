import { useRouter } from "expo-router";
import { View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { fmtDate, useFetch } from "@/src/api";
import { Card, Empty, H, Loading, Screen, T } from "@/src/ui";
import { Nutrition } from "@/src/nutrition";
import { useTheme } from "@/src/theme";

function VideoInbox() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading } = useFetch<any[]>("/videos");
  const pending = (data || []).filter((v) => !v.reviewed);
  const done = (data || []).filter((v) => v.reviewed);
  const row = (v: any) => (
    <Card key={v.id} testID={`inbox-video-${v.id}`} onPress={() => router.push(`/video/${v.id}`)} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <Ionicons name="play-circle" size={36} color={v.reviewed ? colors.muted : colors.brandPrimary} />
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: "800" }}>{v.exercise}</T>
        <T muted style={{ fontSize: 13 }}>{v.client_name} · {fmtDate(v.created_at, true)}</T>
      </View>
    </Card>
  );
  return (
    <Screen title="Video da correggere" tab>
      {loading && !data ? <Loading /> : null}
      <H>{`Da rivedere (${pending.length})`}</H>
      {data && pending.length === 0 ? <Empty icon="checkmark-done-outline" text="Tutti i video sono stati rivisti." /> : null}
      {pending.map(row)}
      {done.length ? <H>Rivisti</H> : null}
      {done.map(row)}
    </Screen>
  );
}

export default function Feed() {
  const { user } = useAuth();
  if (user?.role === "trainer") return <VideoInbox />;
  return <Nutrition clientId={user!.id} tab />;
}
