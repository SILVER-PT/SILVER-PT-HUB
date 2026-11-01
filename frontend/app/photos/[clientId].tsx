import { useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api, fileUrl, fmtDate, today, uploadFile, useFetch } from "@/src/api";
import { Btn, Card, Chip, ChipRow, Empty, ErrorText, Field, H, Loading, Screen, Sheet, T } from "@/src/ui";
import { useMediaPicker } from "@/src/media";
import { makeStyles, useTheme } from "@/src/theme";

const KINDS = [["front", "Frontale"], ["side_left", "Laterale sx"], ["back", "Posteriore"]];

export default function Photos() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const s = useStyles();
  const { colors } = useTheme();
  const { data, loading, reload, error } = useFetch<any[]>(`/photos?client_id=${clientId}`);
  const client = useFetch<any>(`/clients/${clientId}`);
  const picker = useMediaPicker();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [poseName, setPoseName] = useState("");
  const [cmp, setCmp] = useState<{ a?: string; b?: string } | null>(null);

  const add = async (kind: string) => {
    setErr("");
    const asset = await picker.pick("images");
    if (!asset) return;
    setBusy(kind);
    try {
      const path = await uploadFile(asset, `${kind}.jpg`);
      await api("/photos", { method: "POST", body: { client_id: clientId, kind, path, date: today(), pose_name: kind === "posing" ? poseName : "" } });
      setPoseName("");
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };

  const check = (data || []).filter((p) => p.kind !== "posing");
  const posing = (data || []).filter((p) => p.kind === "posing");
  const dates = [...new Set(check.map((p) => p.date))];

  const thumb = (p: any) => (
    <Pressable key={p.id} testID={`photo-${p.id}`} onPress={() => setPreview(p)} style={s.thumbWrap}>
      <Image source={{ uri: fileUrl(p.path) }} style={s.thumb} contentFit="cover" transition={200} />
      <T style={s.thumbLabel}>{p.kind === "posing" ? p.pose_name || "Posing" : KINDS.find((k) => k[0] === p.kind)?.[1]}</T>
    </Pressable>
  );

  return (
    <Screen title="Foto check" back>
      <H>Nuovo check</H>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {KINDS.map(([k, l]) => (
          <Pressable key={k} testID={`add-photo-${k}`} onPress={() => add(k)} style={s.slot}>
            {busy === k ? <Loading /> : <Ionicons name="camera" size={26} color={colors.brandPrimary} />}
            <T style={{ fontSize: 12, fontWeight: "800", textAlign: "center" }}>{l}</T>
          </Pressable>
        ))}
      </View>
      <ErrorText text={err} />
      {loading && !data && !error ? <Loading /> : null}
      {error ? <Card testID="photos-hidden-card"><T muted>Foto caricate. Sono visibili solo al tuo coach.</T></Card> : null}
      {data && check.length === 0 ? <Empty icon="images-outline" text="Carica le 3 foto: frontale, laterale sinistra e posteriore." /> : null}
      {dates.length >= 2 ? (
        <Btn testID="compare-toggle-button" variant="ghost" icon="git-compare" title={cmp ? "Chiudi confronto" : "Confronta due date"} onPress={() => setCmp(cmp ? null : { a: dates[dates.length - 1], b: dates[0] })} />
      ) : null}
      {cmp ? (
        <Card accent testID="compare-card">
          <T muted>Prima</T>
          <ChipRow>{dates.map((d) => <Chip key={d} testID={`compare-a-${d}`} label={fmtDate(d)} active={cmp.a === d} onPress={() => setCmp({ ...cmp, a: d })} />)}</ChipRow>
          <T muted>Dopo</T>
          <ChipRow>{dates.map((d) => <Chip key={d} testID={`compare-b-${d}`} label={fmtDate(d)} active={cmp.b === d} onPress={() => setCmp({ ...cmp, b: d })} />)}</ChipRow>
          {KINDS.map(([k, l]) => {
            const pa = check.find((p) => p.date === cmp.a && p.kind === k);
            const pb = check.find((p) => p.date === cmp.b && p.kind === k);
            return (
              <View key={k} style={{ gap: 4 }}>
                <T style={{ fontWeight: "800", fontSize: 13 }}>{l}</T>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[pa, pb].map((p, i) => (
                    <View key={i} style={{ flex: 1 }}>
                      {p ? <Image source={{ uri: fileUrl(p.path) }} style={s.cmpImg} contentFit="cover" /> : <View style={[s.cmpImg, { alignItems: "center", justifyContent: "center" }]}><T muted style={{ fontSize: 12 }}>—</T></View>}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}
      {dates.map((d) => (
        <Card key={d}>
          <T style={{ fontWeight: "900" }}>{fmtDate(d)}</T>
          <View style={{ flexDirection: "row", gap: 8 }}>{check.filter((p) => p.date === d).map(thumb)}</View>
        </Card>
      ))}

      <H>Posing bodybuilding</H>
      {client.data?.profile?.competitor ? (
        <>
          <Field testID="pose-name-input" placeholder="Posa (es. Doppio bicipite frontale)" value={poseName} onChangeText={setPoseName} />
          <Btn testID="add-photo-posing" icon="trophy" variant="ghost" title="Carica foto posing" loading={busy === "posing"} onPress={() => add("posing")} />
        </>
      ) : <T muted>Sezione per chi gareggia: attiva &quot;Gareggio nel bodybuilding&quot; nel profilo.</T>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{posing.map(thumb)}</View>

      {picker.element}
      <Sheet visible={!!preview} onClose={() => setPreview(null)} title={preview ? fmtDate(preview.date) : ""}>
        {preview ? <Image testID="photo-preview" source={{ uri: fileUrl(preview.path) }} style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: 12 }} contentFit="contain" /> : null}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  slot: { flex: 1, height: 96, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: c.brandPrimary, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", gap: 6, padding: 6 },
  thumbWrap: { width: "31%", gap: 4 },
  thumb: { width: "100%", aspectRatio: 3 / 4, borderRadius: 10, backgroundColor: c.surfaceTertiary },
  thumbLabel: { fontSize: 11, color: c.muted, textAlign: "center" },
  cmpImg: { width: "100%", aspectRatio: 3 / 4, borderRadius: 10, backgroundColor: c.surfaceTertiary },
}));
