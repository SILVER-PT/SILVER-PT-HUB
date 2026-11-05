// frontend/app/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import { LogBox, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { QueryClientProvider } from '@tanstack/react-query';

import { ErrorBoundary } from '@/src/components/error-boundary';
import { queryClient } from '@/src/query-client';
import { AuthProvider } from '@/src/auth';
import { colors } from '@/src/theme';

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <AuthProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'fade', // Previene ricaricamenti forzati o crash tra schermate web/mobile
                  detachInactiveScreens: false, // Mantiene lo stato attivo prevenendo il messaggio di reload
                  contentStyle: { backgroundColor: colors.surface },
                }}
              >
                <Stack.Screen name="index" options={{ title: 'Home' }} />
                <Stack.Screen name="login" />
                <Stack.Screen name="forgot-password" />
              </Stack>
            </AuthProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});