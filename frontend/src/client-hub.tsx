import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SilverIcon } from "@/src/ui";
import { makeStyles, useTheme } from "@/src/theme";

export function ClientHub({ clientId, trainer, nutri, visibility, chat, badges, nutriChat }: { clientId: string; trainer?: boolean; nutri?: boolean; visibility?: Record<string, boolean>; chat?: boolean; badges?: Record<string, number>; nutriChat?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const self = !trainer && !nutri;
  const all = [
    { key: "plans", label: "Schede", icon: "list", href: `/plans/${clientId}`, show: true },
    { key: "progress", label: "Progressi", icon: "trending-up", href: `/progress/${clientId}`, show: true },
    { key: "measurements", label: "Misure ISSA", icon: "body", href: `/measurements/${clientId}`, show: !self || !!visibility?.measurements },
    { key: "photos", label: "Foto check", icon: "camera", href: `/photos/${clientId}`, show: true },
    { key: "videos", label: "Video tecnica", icon: "videocam", href: `/videos/${clientId}`, show: !nutri },
    { key: "blood", label: "Analisi sangue", icon: "water", href: `/blood/${clientId}`, show: true },
    { key: "nutrition", label: "Diario cibo", icon: "nutrition", href: `/nutrition/${clientId}`, show: !self },
    { key: "nutrition-plan", label: "Piano alimentare", icon: "document-text", href: `/nutrition-plan/${clientId}`, show: true },
    { key: "food-history", label: "Storico alimenti", icon: "time", href: `/food-history/${clientId}`, show: !self },
    { key: "packages", label: "Abbonamenti", icon: "pricetags", href: "/packages", show: self },
    { key: "chat", label: "Chat coaching", icon: "chatbubble-ellipses", href: `/chat/${clientId}`, show: !nutri && !!chat },
    { key: "nutri-chat", label: "Chat nutrizionista", icon: "chatbubbles-outline", href: `/chat/${clientId}?thread=nutri`, show: !trainer && !!nutriChat },
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
          <SilverIcon name={it.icon} />
          <Text style={s.tileText}>{it.label}</Text>
          {badges?.[it.key] ? (
            <View testID={`hub-${it.key}-badge`} style={s.badge}>
              <Text style={s.badgeText}>{badges[it.key]}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badge: { position: "absolute", top: 10, right: 10, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  badgeText: { color: c.onBrandPrimary, fontSize: 12, fontWeight: "900" },
  tile: { width: "47%", flexGrow: 1, height: 88, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, padding: 14, justifyContent: "space-between" },
  tileText: { color: c.onSurface, fontWeight: "800", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5 },
}));
