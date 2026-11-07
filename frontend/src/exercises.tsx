import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api, fileUrl, uploadFile } from "@/src/api";
import { Btn, ErrorText, Field, Sheet, T } from "@/src/ui";
import { useMediaPicker } from "@/src/media";
import { useTheme } from "@/src/theme";

export const imgUri = (p: string) => (p.startsWith("http") ? p : fileUrl(p));

// Start / end of movement images (or a GIF) side by side.
export function ExerciseImages({ images, size = 96 }: { images?: string[]; size?: number }) {
  const { colors } = useTheme();
  if (!images?.length) return null;
  return (
    <View style={{ flexDirection: "row", gap: 8 }} testID="exercise-images">
      {images.slice(0, 2).map((u, i) => (
        <View key={i} style={{ flex: 1, maxWidth: size * 1.6 }}>
          <Image source={{ uri: imgUri(u) }} style={{ width: "100%", aspectRatio: 1.3, borderRadius: 10, backgroundColor: colors.surfaceTertiary }} contentFit="cover" />
          {images.length > 1 ? <T muted style={{ fontSize: 10, textAlign: "center", marginTop: 2 }}>{i === 0 ? "INIZIO" : "FINE"}</T> : null}
        </View>
      ))}
    </View>
  );
}

export function ExercisePicker({ visible, onClose, initial, onPick }: { visible: boolean; onClose: () => void; initial: string; onPick: (x: { name?: string; images: string[] }) => void }) {
  const { colors } = useTheme();
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const picker = useMediaPicker();
  const search = async () => {
    setBusy(true);
    setErr("");
    try {
      setRes(await api(`/exercises/search?q=${encodeURIComponent(q)}`));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const upload = async () => {
    const paths: string[] = [];
    for (const label of ["inizio", "fine"]) {
      const a = await picker.pick("images");
      if (!a) break;
      setBusy(true);
      try {
        paths.push(await uploadFile(a, `${label}.${a.mimeType?.includes("gif") ? "gif" : "jpg"}`));
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setBusy(false);
      }
      if (a.mimeType?.includes("gif")) break;
    }
    if (paths.length) { onPick({ images: paths }); onClose(); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Immagini esercizio">
      <T muted style={{ fontSize: 12 }}>Cerca nell&apos;archivio gratuito (nomi in inglese, puoi scrivere in italiano) oppure carica le tue foto inizio/fine o una GIF.</T>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <Field testID="exercise-search-input" placeholder="es. panca piana manubri" value={q} onChangeText={setQ} onSubmitEditing={search} style={{ flex: 1 }} />
        <Btn testID="exercise-search-button" icon="search" title="" onPress={search} style={{ width: 56 }} />
      </View>
      <Btn testID="exercise-upload-button" small variant="dark" icon="cloud-upload" title="Carica foto mie (inizio + fine) o GIF" onPress={upload} />
      <ErrorText text={err} />
      {busy ? <ActivityIndicator color={colors.brandPrimary} /> : null}
      {res?.length === 0 ? <T muted>Nessun risultato. Prova con un termine diverso.</T> : null}
      <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
        {(res || []).map((e) => (
          <Pressable key={e.id} testID={`exercise-result-${e.id}`} onPress={() => { onPick({ name: e.name, images: e.images }); onClose(); }}
            style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            {e.images.map((u: string, i: number) => <Image key={i} source={{ uri: u }} style={{ width: 56, height: 44, borderRadius: 6 }} contentFit="cover" />)}
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: "800", fontSize: 14 }}>{e.name}</T>
              <T muted style={{ fontSize: 11 }}>{[...(e.muscles || []), e.equipment].filter(Boolean).join(" · ")}</T>
            </View>
            <Ionicons name="add-circle" size={24} color={colors.brandPrimary} />
          </Pressable>
        ))}
      </ScrollView>
      {picker.element}
    </Sheet>
  );
}
