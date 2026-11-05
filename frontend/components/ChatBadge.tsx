// frontend/components/ChatBadge.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

// Configurazione gestione notifiche push in background/foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface ChatBadgeProps {
  unreadCount: number;
}

export default function ChatBadge({ unreadCount }: ChatBadgeProps) {
  const router = useRouter();

  useEffect(() => {
    // Richiesta permessi notifiche push all'avvio
    async function registerForPush() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permesso notifiche push negato.');
      }
    }
    registerForPush();
  }, []);

  return (
    <Pressable style={styles.container} onPress={() => router.push('/chat')}>
      <Text style={styles.icon}>💬</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', padding: 4 },
  icon: { fontSize: 24 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#ff0000',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
});
