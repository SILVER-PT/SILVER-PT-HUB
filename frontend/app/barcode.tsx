import { useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, num } from "@/src/api";
import { Btn, Card, ErrorText, Field, Screen, Stat, T } from "@/src/ui";

export default function Barcode() {
  const { date, meal } = useLocalSearchParams<{ date: string; meal: string }>();
  const router = useRouter();
  const [perm, requestPerm] = useCameraPermissions();
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [grams, setGrams] = useState("100");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

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
  const m = (k: string) => Math.round(((product?.per100?.[k] || 0) * g) / 10) / 10;

  const save = async () => {
    setBusy(true);
    try {
      await api("/meals", { method: "POST", body: { date, meal_type: meal, name: `${product.name}${product.brand ? ` (${product.brand})` : ""}`, grams: g, kcal: m("kcal"), protein: m("protein"), carbs: m("carbs"), fat: m("fat"), source: "barcode" } });
      router.back();
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
        </>
      ) : (
        <Card accent testID="barcode-product-card">
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            {product.image ? <Image source={{ uri: product.image }} style={{ width: 64, height: 64, borderRadius: 8 }} contentFit="cover" /> : null}
            <View style={{ flex: 1 }}>
              <T testID="barcode-product-name" style={{ fontWeight: "900" }}>{product.name}</T>
              <T muted>{product.brand} · {product.per100.kcal} kcal/100g</T>
            </View>
          </View>
          <Field testID="barcode-grams-input" label="Quantità (g)" keyboardType="decimal-pad" value={grams} onChangeText={setGrams} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Stat label="Kcal" value={Math.round(m("kcal"))} />
            <Stat label="Prot" value={m("protein")} />
            <Stat label="Carb" value={m("carbs")} />
            <Stat label="Gras" value={m("fat")} />
          </View>
          <Btn testID="barcode-save-button" title={`Aggiungi a ${meal}`} loading={busy} onPress={save} />
          <Btn testID="barcode-rescan-button" variant="ghost" title="Scansiona un altro" onPress={() => { setProduct(null); setCode(""); lock.current = false; }} />
        </Card>
      )}
      <ErrorText text={err} />
    </Screen>
  );
}
