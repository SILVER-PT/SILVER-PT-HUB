import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { api, fmtDate, useFetch } from "@/src/api";
import { Btn, Card, Empty, ErrorText, Field, Loading, Screen, Sheet, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

export const Q_STATUS: Record<string, string> = { open: "In attesa", answered: "Risposta", closed: "Chiusa" };

export default function Questions() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const client = user?.role === "client";
  const { data, loading, reload } = useFetch<any[]>("/questions");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ subject: "", text: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setErr("");
    if (!f.subject.trim() || !f.text.trim()) return setErr("Compila argomento e domanda");
    setBusy(true);
    try {
      await api("/questions", { method: "POST", body: f });
      setF({ subject: "", text: "" });
      setOpen(false);
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={client ? "Chiedi al coach" : "Domande clienti"} back right={client ? <Btn testID="new-question-button" small icon="add" title="Nuova" onPress={() => setOpen(true)} /> : null}>
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? <Empty icon="chatbubbles-outline" text={client ? "Hai un dubbio su esercizi, recupero o integrazione? Scrivi al tuo coach." : "Nessuna domanda ricevuta."} /> : null}
      {data?.map((q) => (
        <Card key={q.id} testID={`question-card-${q.id}`} onPress={() => router.push(`/questions/${q.id}`)} accent={!client && q.status === "open"}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <T style={{ fontWeight: "900", flex: 1 }} numberOfLines={1}>{q.subject}</T>
            <T style={{ fontSize: 12, fontWeight: "800", color: q.status === "open" ? colors.warning : q.status === "answered" ? colors.success : colors.muted }}>{Q_STATUS[q.status]}</T>
          </View>
          <T muted style={{ fontSize: 13 }} numberOfLines={2}>{q.text}</T>
          <T muted style={{ fontSize: 12 }}>{client ? "" : `${q.client_name} · `}{fmtDate(q.updated_at, true)}</T>
        </Card>
      ))}
      <Sheet visible={open} onClose={() => setOpen(false)} title="Nuova domanda">
        <Field testID="question-subject-input" label="Argomento" placeholder="es. Dolore alla spalla in panca" value={f.subject} onChangeText={(v) => setF({ ...f, subject: v })} />
        <Field testID="question-text-input" label="La tua domanda" multiline value={f.text} onChangeText={(v) => setF({ ...f, text: v })} />
        <ErrorText text={err} />
        <Btn testID="question-send-button" icon="send" title="Invia" loading={busy} onPress={send} />
      </Sheet>
    </Screen>
  );
}
