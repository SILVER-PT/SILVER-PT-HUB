import { useLocalSearchParams } from "expo-router";
import { api, useFetch } from "@/src/api";
import { Card, Comments, Loading, Screen, T } from "@/src/ui";

export default function TeamNotes() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { data, reload } = useFetch<any[]>(`/clients/${clientId}/team-notes`);
  return (
    <Screen title="Note del team" back>
      <Card accent><T muted>Visibili solo a coach e nutrizionista. Il cliente non le vede.</T></Card>
      {!data ? <Loading /> : (
        <Comments items={data} onSend={async (text) => { await api(`/clients/${clientId}/team-notes`, { method: "POST", body: { text } }); reload(); }} />
      )}
    </Screen>
  );
}
