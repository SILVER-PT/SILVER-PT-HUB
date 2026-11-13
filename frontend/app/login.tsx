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
  ActivityIndicator,
  Image
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Compila tutti i campi");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch("https://silver-pt-hub.onrender.com/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Credenziali non valide");
      }

      if (data.user && data.user.id) {
        await AsyncStorage.setItem("token", data.token || "");
        await AsyncStorage.setItem("userId", String(data.user.id));
        await AsyncStorage.setItem("userData", JSON.stringify(data.user));

        // Reindirizzamento forzato al gruppo principale dell'app per sbloccare la navigazione
        router.replace("/(tabs)");
      } else {
        throw new Error("Dati utente incompleti nella risposta del server");
      }

    } catch (e: any) {
      setError(e.message || "Errore di connessione al server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.wrapper}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Image
            source={require("../assets/images/logo-hub.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>BENTORNATO</Text>
          <Text style={styles.subtitle}>
            Accedi per allenamenti, misure e alimentazione.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="********"
              placeholderTextColor="#666"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            onPress={() => router.push("/forgot-password")}
            style={styles.forgotContainer}
          >
            <Text style={styles.forgotText}>Password dimenticata?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>ACCEDI</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostButton}
            onPress={() => router.push("/register")}
          >
            <Text style={styles.ghostButtonText}>NON HAI UN ACCOUNT? REGISTRATI</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#000000",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: 28,
    backgroundColor: "#000000",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#222",
  },
  logo: {
    width: 160,
    height: 160,
    alignSelf: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    textTransform: "uppercase",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginBottom: 28,
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#aaa",
    marginBottom: 6,
    letterSpacing: 1,
  },
  input: {
    width: "100%",
    height: 50,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    paddingHorizontal: 16,
    color: "#fff",
    fontSize: 16,
  },
  forgotContainer: {
    alignItems: "flex-end",
    marginBottom: 24,
  },
  forgotText: {
    color: "#ff3333",
    fontSize: 13,
    fontWeight: "600",
  },
  button: {
    width: "100%",
    height: 50,
    backgroundColor: "#e60000",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 1.2,
  },
  ghostButton: {
    width: "100%",
    height: 50,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#e60000",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  ghostButtonText: {
    color: "#e60000",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  errorText: {
    color: "#ff4444",
    textAlign: "center",
    marginBottom: 18,
    fontSize: 14,
    fontWeight: "600",
  },
});
