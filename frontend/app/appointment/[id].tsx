import { Linking, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/src/auth";
import { api, fmtDate, useFetch } from "@/src/api";
import { Btn, Card, Comments, H, Loading, Screen, T } from "@/src/ui";
import { WaTemplates } from "@/src/whatsapp";
import { STATUS } from "@/app/(tabs)/agenda";

export default function AppointmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const staff = user?.role !== "client";
  const { data: a, reload } = useFetch<any>(`/appointments/${id}`);
  const client = useFetch<any>(staff && a ? `/clients/${a.client_id}` : null);
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
          {a.video_link ? <Btn testID="appointment-join-video" icon="videocam" title="Entra in videochiamata" onPress={() => Linking.openURL(a.video_link)} /> : null}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {staff && a.status !== "confirmed" ? <Btn testID="appointment-confirm-button" small icon="checkmark" title="Conferma" onPress={() => setStatus("confirmed")} /> : null}
            {staff && a.status !== "done" ? <Btn testID="appointment-done-button" small variant="dark" icon="flag" title="Completato" onPress={() => setStatus("done")} /> : null}
            {a.status !== "cancelled" ? <Btn testID="appointment-cancel-button" small variant="ghost" icon="close" title="Annulla" onPress={() => setStatus("cancelled")} /> : null}
          </View>
          {staff && client.data ? (
            <>
              <H>Messaggi WhatsApp</H>
              <WaTemplates phone={client.data.profile?.phone} name={client.data.name} staffName={user!.name} appt={a} />
            </>
          ) : null}
          <Comments items={a.comments} onSend={async (text) => { await api(`/appointments/${id}/comments`, { method: "POST", body: { text } }); reload(); }} />
        </>
      )}
    </Screen>
  );
}
