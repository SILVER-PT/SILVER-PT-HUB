import React, { useRef, useState } from "react";
import { Linking, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Btn, Sheet, T } from "@/src/ui";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";

const UPLOAD_PRIVACY = "I file che carichi (foto check, posing, video, foto dei pasti, etichette, referti e analisi, foto profilo) viaggiano su connessione cifrata e sono conservati in un archivio privato, visibile solo a te e ai professionisti che hai scelto (art. 13 e 9 GDPR). Referti e analisi sono dati sanitari: carica solo documenti che ti riguardano. Foto di pasti, etichette e referti possono essere elaborate dall'intelligenza artificiale solo per estrarre i valori richiesti. Puoi eliminare i tuoi file quando vuoi e revocare il consenso dal Profilo → Privacy e documenti.";

type Kind = "images" | "videos";
type Opts = { base64?: boolean };

// Contextual camera permission flow + gallery picker. Returns pick() and a sheet to render.
export function useMediaPicker() {
  const [sheet, setSheet] = useState<null | "explain" | "settings" | "choose" | "privacy">(null);
  const { user, refresh } = useAuth();
  const pending = useRef<{ kind: Kind; opts: Opts; resolve: (a: ImagePicker.ImagePickerAsset | null) => void } | null>(null);

  const finish = (a: ImagePicker.ImagePickerAsset | null) => {
    setSheet(null);
    pending.current?.resolve(a);
    pending.current = null;
  };

  const launch = async (source: "camera" | "library") => {
    const p = pending.current!;
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: [p.kind], quality: 0.6, base64: !!p.opts.base64, videoMaxDuration: 120 };
    const res = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    finish(res.canceled ? null : res.assets[0]);
  };

  const camera = async () => {
    const perm = await ImagePicker.getCameraPermissionsAsync();
    if (perm.granted) return launch("camera");
    if (!perm.canAskAgain) return setSheet("settings");
    setSheet("explain");
  };

  const requestCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.granted) return launch("camera");
    setSheet(perm.canAskAgain ? "explain" : "settings");
  };

  const pick = (kind: Kind, opts: Opts = {}) =>
    new Promise<ImagePicker.ImagePickerAsset | null>((resolve) => {
      pending.current = { kind, opts, resolve };
      const ok = (user?.consents || []).some((c: any) => c.id === "upload_media");
      setSheet(ok ? "choose" : "privacy");
    });

  const acceptPrivacy = async () => {
    try {
      await api("/me/consents", { method: "POST", body: { id: "upload_media", accepted: true } });
      await refresh();
    } catch {}
    setSheet("choose");
  };

  const element = (
    <>
      <Sheet visible={sheet === "privacy"} onClose={() => finish(null)} title="Informativa caricamento file">
        <T testID="upload-privacy-text" style={{ fontSize: 13 }}>{UPLOAD_PRIVACY}</T>
        <Btn testID="upload-privacy-accept" icon="shield-checkmark" title="Ho letto e acconsento" onPress={acceptPrivacy} />
        <Btn variant="ghost" title="Annulla" onPress={() => finish(null)} />
      </Sheet>
      <Sheet visible={sheet === "choose"} onClose={() => finish(null)} title="Scegli sorgente">
        <Btn testID="picker-camera-button" icon="camera" title={pending.current?.kind === "videos" ? "Registra video" : "Scatta foto"} onPress={camera} />
        <Btn testID="picker-library-button" icon="images" variant="dark" title="Dalla galleria" onPress={() => launch("library")} />
      </Sheet>
      <Sheet visible={sheet === "explain"} onClose={() => finish(null)} title="Fotocamera">
        <T>Usiamo la fotocamera per scattare foto check, video degli esercizi e foto dei pasti da analizzare.</T>
        <View style={{ gap: 8 }}>
          <Btn testID="permission-continue-button" title="Consenti fotocamera" onPress={requestCamera} />
          <Btn testID="permission-library-button" variant="dark" title="Usa la galleria" onPress={() => launch("library")} />
        </View>
      </Sheet>
      <Sheet visible={sheet === "settings"} onClose={() => finish(null)} title="Permesso negato">
        <T>L&apos;accesso alla fotocamera è disattivato. Puoi attivarlo dalle impostazioni oppure usare la galleria.</T>
        <Btn testID="permission-open-settings-button" icon="settings" title="Apri impostazioni" onPress={() => Linking.openSettings()} />
        <Btn testID="permission-settings-library-button" variant="dark" title="Usa la galleria" onPress={() => launch("library")} />
      </Sheet>
    </>
  );
  return { pick, element };
}
