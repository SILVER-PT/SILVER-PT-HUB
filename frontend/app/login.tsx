import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useAuth } from "@/src/auth";
import { Btn, Chip, ErrorText, Field, Laser, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<"client" | "trainer" | "nutritionist">("client");
  const [f, setF] = useState({ name: "", email: "", password: "", invite_code: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") await signIn("/auth/login", { email: f.email, password: f.password });
      else await signIn("/auth/register", { ...f, role });
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
  <KeyboardAwareScrollView 
    bottomOffset={24} 
    keyboardShouldPersistTaps="handled" 
    contentContainerStyle={{ 
      padding: 24, 
      paddingTop: insets.top + 40, 
      paddingBottom: insets.bottom + 24, 
      gap: 16 
    }}
  >
    <View style={{ width: "100%", alignItems: "center" }}>
      <Image 
        testID="login-logo" 
        source={require("../assets/images/logo-wide-v2.png")} 
        style={{ width: "100%", aspectRatio: 1100 / 275 }} 
        contentFit="contain" 
      />
    </View>
    <Laser style={{ marginVertical: 8 }} />
        <T style={{ fontSize: 26, fontWeight: "900", fontStyle: "italic", textTransform: "uppercase" }}>
          {mode === "login" ? "Bentornato" : "Crea il tuo profilo"}
        </T>
        <T muted>{mode === "login" ? "Accedi per vivere a lungo in un corpo sano" : "I clienti usano il codice invito del proprio coach."}</T>

        {mode === "register" && (
          <>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Chip testID="role-client-chip" label="Sono un cliente" active={role === "client"} onPress={() => setRole("client")} />
              <Chip testID="role-trainer-chip" label="Sono il coach" active={role === "trainer"} onPress={() => setRole("trainer")} />
              <Chip testID="role-nutritionist-chip" label="Nutrizionista / Dietista" active={role === "nutritionist"} onPress={() => setRole("nutritionist")} />
            </View>
            <Field testID="register-name-input" label="Nome e cognome" value={f.name} onChangeText={set("name")} />
            {role !== "trainer" && (
              <Field testID="register-invite-input" label="Codice invito coach" autoCapitalize="characters" value={f.invite_code} onChangeText={set("invite_code")} />
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
    </View>
  );
}
