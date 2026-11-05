// frontend/app/login.tsx
import React, { useState } from 'react';
import { View, TextInput, StyleSheet, ActivityIndicator, Alert, Text, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Errore', 'Inserisci email e password.');
      return;
    }
    setLoading(true);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok) {
        // Reindirizza alla home dopo il login riuscito
        router.replace('/');
      } else {
        Alert.alert('Errore', data.detail || 'Credenziali non valide.');
      }
    } catch (err) {
      Alert.alert('Errore di connessione', 'Verifica la connessione al server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require('../assets/images/logo-wide-v2.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.title}>ACCEDI A SILVER-PT</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#666"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#666"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {loading ? (
        <ActivityIndicator color="#ff0000" style={{ marginVertical: 12 }} />
      ) : (
        <Pressable style={styles.primaryButton} onPress={handleLogin}>
          <Text style={styles.primaryButtonText}>ACCEDI</Text>
        </Pressable>
      )}

      {/* Pulsante / Link per Password Dimenticata */}
      <Pressable style={styles.forgotButton} onPress={() => router.push('/forgot-password')}>
        <Text style={styles.forgotButtonText}>Password dimenticata?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 24, justifyContent: 'center', gap: 16 },
  logoContainer: { width: '100%', alignItems: 'center', marginBottom: 10 },
  logo: { width: '75%', height: 70 },
  title: { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 10 },
  input: { backgroundColor: '#181818', color: '#fff', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  primaryButton: { backgroundColor: '#ff0000', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  forgotButton: { alignItems: 'center', marginTop: 12 },
  forgotButtonText: { color: '#aaa', fontSize: 14, textDecorationLine: 'underline' },
});
