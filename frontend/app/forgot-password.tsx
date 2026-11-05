// frontend/app/forgot-password.tsx
import React, { useState } from 'react';
import { View, TextInput, StyleSheet, ActivityIndicator, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';


export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');


  const handleResetPassword = async () => {
    if (!email.trim()) {
      setMessage('Inserisci il tuo indirizzo email.');
      setStatus('error');
      return;
    }

    setStatus('idle');
    setMessage('');
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
        setStatus('success');
        setMessage('✅ Password temporanea inviata. Controlla la tua casella email.');
        setTimeout(() => router.push('/login'), 2500);
      } else {
        setStatus('error');
        setMessage('❌ ' + (data.detail || 'Impossibile inviare l\'email di reset.'));
      }
    } catch (err) {
      setStatus('error');
      setMessage('❌ Errore di connessione. Verifica la rete e riprova.');
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
        editable={!loading}
      />


      {/* Messaggi di stato visibili a schermo */}
      {status === 'loading' && (
        <ActivityIndicator color="#ff0000" style={{ marginVertical: 12 }} />
      )}

      {status === 'success' && (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>{message}</Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{message}</Text>
          {status === 'error' && message.includes('Inserisci') && (
            <Pressable style={styles.retryButton} onPress={() => setStatus('idle')}>
              <Text style={styles.retryText}>Riprova</Text>
            </Pressable>
          )}
        </View>
      )}


      {loading ? (
        <ActivityIndicator color="#ff0000" style={{ marginVertical: 12 }} />
      ) : (
        <Pressable style={styles.primaryButton} onPress={handleResetPassword}>
          <Text style={styles.primaryButtonText}>INVIA PASSWORD TEMPORANEA</Text>
        </Pressable>
      )}


      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Torna al Login</Text>
      </Pressable>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 24, justifyContent: 'center', gap: 16 },
  title: { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#aaa', textAlign: 'center' },
  input: { backgroundColor: '#181818', color: '#fff', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  primaryButton: { backgroundColor: '#ff0000', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  secondaryButton: { padding: 12, alignItems: 'center', marginTop: 4 },
  secondaryButtonText: { color: '#aaa', fontSize: 14 },
  successContainer: {
    backgroundColor: '#0a2e1a',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2ecc71',
    alignItems: 'center',
  },
  successText: { color: '#2ecc71', fontSize: 14, textAlign: 'center', fontWeight: '500' },
  errorContainer: {
    backgroundColor: '#2e0a0a',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff4444',
    alignItems: 'center',
    gap: 10,
  },
  errorText: { color: '#ff4444', fontSize: 14, textAlign: 'center' },
  retryButton: {
    backgroundColor: 'transparent',
    padding: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  retryText: { color: '#ff4444', fontSize: 12, fontWeight: 'bold' },
});
