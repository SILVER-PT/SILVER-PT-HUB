import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, useFetch } from "@/src/api";
import { Btn, Card, ErrorText, Sheet, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

// Existing users must accept the required documents (new/updated versions) before using the app.
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { user, refresh, logout } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error } = useFetch<any[]>(user ? `/legal/docs?role=${user.role}` : null);
  const [doc, setDoc] = useState<any>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!user) return <>{children}</>;
  if (!data) return error ? <>{children}</> : <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  const mine = Object.fromEntries((user.consents || []).map((c) => [c.id, c.version]));
  const missing = data.filter((d) => d.required && mine[d.id] !== d.version);
  if (!missing.length) return <>{children}</>;
  const accept = async () => {
    setBusy(true);
    setErr("");
    try {
      for (const d of missing) await api("/me/consents", { method: "POST", body: { id: d.id, accepted: true } });
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const all = missing.every((d) => checked[d.id]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 16 }} testID="consent-gate">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}>
        <T style={{ fontSize: 22, fontWeight: "900" }}>Documenti da accettare</T>
        <T muted>Per continuare a usare SILVER-PT HUB e trattare i tuoi dati in modo conforme alla legge (GDPR) devi leggere e accettare questi documenti.</T>
        {missing.map((d) => (
          <Card key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable testID={`gate-consent-${d.id}`} hitSlop={8} onPress={() => setChecked({ ...checked, [d.id]: !checked[d.id] })}>
              <Ionicons name={checked[d.id] ? "checkbox" : "square-outline"} size={26} color={checked[d.id] ? colors.brandPrimary : colors.muted} />
            </Pressable>
            <Pressable style={{ flex: 1 }} onPress={() => setDoc(d)}>
              <T style={{ fontWeight: "800", textDecorationLine: "underline" }}>{d.title}</T>
            </Pressable>
          </Card>
        ))}
        <ErrorText text={err} />
        <Btn testID="gate-accept-button" icon="shield-checkmark" title="Accetto e continuo" disabled={!all} loading={busy} onPress={accept} />
        <Btn testID="gate-select-all" variant="dark" title="Seleziona tutti" onPress={() => setChecked(Object.fromEntries(missing.map((d) => [d.id, true])))} />
        <Btn variant="ghost" title="Esci" onPress={logout} />
      </ScrollView>
      <Sheet visible={!!doc} onClose={() => setDoc(null)} title={doc?.title || ""}>
        <T style={{ fontSize: 13, lineHeight: 20 }}>{doc?.text?.trim()}</T>
        <Btn title="Accetto" onPress={() => { setChecked({ ...checked, [doc.id]: true }); setDoc(null); }} />
      </Sheet>
    </View>
  );
}
