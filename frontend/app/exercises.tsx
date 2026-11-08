import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { api, fileUrl, uploadFile, useFetch } from "@/src/api";
import { Btn, Card, Chip, ErrorText, Field, H, Loading, Screen, Sheet, SilverIcon, T } from "@/src/ui";
import { useMediaPicker } from "@/src/media";
import { useAuth } from "@/src/auth";
import { useTheme } from "@/src/theme";

const IT_MUSCLE: Record<string, string> = { chest: "Pettorali", lats: "Gran dorsale", "middle back": "Dorso medio", "lower back": "Lombari", traps: "Trapezio", shoulders: "Deltoidi", biceps: "Bicipiti", forearms: "Avambracci", triceps: "Tricipiti", quadriceps: "Quadricipiti", hamstrings: "Femorali", glutes: "Glutei", abductors: "Abduttori", adductors: "Adduttori", calves: "Polpacci", abdominals: "Addominali", neck: "Collo" };

// Library images are start/end frames: alternate them to animate the movement like a GIF.
function Animated2({ images }: { images: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setI((x) => 1 - x), 900);
    return () => clearInterval(t);
  }, [images]);
  return <Image source={{ uri: images[i] }} style={{ width: 96, height: 76, borderRadius: 10 }} contentFit="cover" />;
}

function MyVideo({ path }: { path: string }) {
  const player = useVideoPlayer(fileUrl(path), (p) => { p.loop = true; });
  return <VideoView player={player} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 12 }} nativeControls />;
}

export default function Exercises() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [district, setDistrict] = useState<string | null>(null);
  const [muscle, setMuscle] = useState<string | null>(null);
  const qs = district ? `?district=${encodeURIComponent(district)}${muscle ? `&muscle=${encodeURIComponent(muscle)}` : ""}` : "";
  const { data, loading, reload } = useFetch<any>(`/exercises/library${qs}`);
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ name: "", notes: "", video_path: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const picker = useMediaPicker();
  const staff = user?.role !== "client";

  const upload = async () => {
    const a = await picker.pick("videos");
    if (!a) return;
    setBusy(true);
    try {
      setF({ ...f, video_path: await uploadFile(a, "esecuzione.mp4") });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setErr("");
    try {
      await api("/exercises/mine", { method: "POST", body: { ...f, district: district || "Altro", muscle: muscle || "" } });
      setAdd(false);
      setF({ name: "", notes: "", video_path: "" });
      reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const tree = data?.tree || {};
  return (
    <Screen title={district ? district : "Libreria esercizi"} back>
      {!district ? (
        <>
          <T muted style={{ fontSize: 12 }}>Scegli un distretto. Le animazioni vengono dall&apos;archivio gratuito; puoi aggiungere i tuoi video di esecuzione.</T>
          {loading && !data ? <Loading /> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {Object.keys(tree).sort().map((d) => (
              <Pressable key={d} testID={`district-${d}`} onPress={() => setDistrict(d)} style={{ width: "47%", flexGrow: 1, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.silver, backgroundColor: colors.surfaceSecondary, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <SilverIcon name="body" box={34} size={18} />
                <View><T style={{ fontWeight: "900" }}>{d}</T><T muted style={{ fontSize: 11 }}>{Object.values(tree[d] as Record<string, number>).reduce((a, b) => a + b, 0)} esercizi</T></View>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip testID="district-back" label="← Distretti" onPress={() => { setDistrict(null); setMuscle(null); }} />
            {Object.keys(tree[district] || {}).map((m) => <Chip key={m} testID={`muscle-${m}`} label={IT_MUSCLE[m] || m} active={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />)}
          </View>
          {staff ? <Btn testID="add-my-exercise" small icon="videocam" title="Aggiungi il tuo video esecuzione" onPress={() => setAdd(true)} /> : null}
          {data?.mine?.length ? <H>I tuoi esercizi</H> : null}
          {data?.mine?.map((e: any) => (
            <Card key={e.id} testID={`my-ex-${e.id}`}>
              <T style={{ fontWeight: "900" }}>{e.name}</T>
              {e.video_path ? <MyVideo path={e.video_path} /> : null}
              {e.notes ? <T muted style={{ fontSize: 13 }}>{e.notes}</T> : null}
              {staff ? <Btn small variant="ghost" icon="trash" title="Elimina" onPress={async () => { await api(`/exercises/mine/${e.id}`, { method: "DELETE" }); reload(); }} /> : null}
            </Card>
          ))}
          <H>{`Libreria (${data?.items?.length ?? 0})`}</H>
          {loading ? <Loading /> : null}
          {data?.items?.map((e: any) => (
            <Card key={e.id} testID={`lib-ex-${e.id}`} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              {e.images?.length ? <Animated2 images={e.images} /> : null}
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: "800" }}>{e.name}</T>
                <T muted style={{ fontSize: 11 }}>{(e.muscles || []).map((m: string) => IT_MUSCLE[m] || m).join(", ")}{e.equipment ? ` · ${e.equipment}` : ""}</T>
              </View>
            </Card>
          ))}
          <T muted style={{ fontSize: 10 }}>Immagini: free-exercise-db (pubblico dominio)</T>
        </>
      )}
      <Sheet visible={add} onClose={() => setAdd(false)} title="Nuovo esercizio">
        <Field testID="my-ex-name" label="Nome" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
        <Field label="Note tecniche" multiline value={f.notes} onChangeText={(v) => setF({ ...f, notes: v })} />
        <Btn testID="my-ex-video" variant="dark" icon="cloud-upload" title={f.video_path ? "Video caricato ✓" : "Carica video esecuzione"} loading={busy} onPress={upload} />
        <ErrorText text={err} />
        <Btn testID="my-ex-save" icon="save" title="Salva" onPress={save} />
      </Sheet>
      {picker.element}
    </Screen>
  );
}
