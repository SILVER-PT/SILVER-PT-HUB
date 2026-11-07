import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, uploadFile } from "@/src/api";
import { Btn, Chip, ErrorText, Field, Laser, T } from "@/src/ui";
import { useMediaPicker } from "@/src/media";
import { AvatarCrop } from "@/src/avatar-crop";
import { COIN } from "@/src/flip-logo";
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
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const pickAvatar = async () => {
    const a = await picker.pick("images");
    if (a) setRaw(a.uri);
  };

  const submit = async () => {
    setErr("");
    if (mode === "register" && !avatar) return setErr("La foto profilo è obbligatoria");
    setBusy(true);
    try {
      if (mode === "login") await signIn("/auth/login", { email: f.email, password: f.password });
      else {
        await signIn("/auth/register", { ...f, role });
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
        <Image testID="login-logo" source={COIN} style={{ width: coin, height: coin, alignSelf: "center" }} contentFit="contain" />
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
              <Chip testID="role-nutritionist-chip" label="Nutrizionista / Dietista" active={role === "nutritionist"} onPress={() => setRole("nutritionist")} />
            </View>
            <Pressable testID="register-avatar-button" onPress={pickAvatar} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: avatar ? colors.brandPrimary : colors.border, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary }}>
                {avatar ? <Image source={{ uri: avatar.uri }} style={{ width: 72, height: 72 }} /> : <Ionicons name="camera" size={28} color={colors.brandPrimary} />}
              </View>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: "800" }}>Foto profilo *</T>
                <T muted style={{ fontSize: 12 }}>{avatar ? "Tocca per cambiarla" : "Obbligatoria: sarà visibile nella tua scheda personale"}</T>
              </View>
            </Pressable>
            <Field testID="register-name-input" label="Nome e cognome" value={f.name} onChangeText={set("name")} />
            {role !== "trainer" && (
              <Field testID="register-invite-input" label={role === "client" ? "Codice invito coach / nutrizionista" : "Codice invito coach (facoltativo)"} autoCapitalize="characters" value={f.invite_code} onChangeText={set("invite_code")} />
            )}
          </>
        )}
        <Field testID="login-email-input" label="Email" autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={set("email")} />
        <Field testID="login-password-input" label="Password" secureTextEntry value={f.password} onChangeText={set("password")} />
        <ErrorText text={err} />
        <Btn testID="login-submit-button" title={mode === "login" ? "Accedi" : "Registrati"} onPress={submit} loading={busy} />
        <Btn
          testID="login-toggle-mode-button"
          variant="ghost"
          title={mode === "login" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
          onPress={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}
        />
      </KeyboardAwareScrollView>
      {picker.element}
      <AvatarCrop uri={raw} onCancel={() => setRaw(null)} onDone={(a) => { setAvatar(a); setRaw(null); }} />
    </View>
  );
}
