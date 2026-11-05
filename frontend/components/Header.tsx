// frontend/components/Header.tsx
import React, { useState } from 'react';
import { View, Image, Text, Pressable, StyleSheet, Modal, TouchableWithoutFeedback } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

interface HeaderProps {
  userAvatarUrl?: string; // Foto profilo utente caricata al login
}

export default function Header({ userAvatarUrl }: HeaderProps) {
  const router = useRouter();
  const [isFlipped, setIsFlipped] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const flipRotation = useSharedValue(0);

  // Animazione capovolgimento (0 -> 180 gradi)
  const handlePressOrHover = () => {
    const nextState = !isFlipped;
    setIsFlipped(nextState);
    flipRotation.value = withTiming(nextState ? 180 : 0, { duration: 400 });
    setMenuVisible(true);
  };

  const frontAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${flipRotation.value}deg` }],
    backfaceVisibility: 'hidden',
  }));

  const backAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${flipRotation.value + 180}deg` }],
    backfaceVisibility: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
  }));

  const handleLogout = () => {
    setMenuVisible(false);
    // Inserisci qui la pulizia del token/stato di autenticazione
    router.replace('/login');
  };

  return (
    <View style={styles.headerContainer}>
      <Text style={styles.brandTitle}>SILVER-PT</Text>

      {/* Contenitore Avatar / Logo flippabile a destra */}
      <Pressable onPress={handlePressOrHover} style={styles.avatarWrapper}>
        <Animated.View style={[styles.avatarBox, frontAnimatedStyle]}>
          <Image
            source={require('../assets/images/logo-wide-v2.png')}
            style={styles.avatarImage}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={[styles.avatarBox, backAnimatedStyle]}>
          <Image
            source={
              userAvatarUrl
                ? { uri: userAvatarUrl }
                : require('../assets/images/logo-wide-v2.png')
            }
            style={[styles.avatarImage, { borderRadius: 20 }]}
            resizeMode="cover"
          />
        </Animated.View>
      </Pressable>

      {/* Menu a tendina Gestione Account */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.dropdownMenu}>
              <Pressable style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push('/profile'); }}>
                <Text style={styles.menuText}>⚙️ Gestisci Account & Credenziali</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push('/change-password'); }}>
                <Text style={styles.menuText}>🔒 Modifica Password</Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable style={styles.menuItem} onPress={handleLogout}>
                <Text style={[styles.menuText, { color: '#ff3333' }]}>🚪 Logout</Text>
              </Pressable>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#222' },
  brandTitle: { color: '#fff', fontSize: 20, fontWeight: '900', fontStyle: 'italic' },
  avatarWrapper: { width: 40, height: 40 },
  avatarBox: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 40, height: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  dropdownMenu: { position: 'absolute', top: 60, right: 16, backgroundColor: '#181818', borderRadius: 8, padding: 8, width: 230, borderWidth: 1, borderColor: '#333' },
  menuItem: { paddingVertical: 10, paddingHorizontal: 12 },
  menuText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 4 },
});
