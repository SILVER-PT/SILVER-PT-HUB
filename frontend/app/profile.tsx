// frontend/app/profile.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Campi del profilo e credenziali
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setName(user.name || '');
        setEmail(user.email || '');
        setWhatsapp(user.staff?.whatsapp || '');
        setTitle(user.staff?.title || '');
        setBio(user.staff?.bio || '');
      }
    } catch (error) {
      console.error('Errore nel caricamento dei dati utente:', error);
    }
  };

  const handleSaveChanges = async () => {
    setSuccessMessage('');
    setErrorMessage('');
    setSaving(true);

    try {
      const token = await AsyncStorage.getItem('token');
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

      const payload: any = {
        name,
        staff: {
          whatsapp,
          title,
          bio,
        }
      };

      // Validazione e gestione cambio password
      if (newPassword.trim()) {
        if (!currentPassword.trim()) {
          setErrorMessage('Inserisci la password attuale per impostarne una nuova.');
          setSaving(false);
          return;
        }
        if (newPassword !== confirmNewPassword) {
          setErrorMessage('Le nuove password non coincidono. Verificale.');
          setSaving(false);
          return;
        }
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const response = await fetch(`${backendUrl}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        const updatedUser = data.user || data;
        
        // Aggiorna lo storage e lo stato locale
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        setName(updatedUser.name || '');
        setEmail(updatedUser.email || '');
        setWhatsapp(updatedUser.staff?.whatsapp || '');
        setTitle(updatedUser.staff?.title || '');
        setBio(updatedUser.staff?.bio || '');

        // Pulisci i campi password
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');

        setSuccessMessage('Profilo e credenziali aggiornati con successo!');
      } else {
        setErrorMessage(data.detail || 'Impossibile aggiornare il profilo.');
      }
    } catch (err) {
      setErrorMessage('Errore di connessione al server.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    router.replace('/login');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headerTitle}>GESTIONE PROFILO</Text>

      {/* Banner di Successo */}
      {successMessage ? (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : null}

      {/* Banner di Errore */}
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.label}>Nome Completo</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>Email (Non modificabile)</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={email}
          editable={false}
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>WhatsApp</Text>
        <TextInput
          style={styles.input}
          value={whatsapp}
          onChangeText={setWhatsapp}
          placeholder="+39..."
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>Titolo Professionale</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Es. Personal Fitness Trainer"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>Bio / Presentazione</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={bio}
          onChangeText={setBio}
          multiline
          placeholder="Racconta qualcosa di te..."
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Modifica Credenziali (Opzionale)</Text>
        
        <Text style={styles.label}>Password Attuale (Temporanea o Vecchia)</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Richiesta solo se cambi password"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>Nuova Password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Lascia vuoto per non cambiarla"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>Ripeti Nuova Password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
          placeholder="Conferma nuova password"
          placeholderTextColor="#666"
        />
      </View>

      {saving ? (
        <ActivityIndicator color="#ff0000" style={{ marginVertical: 20 }} />
      ) : (
        <Pressable style={styles.primaryButton} onPress={handleSaveChanges}>
          <Text style={styles.primaryButtonText}>SALVA MODIFICHE</Text>
        </Pressable>
      )}

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>LOGOUT</Text>
      </Pressable>

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Torna Indietro</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#000', padding: 24, gap: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 10 },
  successBanner: { backgroundColor: '#112818', borderWidth: 1, borderColor: '#2ecc71', padding: 12, borderRadius: 8, alignItems: 'center' },
  successText: { color: '#2ecc71', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  errorBanner: { backgroundColor: '#2c1111', borderWidth: 1, borderColor: '#ff4444', padding: 12, borderRadius: 8, alignItems: 'center' },
  errorText: { color: '#ff4444', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  section: { backgroundColor: '#121212', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#222', gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: '#181818', color: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  disabledInput: { color: '#666', backgroundColor: '#111' },
  textArea: { height: 80, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#ff0000', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  logoutButton: { backgroundColor: '#222', padding: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#444' },
  logoutButtonText: { color: '#ff4444', fontWeight: 'bold', fontSize: 14 },
  backButton: { alignItems: 'center', marginTop: 5 },
  backButtonText: { color: '#888', fontSize: 14, textDecorationLine: 'underline' },
});
