import { useLocalSearchParams } from "expo-router";
import { api, fmtDate, useFetch } from "@/src/api";
import { Btn, Card, Comments, Loading, Screen, T } from "@/src/ui";
import { Q_STATUS } from "@/app/questions/index";

export default function QuestionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: q, reload } = useFetch<any>(`/questions/${id}`);
  return (
    <Screen title="Domanda" back>
      {!q ? <Loading /> : (
        <>
          <Card accent testID="question-detail-card">
            <T style={{ fontWeight: "900", fontSize: 18 }}>{q.subject}</T>
            <T>{q.text}</T>
            <T muted style={{ fontSize: 12 }}>{q.client_name} · {fmtDate(q.created_at, true)} · {Q_STATUS[q.status]}</T>
          </Card>
          <Comments items={q.comments} onSend={async (text) => { await api(`/questions/${id}/comments`, { method: "POST", body: { text } }); reload(); }} />
          {q.status !== "closed" ? (
            <Btn testID="question-close-button" variant="ghost" icon="checkmark-done" title="Segna come risolta" onPress={async () => { await api(`/questions/${id}/status`, { method: "PUT", body: { status: "closed" } }); reload(); }} />
          ) : null}
        </>
      )}
    </Screen>
  );
}
