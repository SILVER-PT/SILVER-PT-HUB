import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";

export function ClientHub({ clientId, trainer }: { clientId: string; trainer?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const items = [
    { key: "plans", label: "Schede", icon: "list", href: `/plans/${clientId}` },
    { key: "progress", label: "Progressi", icon: "trending-up", href: `/progress/${clientId}` },
    { key: "measurements", label: "Misure ISSA", icon: "body", href: `/measurements/${clientId}` },
    { key: "photos", label: "Foto check", icon: "camera", href: `/photos/${clientId}` },
    { key: "videos", label: "Video tecnica", icon: "videocam", href: `/videos/${clientId}` },
    ...(trainer ? [{ key: "nutrition", label: "Alimentazione", icon: "nutrition", href: `/nutrition/${clientId}` }] : []),
  ];
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
