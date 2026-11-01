import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";

export function ClientHub({ clientId, trainer, nutri, visibility, chat }: { clientId: string; trainer?: boolean; nutri?: boolean; visibility?: Record<string, boolean>; chat?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const self = !trainer && !nutri;
  const all = [
    { key: "plans", label: "Schede", icon: "list", href: `/plans/${clientId}`, show: !nutri },
    { key: "progress", label: "Progressi", icon: "trending-up", href: `/progress/${clientId}`, show: !nutri },
    { key: "measurements", label: "Misure ISSA", icon: "body", href: `/measurements/${clientId}`, show: !self || !!visibility?.measurements },
    { key: "photos", label: "Foto check", icon: "camera", href: `/photos/${clientId}`, show: !nutri },
    { key: "videos", label: "Video tecnica", icon: "videocam", href: `/videos/${clientId}`, show: !nutri },
    { key: "nutrition", label: "Diario cibo", icon: "nutrition", href: `/nutrition/${clientId}`, show: !self },
    { key: "nutrition-plan", label: "Piano alimentare", icon: "document-text", href: `/nutrition-plan/${clientId}`, show: true },
    { key: "food-history", label: "Storico alimenti", icon: "time", href: `/food-history/${clientId}`, show: !self },
    { key: "packages", label: "Abbonamenti", icon: "pricetags", href: "/packages", show: self },
    { key: "chat", label: "Chat coaching", icon: "chatbubble-ellipses", href: `/chat/${clientId}`, show: !nutri && !!chat },
    { key: "questions", label: "Chiedi al coach", icon: "chatbubbles", href: "/questions", show: self },
    { key: "team-notes", label: "Note team", icon: "lock-closed", href: `/team-notes/${clientId}`, show: !!nutri },
  ];
  const items = all.filter((i) => i.show);
  return (
    <View style={s.grid}>
      {items.map((it) => (
        <Pressable
          key={it.key}
          testID={`hub-${it.key}-button`}
          onPress={() => router.push(it.href as any)}
          style={({ pressed }) => [s.tile, pressed && { borderColor: colors.brandPrimary, transform: [{ scale: 0.97 }] }]}
        >
          <Ionicons name={it.icon as any} size={24} color={colors.brandPrimary} />
          <Text style={s.tileText}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { width: "47%", flexGrow: 1, height: 88, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, padding: 14, justifyContent: "space-between" },
  tileText: { color: c.onSurface, fontWeight: "800", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5 },
}));
