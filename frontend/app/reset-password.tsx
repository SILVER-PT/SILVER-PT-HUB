import React, { useState } from "react";
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Text, Input, Button, useTheme } from "@/components";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const theme = useTheme();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      setError("Compila tutti i campi");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le password non coincidono");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Chiamata diretta al backend su Render
      const response = await fetch("https://silver-pt-hub.onrender.com/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          new_password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Errore durante il reset della password");
      }

      setSuccess(true);
    } catch (e: any) {
      setError(e.message || "Errore di connessione al server");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text variant="body" style={{ color: "#ff4444", textAlign: "center" }}>
          Token di reset mancante o non valido.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Text variant="header" style={styles.title}>
            NUOVA PASSWORD
          </Text>
          <Text variant="body" style={styles.subtitle}>
            Inserisci la tua nuova password per completare il recupero dell'account.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {success ? (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>
                Password aggiornata con successo! Ora puoi effettuare il login con la nuova password.
              </Text>
              <Button
                title="Torna al Login"
                onPress={() => router.replace("/login")}
                style={{ marginTop: 20 }}
              />
            </View>
          ) : (
            <>
              <Input
                label="NUOVA PASSWORD"
                placeholder="********"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <Input
                label="CONFERMA PASSWORD"
                placeholder="********"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                style={{ marginTop: 15 }}
              />

              <Button
                title="Aggiorna Password"
                onPress={handleReset}
                loading={loading}
                style={{ marginTop: 25 }}
              />

              <Button
                title="Torna al Login"
                variant="ghost"
                onPress={() => router.replace("/login")}
                style={{ marginTop: 10 }}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    padding: 24,
    borderRadius: 12,
  },
  title: {
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 20,
    opacity: 0.8,
  },
  errorText: {
    color: "#ff4444",
    textAlign: "center",
    marginBottom: 15,
  },
  successContainer: {
    alignItems: "center",
  },
  successText: {
    color: "#00C851",
    textAlign: "center",
    marginBottom: 15,
    fontSize: 16,
  },
});
