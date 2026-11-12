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
        await AsyncStorage.setItem("userId", data.user.id);
        await AsyncStorage.setItem("userData", JSON.stringify(data.user));

        router.replace("/");
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
    backgroundColor: "#0a0a0a",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
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
  logo: {
    width: 100,
    height: 100,
    alignSelf: "center",
    marginBottom: 16,
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
  forgotContainer: {
    alignItems: "flex-end",
    marginBottom: 20,
  },
  forgotText: {
    color: "#ff4444",
    fontSize: 13,
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
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#e60000",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
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
    marginBottom: 16,
    fontSize: 14,
  },
});
