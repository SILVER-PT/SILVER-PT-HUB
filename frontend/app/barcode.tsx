import { useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, num } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Btn, Card, ErrorText, Field, Screen, Stat, T } from "@/src/ui";
import { useMediaPicker } from "@/src/media";

const PER: [string, string][] = [["kcal", "Kcal"], ["protein", "Proteine"], ["carbs", "Carboidrati"], ["sugars", "di cui zuccheri"], ["fat", "Grassi"], ["fiber", "Fibre"], ["salt", "Sale"], ["sodium", "Sodio"]];

export default function Barcode() {
  const { date, meal } = useLocalSearchParams<{ date: string; meal: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const hide = user?.role === "client" && !user.visibility?.nutrition;
  const [perm, requestPerm] = useCameraPermissions();
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [grams, setGrams] = useState("100");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [edited, setEdited] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const picker = useMediaPicker();

  const lookup = async (c: string) => {
    if (!c) return;
    setErr("");
    setBusy(true);
    try {
      const p = await api(`/food/barcode/${c}`);
      setProduct(p);
      setGrams(String(p.serving_g || 100));
    } catch (e: any) {
      setErr(e.message);
      lock.current = false;
    } finally {
      setBusy(false);
    }
  };

  const g = num(grams);
  const m = (k: string) => Math.round(((num(product?.per100?.[k]) || 0) * g) / 10) / 10;
  const setPer = (k: string) => (v: string) => { setEdited(true); setProduct((p: any) => ({ ...p, per100: { ...p.per100, [k]: v } })); };

  const readLabel = async () => {
    setErr("");
    const a = await picker.pick("images", { base64: true });
    if (!a?.base64) return;
    setBusy(true);
    try {
      const r = await api("/ai/nutrition-label", { method: "POST", body: { image_base64: a.base64 } });
      setEdited(true);
      setEditOpen(true);
      setProduct((p: any) => ({ name: p?.name || r.name || "Prodotto", brand: p?.brand || "", image: p?.image, barcode: p?.barcode || code, serving_g: p?.serving_g || 100, per100: Object.fromEntries(Object.entries(r.per100 || {}).map(([k, v]) => [k, String(v ?? 0)])) }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      if (edited) await api("/foods/custom", { method: "POST", body: { barcode: product.barcode || code, name: product.name, brand: product.brand || "", per100: product.per100 } });
      await api("/meals", { method: "POST", body: { date, meal_type: meal, name: `${product.name}${product.brand ? ` (${product.brand})` : ""}`, grams: g, kcal: m("kcal"), protein: m("protein"), carbs: m("carbs"), fat: m("fat"),
        sugars: m("sugars"), fiber: m("fiber"), salt: m("salt"), sodium: m("sodium"), source: "barcode" } });
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/feed");
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const canCamera = Platform.OS !== "web";

  return (
    <Screen title="Codice a barre" back>
      {!product && canCamera && perm?.granted ? (
        <View style={{ height: 280, borderRadius: 16, overflow: "hidden" }}>
          <CameraView
            testID="barcode-camera"
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
            onBarcodeScanned={({ data }) => {
              if (lock.current) return;
              lock.current = true;
              setCode(data);
              lookup(data);
            }}
          />
        </View>
      ) : null}
      {!product && canCamera && perm && !perm.granted ? (
        <Card accent>
          <T>Inquadra il codice a barre del prodotto per leggere calorie e macro in automatico.</T>
          {perm.canAskAgain ? (
            <Btn testID="barcode-permission-button" icon="camera" title="Consenti fotocamera" onPress={requestPerm} />
          ) : (
            <Btn testID="barcode-open-settings-button" icon="settings" title="Apri impostazioni" onPress={() => Linking.openSettings()} />
          )}
        </Card>
      ) : null}
      {!product ? (
        <>
          <Field testID="barcode-manual-input" label="Oppure inserisci il codice" keyboardType="number-pad" value={code} onChangeText={setCode} />
          <Btn testID="barcode-search-button" icon="search" variant="dark" title="Cerca prodotto" loading={busy} onPress={() => lookup(code)} />
          <Btn testID="barcode-label-button" icon="camera" variant="ghost" title="Prodotto non trovato? Fotografa la tabella nutrizionale" loading={busy} onPress={readLabel} />
        </>
      ) : (
        <Card accent testID="barcode-product-card">
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            {product.image ? <Image source={{ uri: product.image }} style={{ width: 64, height: 64, borderRadius: 8 }} contentFit="cover" /> : null}
            <View style={{ flex: 1 }}>
              <T testID="barcode-product-name" style={{ fontWeight: "900" }}>{product.name}</T>
              <T muted>{product.brand}{hide ? "" : ` · ${product.per100.kcal} kcal/100g`}</T>
            </View>
          </View>
          {!hide ? (
            <>
              <Field testID="barcode-grams-input" label="Quantità (g)" keyboardType="decimal-pad" value={grams} onChangeText={setGrams} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Stat label="Kcal" value={Math.round(m("kcal"))} />
                <Stat label="Prot" value={m("protein")} />
                <Stat label="Carb" value={m("carbs")} />
                <Stat label="Gras" value={m("fat")} />
              </View>
              <T muted style={{ fontSize: 12 }}>Zuccheri {m("sugars")}g · fibre {m("fiber")}g · sale {m("salt")}g · sodio {m("sodium")}g{product.custom ? " · valori salvati da te" : ""}</T>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Btn testID="barcode-edit-macros" small variant="dark" icon="create" title={editOpen ? "Chiudi modifica" : "Modifica valori"} style={{ flex: 1 }} onPress={() => setEditOpen(!editOpen)} />
                <Btn testID="barcode-photo-label" small variant="ghost" icon="camera" title="Foto tabella" style={{ flex: 1 }} onPress={readLabel} />
              </View>
              {editOpen ? (
                <View style={{ gap: 8 }} testID="barcode-per100-editor">
                  <Field testID="barcode-name-input" label="Nome" value={product.name} onChangeText={(v) => { setEdited(true); setProduct({ ...product, name: v }); }} />
                  <T muted style={{ fontSize: 12 }}>Valori per 100 g (verranno salvati nel tuo profilo per le prossime scansioni)</T>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {PER.map(([k, l]) => (
                      <View key={k} style={{ width: "47%", flexGrow: 1 }}>
                        <Field testID={`barcode-per100-${k}`} label={l} keyboardType="decimal-pad" value={String(product.per100?.[k] ?? "")} onChangeText={setPer(k)} />
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
          <Btn testID="barcode-save-button" title={`Aggiungi a ${meal}`} loading={busy} onPress={save} />
          <Btn testID="barcode-rescan-button" variant="ghost" title="Scansiona un altro" onPress={() => { setProduct(null); setCode(""); setEdited(false); setEditOpen(false); lock.current = false; }} />
        </Card>
      )}
      <ErrorText text={err} />
      {picker.element}
    </Screen>
  );
}
