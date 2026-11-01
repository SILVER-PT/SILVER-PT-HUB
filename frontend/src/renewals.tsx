import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Card, H, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

// Next renewal date from subscription start: monthly -> same day each month, annual -> anniversary.
export function nextRenewal(since: string, billing: string) {
  const s = new Date(since + "T12:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(s);
  while (d < now) {
    if (billing === "annuale") d.setFullYear(d.getFullYear() + 1);
    else {
      const day = s.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    }
  }
  return { date: d, days: Math.round((d.getTime() - now.getTime()) / 86400000) };
}

export function Renewals({ clients }: { clients: any[] }) {
  const router = useRouter();
  const { colors } = useTheme();
  const rows = clients
    .filter((c) => c.subscription?.since)
    .map((c) => ({ c, ...nextRenewal(c.subscription.since, c.subscription.billing) }))
    .sort((a, b) => a.days - b.days);
  if (!rows.length) return null;
  const due = rows.filter((r) => r.days <= 7).length;
  return (
    <View style={{ gap: 8 }}>
      <H>{`Rinnovi${due ? ` · ${due} in scadenza` : ""}`}</H>
      <Card testID="renewals-card">
        {rows.slice(0, 8).map(({ c, date, days }) => (
          <Pressable key={c.id} testID={`renewal-row-${c.id}`} onPress={() => router.push(`/client/${c.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: days <= 3 ? colors.brandPrimary : days <= 7 ? colors.warning : colors.success }} />
            <View style={{ flex: 1 }}>
              <T testID={`renewal-${c.id}`} style={{ fontWeight: "800", fontSize: 14 }} numberOfLines={1} >{c.name}</T>
              <T muted style={{ fontSize: 12 }} numberOfLines={1}>{c.subscription.name} · {c.subscription.price}€ {c.subscription.billing} · dal {new Date(c.subscription.since + "T12:00:00").toLocaleDateString("it-IT")}</T>
            </View>
            <T style={{ fontSize: 12, fontWeight: "900", color: days <= 3 ? colors.brandPrimary : colors.silver, textAlign: "right" }}>
              {days === 0 ? "OGGI" : `${days} gg`}{"\n"}
              <T muted style={{ fontSize: 11 }}>{date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</T>
            </T>
          </Pressable>
        ))}
      </Card>
    </View>
  );
}
