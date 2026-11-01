import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/src/auth";
import { api, fmtDate, useFetch } from "@/src/api";
import { Btn, Card, Comments, Loading, Screen, T } from "@/src/ui";
import { STATUS } from "@/app/(tabs)/agenda";

export default function AppointmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: a, reload } = useFetch<any>(`/appointments/${id}`);
  const setStatus = async (status: string) => {
    await api(`/appointments/${id}/status`, { method: "PUT", body: { status } });
    reload();
  };
  return (
    <Screen title="Appuntamento" back>
      {!a ? <Loading /> : (
        <>
          <Card accent testID="appointment-detail-card">
            <T style={{ fontSize: 20, fontWeight: "900" }}>{a.title}</T>
            <T>{fmtDate(a.start, true)} · {a.duration_min} min</T>
            <T muted>Cliente: {a.client_name}</T>
            {a.location ? <T muted>Luogo: {a.location}</T> : null}
            {a.notes ? <T muted>{a.notes}</T> : null}
            <T testID="appointment-status-text" style={{ fontWeight: "800" }}>Stato: {STATUS[a.status]}</T>
          </Card>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {user?.role === "trainer" && a.status !== "confirmed" ? <Btn testID="appointment-confirm-button" small icon="checkmark" title="Conferma" onPress={() => setStatus("confirmed")} /> : null}
            {user?.role === "trainer" && a.status !== "done" ? <Btn testID="appointment-done-button" small variant="dark" icon="flag" title="Completato" onPress={() => setStatus("done")} /> : null}
            {a.status !== "cancelled" ? <Btn testID="appointment-cancel-button" small variant="ghost" icon="close" title="Annulla" onPress={() => setStatus("cancelled")} /> : null}
          </View>
          <Comments items={a.comments} onSend={async (text) => { await api(`/appointments/${id}/comments`, { method: "POST", body: { text } }); reload(); }} />
        </>
      )}
    </Screen>
  );
}
