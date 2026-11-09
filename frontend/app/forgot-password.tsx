import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { api } from "@/src/api";
import { Btn, ErrorText, Field, Laser, T } from "@/src/ui";
import { HUB } from "@/src/flip-logo";
import { useTheme } from "@/src/theme";

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const coin = Math.min(height / 3, width - 48);

  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    if (!email.trim()) return setErr("Inserisci un'email valida");
    setBusy(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email } });
      setSuccess(true);
    } catch (e: any) {
      setErr(e.message || "Errore durante la richiesta di recupero");
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
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          gap: 16,
          maxWidth: 560,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <Image testID="forgot-logo" source={HUB} style={{ width: coin, height: coin, alignSelf: "center" }} contentFit="contain" />
        <Laser style={{ marginVertical: 8 }} />
        <T style={{ fontSize: 26, fontWeight: "900", fontStyle: "italic", textTransform: "uppercase" }}>
          Recupero Password
        </T>
        <T muted>
          Inserisci l'indirizzo email associato al tuo account. Ti invieremo le istruzioni per reimpostare la password.
        </T>

        {success ? (
          <View style={{ gap: 16, marginTop: 12 }}>
            <T style={{ fontWeight: "700", color: colors.brandPrimary }}>
              Richiesta inviata con successo! Controlla la tua casella di posta elettronica.
            </T>
            <Btn
              testID="back-to-login-button"
              title="Torna al login"
              onPress={() => router.back()}
            />
          </View>
        ) : (
          <>
            <Field
              testID="forgot-email-input"
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <ErrorText text={err} />
            <Btn
              testID="forgot-submit-button"
              title="Invia istruzioni"
              onPress={submit}
              loading={busy}
            />
            <Btn
              testID="back-to-login-ghost"
              variant="ghost"
              title="Torna indietro al login"
              onPress={() => router.back()}
            />
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}
