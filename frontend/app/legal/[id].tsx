import { useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, fmtDate, useFetch } from "@/src/api";
import { Card, ErrorText, H, Loading, Screen, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

// /legal/all -> list of documents + my consents; /legal/<id> -> full text
export default function Legal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, refresh } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const { data } = useFetch<any[]>(`/legal/docs${user ? `?role=${user.role}` : ""}`);
  const [err, setErr] = useState("");
  if (!data) return <Screen title="Documenti" back><Loading /></Screen>;
  if (id !== "all") {
    const d = data.find((x) => x.id === id);
    return (
      <Screen title={d?.title || "Documento"} back>
        <T muted style={{ fontSize: 12 }}>Versione {d?.version}</T>
        <Card><T testID="legal-text" style={{ fontSize: 14, lineHeight: 21 }}>{d?.text.trim()}</T></Card>
      </Screen>
    );
  }
  const mine: Record<string, any> = Object.fromEntries((user?.consents || []).map((c: any) => [c.id, c]));
  const toggle = async (d: any) => {
    setErr("");
    try {
      await api("/me/consents", { method: "POST", body: { id: d.id, accepted: !mine[d.id] } });
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <Screen title="Privacy e documenti" back>
      <T muted style={{ fontSize: 13 }}>Dati sanitari, anamnesi, analisi e messaggi sono cifrati (AES-256); la chat usa la crittografia end-to-end. Puoi revocare i consensi facoltativi in ogni momento.</T>
      <ErrorText text={err} />
      <H>Documenti</H>
      {data.map((d) => (
        <Card key={d.id} testID={`consent-${d.id}`} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={() => (d.required ? null : toggle(d))} hitSlop={8} testID={`consent-toggle-${d.id}`}>
            <Ionicons name={mine[d.id] ? "checkbox" : "square-outline"} size={24} color={mine[d.id] ? colors.brandPrimary : colors.muted} />
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => router.push(`/legal/${d.id}`)}>
            <T style={{ fontWeight: "800" }}>{d.title}{d.required ? " *" : ""}</T>
            <T muted style={{ fontSize: 11 }}>{mine[d.id] ? `Accettato il ${fmtDate(mine[d.id].accepted_at)} · v${mine[d.id].version}` : d.required ? "Obbligatorio" : "Facoltativo · non accettato"}</T>
          </Pressable>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Card>
      ))}
      <View style={{ height: 8 }} />
      <T muted style={{ fontSize: 11 }}>Per esercitare i diritti GDPR (accesso, cancellazione, portabilità) o chiudere l&apos;account contatta il titolare indicato nell&apos;informativa.</T>
    </Screen>
  );
}
