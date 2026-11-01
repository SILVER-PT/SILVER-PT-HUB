import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, fmtDate, useFetch } from "@/src/api";
import { Btn, Card, Empty, ErrorText, Field, H, Laser, Loading, Screen, T } from "@/src/ui";
import { ClientHub } from "@/src/client-hub";
import { useTheme } from "@/src/theme";

function TrainerHome() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading, error } = useFetch<any[]>("/clients");
  const [q, setQ] = useState("");
  const list = (data || []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Screen title="I miei clienti" tab>
      <Card accent testID="invite-code-card">
        <T muted style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>CODICE INVITO CLIENTI</T>
        <T testID="invite-code-text" style={{ fontSize: 32, fontWeight: "900", letterSpacing: 6, color: colors.brandPrimary }}>{user?.invite_code}</T>
        <T muted>Condividilo: i clienti lo inseriscono alla registrazione.</T>
      </Card>
      <Field testID="clients-search-input" placeholder="Cerca cliente..." value={q} onChangeText={setQ} />
      <H>{`Clienti (${data?.length ?? 0})`}</H>
      {loading && !data ? <Loading /> : null}
      <ErrorText text={error} />
      {data && list.length === 0 ? <Empty icon="people-outline" text="Nessun cliente ancora. Condividi il tuo codice invito." /> : null}
      {list.map((c) => (
        <Card key={c.id} testID={`client-card-${c.id}`} onPress={() => router.push(`/client/${c.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
            <T style={{ fontWeight: "900", color: colors.onBrandTertiary }}>{c.name.slice(0, 1).toUpperCase()}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: "800" }}>{c.name}</T>
            <T muted style={{ fontSize: 13 }}>{c.profile?.goal || c.email}</T>
          </View>
          {c.profile?.competitor ? <Ionicons name="trophy" size={18} color={colors.silver} /> : null}
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Card>
      ))}
    </Screen>
  );
}

function ClientHome() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const plans = useFetch<any[]>(`/plans?client_id=${user!.id}`);
  const sessions = useFetch<any[]>(`/sessions?client_id=${user!.id}`);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const active = sessions.data?.find((s) => s.status === "in_progress");

  const start = async (planId: string, day: number) => {
    setBusy(`${planId}-${day}`);
    try {
      const s = await api("/sessions", { method: "POST", body: { plan_id: planId, day_index: day } });
      router.push(`/session/${s.id}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Screen title="Silver-PT" tab>
      <Image source={require("../../assets/images/logo-wide.png")} style={{ width: "70%", aspectRatio: 1100 / 275, alignSelf: "center" }} contentFit="contain" />
      <T style={{ fontSize: 24, fontWeight: "900", fontStyle: "italic" }}>Ciao {user?.name.split(" ")[0]}</T>
      {active ? (
        <Card accent testID="active-session-card" onPress={() => router.push(`/session/${active.id}`)}>
          <T muted style={{ fontSize: 12, fontWeight: "700" }}>SESSIONE IN CORSO</T>
          <T style={{ fontWeight: "900", fontSize: 18 }}>{active.day_name} · {active.plan_name}</T>
          <T style={{ color: colors.brandPrimary, fontWeight: "800" }}>Riprendi →</T>
        </Card>
      ) : null}
      <H>Le tue schede</H>
      <ErrorText text={err} />
      {plans.loading && !plans.data ? <Loading /> : null}
      {plans.data?.length === 0 ? <Empty icon="barbell-outline" text="Il tuo coach non ti ha ancora assegnato una scheda." /> : null}
      {plans.data?.map((p) => (
        <Card key={p.id} testID={`plan-card-${p.id}`}>
          <T style={{ fontWeight: "900", fontSize: 18 }}>{p.name}</T>
          {p.notes ? <T muted>{p.notes}</T> : null}
          <Laser style={{ marginVertical: 4, opacity: 0.6 }} />
          {p.days.map((d: any, i: number) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: "800" }}>{d.name || `Giorno ${i + 1}`}</T>
                <T muted style={{ fontSize: 13 }}>{d.exercises?.length || 0} esercizi</T>
              </View>
              <Btn testID={`start-session-${p.id}-${i}`} small icon="play" title="Avvia" loading={busy === `${p.id}-${i}`} onPress={() => start(p.id, i)} />
            </View>
          ))}
        </Card>
      ))}
      <H>Il mio percorso</H>
      <ClientHub clientId={user!.id} />
      <H>Ultime sessioni</H>
      {sessions.data?.filter((s) => s.status === "completed").slice(0, 5).map((s) => (
        <Card key={s.id} testID={`session-history-${s.id}`} onPress={() => router.push(`/session/${s.id}`)}>
          <T style={{ fontWeight: "800" }}>{s.day_name} · {s.plan_name}</T>
          <T muted style={{ fontSize: 13 }}>{fmtDate(s.started_at, true)}</T>
        </Card>
      ))}
      {sessions.data && !sessions.data.some((s) => s.status === "completed") ? <T muted>Nessuna sessione completata.</T> : null}
    </Screen>
  );
}

export default function Home() {
  const { user } = useAuth();
  return user?.role === "trainer" ? <TrainerHome /> : <ClientHome />;
}
