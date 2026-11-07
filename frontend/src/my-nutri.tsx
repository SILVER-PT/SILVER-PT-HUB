import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { useFetch } from "@/src/api";
import { Avatar, Card, H, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

// Client: card with the chosen nutritionist -> opens the professional's profile (change is done there).
export function MyNutritionist() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const nid = user?.nutritionist_id;
  const n = useFetch<any>(nid ? `/staff/${nid}` : null);
  const [, force] = useState(0);
  if (user?.role !== "client") return null;
  return (
    <View style={{ gap: 8 }}>
      <H>Il tuo nutrizionista</H>
      {nid && n.data ? (
        <Card testID="my-nutri-card" onPress={() => router.push(`/staff/${nid}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar path={n.data.avatar} name={n.data.name} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: "800" }}>{n.data.name}</T>
            <T muted style={{ fontSize: 13 }}>{n.data.title || "Nutrizionista / Dietista"}</T>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Card>
      ) : (
        <Card testID="choose-nutri-card" onPress={() => { force(1); router.push("/staff/choose"); }} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Ionicons name="nutrition" size={24} color={colors.brandPrimary} />
          <T style={{ flex: 1, fontWeight: "800" }}>Scegli un nutrizionista</T>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Card>
      )}
    </View>
  );
}
