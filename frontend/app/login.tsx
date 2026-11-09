import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, uploadFile, useFetch } from "@/src/api";
import { Btn, Chip, ErrorText, Field, Laser, Sheet, T } from "@/src/ui";
import { useMediaPicker } from "@/src/media";
import { AvatarCrop } from "@/src/avatar-crop";
import { HUB } from "@/src/flip-logo";
import { setPassphrase } from "@/src/e2e";
import { useTheme } from "@/src/theme";

export default function Login() {
  const { signIn, refresh } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const coin = Math.min(height / 3, width - 48);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<"client" | "trainer" | "nutritionist">("client");
  const [f, setF] = useState({ name: "", email: "", password: "", invite_code: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<{ uri: string; mimeType: string; fileName: string } | null>(null);
  const picker = useMediaPicker();
  const allDocs = useFetch<any[]>(mode === "register" ? "/legal/docs" : null);
  const docs = (allDocs.data || []).filter((d) => d.roles.includes(role) && d.id !== "upload_media");
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [doc, setDoc] = useState<any>(null);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const pickAvatar = async () => {
    const a = await picker.pick("images");
    if (a) setRaw(a.uri);
  };

  const submit = async () => {
    setErr("");
    if (mode === "register" && !avatar) return setErr("La foto profilo è obbligatoria");
    const missing = docs.filter((d) => d.required && !accepted[d.id]);
    if (mode === "register" && missing.length) return setErr(`Devi accettare: ${missing.map((d) => d.title).join(", ")}`);
    setBusy(true);
    setPassphrase(f.email, f.password);
    try {
      if (mode === "login") await signIn("/auth/login", { email: f.email, password: f.password });
      else {
        await signIn("/auth/register", { ...f, role, consents: [...docs.filter((d) => accepted[d.id]).map((d) => d.id), "upload_media"] });
        const path = await uploadFile(avatar!, "avatar.jpg");
        await api("/me", { method: "PUT", body: { avatar: path } });
        await refresh();
      }
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 16, maxWidth: 560, width: "100%", alignSelf: "center" }}>
        <Image testID="login-logo" source={HUB} style={{ width: coin, height: coin, alignSelf: "center" }} contentFit="contain" />
        <Laser style={{ marginVertical: 8 }} />
        <T style={{ fontSize: 26, fontWeight: "900", fontStyle: "italic", textTransform: "uppercase" }}>
          {mode === "login" ? "Bentornato" : "Crea il tuo profilo"}
        </T>
        <T muted>{mode === "login" ? "Accedi per allenamenti, misure e alimentazione." : "I clienti usano il codice invito del proprio coach o nutrizionista."}</T>

        {mode === "register" && (
          <>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Chip testID="role-client-chip" label="Sono un cliente" active={role === "client"} onPress={() => setRole("client")} />
              <Chip testID="role-trainer-chip" label="Sono il coach" active={role === "trainer"} onPress={() => setRole("trainer")} />
              <Chip test
