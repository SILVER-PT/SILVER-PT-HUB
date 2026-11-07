import { useEffect, useState } from "react";
import { Image as RNImage, View } from "react-native";
import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Btn, Chip, Sheet, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

const FRAME = 240;

// Choose which part of the photo stays visible: zoom + move, then crops to a square.
export function AvatarCrop({ uri, onCancel, onDone }: { uri: string | null; onCancel: () => void; onDone: (a: { uri: string; mimeType: string; fileName: string }) => void }) {
  const { colors } = useTheme();
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setZoom(1);
    setPos({ x: 0.5, y: 0.5 });
    setDim(null);
    if (uri) RNImage.getSize(uri, (w, h) => setDim({ w, h }), () => setDim({ w: 1000, h: 1000 }));
  }, [uri]);
  if (!uri) return null;
  const side = dim ? Math.min(dim.w, dim.h) / zoom : 0;
  const ox = dim ? (dim.w - side) * pos.x : 0;
  const oy = dim ? (dim.h - side) * pos.y : 0;
  const scale = dim ? FRAME / side : 1;
  const move = (dx: number, dy: number) => setPos((p) => ({ x: Math.min(1, Math.max(0, p.x + dx)), y: Math.min(1, Math.max(0, p.y + dy)) }));
  const done = async () => {
    if (!dim) return;
    setBusy(true);
    try {
      const ctx = ImageManipulator.manipulate(uri).crop({ originX: Math.round(ox), originY: Math.round(oy), width: Math.round(side), height: Math.round(side) }).resize({ width: 600 });
      const img = await ctx.renderAsync();
      const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      onDone({ uri: out.uri, mimeType: "image/jpeg", fileName: "avatar.jpg" });
    } catch {
      onDone({ uri, mimeType: "image/jpeg", fileName: "avatar.jpg" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={!!uri} onClose={onCancel} title="Ritaglia foto profilo">
      <T muted style={{ fontSize: 13 }}>Scegli la parte visibile: ingrandisci e sposta la foto nel cerchio.</T>
      <View style={{ alignSelf: "center", width: FRAME, height: FRAME, borderRadius: FRAME / 2, overflow: "hidden", borderWidth: 2, borderColor: colors.brandPrimary, backgroundColor: colors.surfaceTertiary }} testID="avatar-crop-frame">
        {dim ? <Image source={{ uri }} style={{ position: "absolute", width: dim.w * scale, height: dim.h * scale, left: -ox * scale, top: -oy * scale }} contentFit="fill" /> : null}
      </View>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <Chip testID="crop-zoom-out" label="－ Zoom" onPress={() => setZoom(Math.max(1, zoom - 0.25))} />
        <Chip testID="crop-zoom-in" label="＋ Zoom" onPress={() => setZoom(Math.min(4, zoom + 0.25))} />
      </View>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <Chip testID="crop-left" label="◀" onPress={() => move(-0.1, 0)} />
        <Chip testID="crop-up" label="▲" onPress={() => move(0, -0.1)} />
        <Chip testID="crop-down" label="▼" onPress={() => move(0, 0.1)} />
        <Chip testID="crop-right" label="▶" onPress={() => move(0.1, 0)} />
      </View>
      <Btn testID="crop-confirm-button" icon="checkmark" title="Usa questa foto" loading={busy} onPress={done} />
    </Sheet>
  );
}
