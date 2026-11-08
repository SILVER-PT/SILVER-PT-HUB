import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, fmtDate, useFetch } from "@/src/api";
import { Btn, Card, Empty, ErrorText, H, Loading, Screen, SilverIcon, T } from "@/src/ui";
import { ClientHub } from "@/src/client-hub";
import { useTheme } from "@/src/theme";

const MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const period = (iso?: string) => { const d = new Date(iso || Date.now()); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

// Client: plans organised by period. Staff: their own workout & diet area, separate from clients.
export default function Training() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const uid = user!.id;
  const { data, loading } = useFetch<any[]>(`/plans?client_id=${uid}`);
  const sessions = useFetch<any[]>(`/sessions?client_id=${uid}`);
  const [err, setErr] = useState("");
  const staff = user?.role !== "client";
  const active = (data || []).filter((p) => p.active !== false);
  const archived = (data || []).filter((p) => p.active === false);
  const groups: Record<string, any[]> = {};
  archived.forEach((p) => { (groups[period(p.created_at)] ||= []).push(p); });
  const start = async (planId: string) => {
    try {
      const s = await api("/sessions", { method: "POST", body: { plan_id: planId, day_index: 0 } });
      router.push(`/session/${s.id}`);
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const planCard = (p: any) => (
    <Card key={p.id} testID={`training-plan-${p.id}`} accent={p.active !== false} onPress={() => router.push(`/plans/${uid}`)} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <SilverIcon name="barbell" />
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: "900" }}>{p.name || "Scheda"}</T>
        <T muted style={{ fontSize: 12 }}>{p.days.length} giorni{p.approach ? ` · ${p.approach}` : ""} · dal {fmtDate(p.created_at)}</T>
      </View>
      {p.active !== false && p.days.length ? <Btn testID={`training-start-${p.id}`} small icon="play" title="Avvia" onPress={() => start(p.id)} /> : <Ionicons name="chevron-forward" size={20} color={colors.muted} />}
    </Card>
  );
  const done = (sessions.data || []).filter((s) => s.status === "completed");
  return (
    <Screen title={staff ? "Il mio workout" : "Training"} tab>
      {staff ? (
        <Card accent testID="my-training-info">
          <T style={{ fontWeight: "900" }}>La tua area personale</T>
          <T muted style={{ fontSize: 13 }}>Schede, sessioni, misure e dieta tue, separate da quelle dei clienti. Puoi crearle da solo o farti seguire da un coach o nutrizionista in app.</T>
          <Btn testID="my-plan-new" small icon="add" title="Crea la mia scheda" onPress={() => router.push({ pathname: "/plan-edit", params: { clientId: uid } })} />
        </Card>
      ) : null}
      <ErrorText text={err} />
      {loading && !data ? <Loading /> : null}
      <H>{`In corso (${active.length})`}</H>
      {data && active.length === 0 ? <Empty icon="barbell-outline" text={staff ? "Nessuna scheda personale." : "Nessuna scheda attiva."} /> : null}
      {active.map(planCard)}
      {Object.entries(groups).map(([k, ps]) => (
        <View key={k} style={{ gap: 8 }}>
          <H>{k}</H>
          {ps.map(planCard)}
        </View>
      ))}
      <H>{`Sessioni completate (${done.length})`}</H>
      {done.slice(0, 10).map((s) => (
        <Card key={s.id} onPress={() => router.push(`/session/${s.id}`)}>
          <T style={{ fontWeight: "800" }}>{s.day_name} · {s.plan_name}</T>
          <T muted style={{ fontSize: 12 }}>{fmtDate(s.started_at, true)}</T>
        </Card>
      ))}
      {staff ? (
        <>
          <H>La mia area</H>
          <ClientHub clientId={uid} visibility={{ measurements: true, photos: true, nutrition: true }} />
        </>
      ) : null}
    </Screen>
  );
}
