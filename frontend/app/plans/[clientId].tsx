import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { api, fmtDate, useFetch } from "@/src/api";
import { Btn, Card, Empty, ErrorText, H, Laser, Loading, Screen, T } from "@/src/ui";

export default function Plans() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { user } = useAuth();
  const trainer = user?.role === "trainer";
  const router = useRouter();
  const { data, loading } = useFetch<any[]>(`/plans?client_id=${clientId}`);
  const sessions = useFetch<any[]>(`/sessions?client_id=${clientId}`);
  const [err, setErr] = useState("");

  const start = async (planId: string, day: number) => {
    try {
      const s = await api("/sessions", { method: "POST", body: { plan_id: planId, day_index: day } });
      router.push(`/session/${s.id}`);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <Screen title="Schede" back right={trainer ? <Btn testID="new-plan-button" small icon="add" title="Nuova" onPress={() => router.push({ pathname: "/plan-edit", params: { clientId } })} /> : null}>
      <ErrorText text={err} />
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? <Empty icon="list-outline" text={trainer ? "Crea la prima scheda per questo cliente." : "Nessuna scheda assegnata."} /> : null}
      {data?.map((p) => (
        <Card key={p.id} testID={`plan-${p.id}`}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <T style={{ fontWeight: "900", fontSize: 18, flex: 1 }}>{p.name}</T>
            {trainer ? <Btn testID={`edit-plan-${p.id}`} small variant="dark" icon="create" title="Modifica" onPress={() => router.push({ pathname: "/plan-edit", params: { clientId, planId: p.id } })} /> : null}
          </View>
          {p.approach || p.active === false ? <T muted style={{ fontSize: 12, fontWeight: "800" }}>{p.approach ? p.approach.toUpperCase() : ""}{p.active === false ? " · ARCHIVIATA" : ""}</T> : null}
          {p.notes ? <T muted>{p.notes}</T> : null}
          {p.days.map((d: any, i: number) => (
            <View key={i} style={{ gap: 4, marginTop: 8 }}>
              <Laser style={{ opacity: 0.5 }} />
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                <T style={{ fontWeight: "800", flex: 1 }}>{d.name || `Giorno ${i + 1}`}</T>
                <Btn testID={`plan-start-${p.id}-${i}`} small icon="play" title="Avvia" onPress={() => start(p.id, i)} />
              </View>
              {d.exercises.map((e: any, j: number) => (
                <T key={j} muted style={{ fontSize: 13 }}>• {e.name} — {e.sets}×{e.reps}{e.load ? ` @ ${e.load}kg` : ""}{e.rir !== "" && e.rir != null ? ` · RIR ${e.rir}` : ""}{e.rest ? ` · rec ${e.rest}` : ""}</T>
              ))}
            </View>
          ))}
        </Card>
      ))}
      <H>Storico sessioni</H>
      {sessions.data?.length === 0 ? <T muted>Nessuna sessione.</T> : null}
      {sessions.data?.map((s) => (
        <Card key={s.id} testID={`session-row-${s.id}`} onPress={() => router.push(`/session/${s.id}`)}>
          <T style={{ fontWeight: "800" }}>{s.day_name} · {s.plan_name}</T>
          <T muted style={{ fontSize: 13 }}>{fmtDate(s.started_at, true)} · {s.status === "completed" ? "Completata" : "In corso"}</T>
        </Card>
      ))}
    </Screen>
  );
}
