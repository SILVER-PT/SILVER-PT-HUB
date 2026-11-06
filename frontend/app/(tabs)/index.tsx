import { useCallback, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, fmtDate, useFetch } from "@/src/api";
import { Avatar, Btn, Card, Empty, ErrorText, Field, H, Laser, Loading, Screen, T } from "@/src/ui";
import { ClientHub } from "@/src/client-hub";
import { Renewals } from "@/src/renewals";
import { useTheme } from "@/src/theme";

function TrainerHome() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading, error } = useFetch<any[]>("/clients");
  const questions = useFetch<any[]>(user?.role === "trainer" ? "/questions" : null);
  const unread = useFetch<Record<string, number>>(user?.role === "trainer" ? "/chat-unread" : null);
  const openQ = (questions.data || []).filter((x) => x.status === "open").length;
  const [q, setQ] = useState("");
  const list = (data || []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Screen title="I miei clienti" tab>
      {user?.role === "trainer" ? (
        <Card accent testID="invite-code-card">
          <T muted style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>CODICE INVITO CLIENTI E NUTRIZIONISTI</T>
          <T testID="invite-code-text" style={{ fontSize: 32, fontWeight: "900", letterSpacing: 6, color: colors.brandPrimary }}>{user?.invite_code}</T>
          <T muted>Condividilo: i clienti lo inseriscono alla registrazione.</T>
        </Card>
      ) : (
        <Card accent testID="nutri-info-card">
          <T style={{ fontWeight: "900" }}>Area nutrizione</T>
          <T muted style={{ fontSize: 13 }}>Qui trovi i clienti che il coach ti ha assegnato.</T>
        </Card>
      )}
      <Field testID="clients-search-input" placeholder="Cerca cliente..." value={q} onChangeText={setQ} />
      {user?.role === "trainer" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn testID="questions-inbox-button" small variant={openQ ? "primary" : "dark"} icon="chatbubbles" title="Domande" style={{ flex: 1 }} onPress={() => router.push("/questions")} />
          <Btn testID="plans-history-button" small variant="dark" icon="archive" title="Storico" style={{ flex: 1 }} onPress={() => router.push("/plans-history")} />
          <Btn testID="packages-button" small variant="dark" icon="pricetags" title="Listino" style={{ flex: 1 }} onPress={() => router.push("/packages")} />
        </View>
      ) : null}
      {user?.role === "trainer" ? <Btn testID="copilot-button" variant="ghost" icon="sparkles" title="Copilot AI" onPress={() => router.push("/copilot")} /> : null}
      {user?.role === "trainer" && data ? <Renewals clients={data} /> : null}
      <H>{`Clienti (${data?.length ?? 0})`}</H>
      {loading && !data ? <Loading /> : null}
      <ErrorText text={error} />
      {data && list.length === 0 ? <Empty icon="people-outline" text="Nessun cliente ancora. Condividi il tuo codice invito." /> : null}
      {list.map((c) => (
        <Card key={c.id} testID={`client-card-${c.id}`} onPress={() => router.push(`/client/${c.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar path={c.avatar} name={c.name} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: "800" }}>{c.name}</T>
            <T muted style={{ fontSize: 13 }}>{c.profile?.goal || c.email}</T>
          </View>
          {unread.data?.[c.id] ? (
            <View testID={`unread-badge-${c.id}`} style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
              <T style={{ color: colors.onBrandPrimary, fontSize: 12, fontWeight: "900" }}>{unread.data[c.id]}</T>
            </View>
          ) : null}
          {c.profile?.competitor ? <Ionicons name="trophy" size={18} color={colors.silver} /> : null}
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Card>
      ))}
    </Screen>
  );
}

function ClientHome() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  useFocusEffect(useCallback(() => { refresh().catch(() => {}); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  const plans = useFetch<any[]>(`/plans?client_id=${user!.id}`);
  const sessions = useFetch<any[]>(`/sessions?client_id=${user!.id}`);
  const unread = useFetch<Record<string, number>>(user?.subscription?.chat ? "/chat-unread" : null);
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
      {plans.data?.filter((p) => p.active !== false).length === 0 ? <Empty icon="barbell-outline" text="Il tuo coach non ti ha ancora assegnato una scheda." /> : null}
      {plans.data?.filter((p) => p.active !== false && p.days?.length).map((p) => (
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
      <ClientHub clientId={user!.id} visibility={user?.visibility as any} chat={!!user?.subscription?.chat} badges={{ chat: unread.data?.[user!.id] || 0 }} />
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
  return user?.role === "client" ? <ClientHome /> : <TrainerHome />;
}
