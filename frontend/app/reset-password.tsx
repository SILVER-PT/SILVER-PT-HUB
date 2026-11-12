import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

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
      <View style={styles.container}>
        <Text style={styles.errorText}>Token di reset mancante o non valido.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.wrapper}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Text style={styles.title}>REIMPOSTA PASSWORD</Text>
          <Text style={styles.subtitle}>
            Inserisci la tua nuova password per completare il recupero dell'account.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {success ? (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>
                Password aggiornata con successo! Ora puoi effettuare il login con la nuova password.
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.replace("/login")}
              >
                <Text style={styles.buttonText}>TORNA AL LOGIN</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>NUOVA PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  placeholder="********"
                  placeholderTextColor="#666"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>CONFERMA PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  placeholder="********"
                  placeholderTextColor="#666"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleReset}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>AGGIORNA PASSWORD</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.ghostButton}
                onPress={() => router.replace("/login")}
              >
                <Text style={styles.ghostButtonText}>TORNA INDIETRO AL LOGIN</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    padding: 24,
    backgroundColor: "#161616",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ccc",
    marginBottom: 6,
    letterSpacing: 1,
  },
  input: {
    width: "100%",
    height: 48,
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    paddingHorizontal: 16,
    color: "#fff",
    fontSize: 16,
  },
  button: {
    width: "100%",
    height: 48,
    backgroundColor: "#e60000",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  ghostButton: {
    width: "100%",
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  ghostButtonText: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: {
    color: "#ff4444",
    textAlign: "center",
    marginBottom: 16,
    fontSize: 14,
  },
  successContainer: {
    alignItems: "center",
  },
  successText: {
    color: "#00C851",
    textAlign: "center",
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
  },
});
