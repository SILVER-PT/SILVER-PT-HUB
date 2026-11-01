import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api, fmtDate, uploadFile, useFetch } from "@/src/api";
import { Btn, Card, Empty, ErrorText, Field, H, Loading, Screen, T } from "@/src/ui";
import { useMediaPicker } from "@/src/media";
import { useTheme } from "@/src/theme";

export default function Videos() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading, reload } = useFetch<any[]>(`/videos?client_id=${clientId}`);
  const client = useFetch<any>(`/clients/${clientId}`);
  const sub = client.data?.subscription;
  const limit = sub?.video_limit || 0;
  const period = sub?.billing === "annuale" ? new Date().toISOString().slice(0, 4) : new Date().toISOString().slice(0, 7);
  const used = (data || []).filter((v) => v.created_at.startsWith(period)).length;
  const picker = useMediaPicker();
  const [exercise, setExercise] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const upload = async () => {
    setErr("");
    if (!exercise.trim()) return setErr("Indica l'esercizio");
    const asset = await picker.pick("videos");
    if (!asset) return;
    setBusy(true);
    try {
      const path = await uploadFile(asset, "video.mp4");
      await api("/videos", { method: "POST", body: { client_id: clientId, path, exercise, note } });
      setExercise("");
      setNote("");
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Video tecnica" back>
      <Card accent>
        <H>Carica esecuzione</H>
        {limit ? <T testID="video-quota-text" style={{ color: used >= limit ? colors.warning : colors.silver, fontWeight: "800", fontSize: 13 }}>Video check usati: {used}/{limit} {sub.billing === "annuale" ? "quest'anno" : "questo mese"}</T> : null}
        <Field testID="video-exercise-input" label="Esercizio" placeholder="es. Squat 100kg x5" value={exercise} onChangeText={setExercise} />
        <Field testID="video-note-input" label="Nota per il coach" value={note} onChangeText={setNote} />
        <ErrorText text={err} />
        <Btn testID="video-upload-button" icon="cloud-upload" title={busy ? "Caricamento…" : "Scegli video"} loading={busy} onPress={upload} />
      </Card>
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? <Empty icon="videocam-outline" text="Nessun video caricato." /> : null}
      {data?.map((v) => (
        <Card key={v.id} testID={`video-card-${v.id}`} onPress={() => router.push(`/video/${v.id}`)} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Ionicons name="play-circle" size={36} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: "800" }}>{v.exercise}</T>
            <T muted style={{ fontSize: 13 }}>{fmtDate(v.created_at, true)}</T>
          </View>
          <T style={{ fontSize: 12, fontWeight: "800", color: v.reviewed ? colors.success : colors.warning }}>{v.reviewed ? "Corretto" : "In attesa"}</T>
        </Card>
      ))}
      {picker.element}
    </Screen>
  );
}
