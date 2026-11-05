// frontend/app/forgot-password.tsx
import React, { useState } from 'react';
import { View, TextInput, StyleSheet, ActivityIndicator, Alert, Text } from 'react-native';
import { Button } from '@/components/Button';
import { useRouter } from 'expo-router';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Errore', 'Inserisci il tuo indirizzo email.');
      return;
    }
    setLoading(true);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Email inviata', 'Abbiamo inviato una password temporanea al tuo indirizzo email.');
        router.push('/login');
      } else {
        Alert.alert('Errore', data.detail || `Impossibile inviare l'email di reset.`);
      }
    } catch (err) {
      Alert.alert('Errore di connessione', 'Verifica la connessione al server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RECUPERA PASSWORD</Text>
      <Text style={styles.subtitle}>Inserisci l'email associata al tuo account per ricevere una password temporanea.</Text>

      <TextInput
        style={styles.input}
        placeholder="La tua email"
        placeholderTextColor="#666"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {loading ? (
        <ActivityIndicator color="#ff0000" style={{ marginVertical: 12 }} />
      ) : (
        <Button title="INVIA PASSWORD TEMPORANEA" onPress={handleResetPassword} />
      )}

      <Button title="Torna al Login" onPress={() => router.back()} style={styles.secondaryBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 24, justifyContent: 'center', gap: 16 },
  title: { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#aaa', textAlign: 'center' },
  input: { backgroundColor: '#181818', color: '#fff', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  secondaryBtn: { backgroundColor: 'transparent', marginTop: 8 },
});
