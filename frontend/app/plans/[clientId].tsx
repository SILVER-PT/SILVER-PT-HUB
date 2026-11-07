import { useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, fmtDate, useFetch } from "@/src/api";
import { Btn, Card, Empty, ErrorText, H, Loading, Screen, Sheet, T } from "@/src/ui";
import { ExerciseImages } from "@/src/exercises";
import { useTheme } from "@/src/theme";

const STATUS: Record<string, string> = { completed: "Completata", paused: "In pausa", in_progress: "In corso" };

function ExerciseRow({ e, n }: { e: any; n: number }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable testID={`plan-ex-${n}`} onPress={() => setOpen(!open)} style={{ gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.divider }}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
          <T style={{ fontWeight: "900", fontSize: 12 }}>{n}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "800" }}>{e.name}{e.technique ? <T style={{ color: colors.brandPrimary, fontSize: 12 }}>{`  · ${e.technique}`}</T> : null}</T>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {[e.scheme?.length ? e.protocol : `${e.sets} × ${e.reps}${e.type === "time" ? "s" : ""}`, e.load ? `${e.load} kg` : "", e.rir !== "" && e.rir != null ? `RIR ${e.rir}` : "", e.rest ? `⏱ ${e.rest}` : "", e.district || ""]
              .filter(Boolean).map((x, i) => (
                <View key={i} style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.surfaceTertiary }}>
                  <T style={{ fontSize: 12, fontWeight: "700" }}>{x}</T>
                </View>
              ))}
          </View>
        </View>
        {e.images?.length || e.notes ? <Ionicons name={open ? "chevron-up" : "images-outline"} size={18} color={colors.muted} /> : null}
      </View>
      {open ? (
        <>
          <ExerciseImages images={e.images} size={110} />
          {e.notes ? <T muted style={{ fontSize: 13 }}>📝 {e.notes}</T> : null}
        </>
      ) : null}
    </Pressable>
  );
}

export default function Plans() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { user } = useAuth();
  const trainer = user?.role === "trainer";
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading, reload } = useFetch<any[]>(`/plans?client_id=${clientId}`);
  const sessions = useFetch<any[]>(`/sessions?client_id=${clientId}`);
  const [err, setErr] = useState("");
  const [del, setDel] = useState<any>(null);
  const [day, setDay] = useState<Record<string, number>>({});

  const start = async (planId: string, d: number) => {
    try {
      const s = await api("/sessions", { method: "POST", body: { plan_id: planId, day_index: d } });
      router.push(`/session/${s.id}`);
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const remove = async (notify: boolean) => {
    try {
      await api(`/plans/${del.id}?notify_client=${notify}`, { method: "DELETE" });
      setDel(null);
      reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const open = (sessions.data || []).filter((s) => s.status !== "completed");

  return (
    <Screen title="Schede" back right={trainer ? <Btn testID="new-plan-button" small icon="add" title="Nuova" onPress={() => router.push({ pathname: "/plan-edit", params: { clientId } })} /> : null}>
      <ErrorText text={err} />
      {open.length ? (
        <>
          <H>Da riprendere</H>
          {open.map((s) => (
            <Card key={s.id} accent testID={`resume-session-${s.id}`} onPress={() => router.push(`/session/${s.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name={s.status === "paused" ? "pause-circle" : "play-circle"} size={28} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}><T style={{ fontWeight: "800" }}>{s.day_name} · {s.plan_name}</T><T muted style={{ fontSize: 12 }}>{STATUS[s.status]} · {fmtDate(s.started_at, true)}</T></View>
            </Card>
          ))}
        </>
      ) : null}
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? <Empty icon="list-outline" text={trainer ? "Crea la prima scheda per questo cliente." : "Nessuna scheda assegnata."} /> : null}
      {data?.map((p) => {
        const di = Math.min(day[p.id] || 0, p.days.length - 1);
        const d = p.days[di];
        return (
          <Card key={p.id} testID={`plan-${p.id}`} accent={p.active !== false}>
            <T style={{ fontWeight: "900", fontSize: 20 }}>{p.name}</T>
            {p.approach || p.active === false ? <T style={{ fontSize: 12, fontWeight: "800", color: colors.brandPrimary }}>{p.approach ? p.approach.toUpperCase() : ""}{p.active === false ? " · ARCHIVIATA" : ""}</T> : null}
            {p.volume?.weekly_total ? <T muted style={{ fontSize: 12 }}>Volume settimanale: {p.volume.weekly_total} serie</T> : null}
            {p.notes ? <T muted>{p.notes}</T> : null}
            {trainer ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Btn testID={`edit-plan-${p.id}`} small variant="dark" icon="create" title="Modifica" onPress={() => router.push({ pathname: "/plan-edit", params: { clientId, planId: p.id } })} />
                <Btn testID={`delete-plan-${p.id}`} small variant="ghost" icon="trash" title="Elimina" onPress={() => setDel(p)} />
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {p.days.map((x: any, i: number) => (
                <Pressable key={i} testID={`plan-day-tab-${p.id}-${i}`} onPress={() => setDay({ ...day, [p.id]: i })}
                  style={{ paddingHorizontal: 14, minHeight: 40, justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: i === di ? colors.brandPrimary : colors.border, backgroundColor: i === di ? colors.brandPrimary : "transparent" }}>
                  <T style={{ fontWeight: "800", fontSize: 13, color: i === di ? colors.onBrandPrimary : colors.onSurface }}>{x.name || `Giorno ${i + 1}`}</T>
                </Pressable>
              ))}
            </View>
            {d ? (
              <>
                {d.exercises.map((e: any, j: number) => <ExerciseRow key={j} e={e} n={j + 1} />)}
                <Btn testID={`plan-start-${p.id}-${di}`} icon="play" title={`Avvia ${d.name || `Giorno ${di + 1}`}`} onPress={() => start(p.id, di)} />
              </>
            ) : null}
          </Card>
        );
      })}
      <H>Storico sessioni</H>
      {sessions.data?.length === 0 ? <T muted>Nessuna sessione.</T> : null}
      {sessions.data?.map((s) => (
        <Card key={s.id} testID={`session-row-${s.id}`} onPress={() => router.push(`/session/${s.id}`)}>
          <T style={{ fontWeight: "800" }}>{s.day_name} · {s.plan_name}</T>
          <T muted style={{ fontSize: 13 }}>{fmtDate(s.started_at, true)} · {STATUS[s.status] || s.status}</T>
        </Card>
      ))}
      <Sheet visible={!!del} onClose={() => setDel(null)} title="Eliminare la scheda?">
        <T>«{del?.name}» verrà eliminata dall&apos;elenco schede. Le sessioni svolte restano nello storico sessioni. Vuoi avvisare il cliente?</T>
        <Btn testID="delete-plan-notify" icon="notifications" title="Elimina e notifica" onPress={() => remove(true)} />
        <Btn testID="delete-plan-silent" variant="dark" icon="trash" title="Elimina senza notificare" onPress={() => remove(false)} />
        <Btn variant="ghost" title="Annulla" onPress={() => setDel(null)} />
      </Sheet>
    </Screen>
  );
}
