import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { migrate } from '@/db/migrations';
import { ProgressProvider } from '@/state/progress';
import { SettingsProvider } from '@/state/settings';
import { TrackerProvider } from '@/state/tracker';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();

function AppStack() {
  const { theme, animate } = useTheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
          animation: animate ? 'slide_from_right' : 'none',
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: animate ? 'fade' : 'none', gestureEnabled: false }} />
        <Stack.Screen name="lesson/[id]" options={{ animation: animate ? 'slide_from_bottom' : 'none' }} />
        <Stack.Screen name="quiz" options={{ animation: animate ? 'slide_from_bottom' : 'none' }} />
        <Stack.Screen name="review" options={{ animation: animate ? 'slide_from_bottom' : 'none' }} />
        <Stack.Screen name="game/[id]" options={{ animation: animate ? 'slide_from_bottom' : 'none' }} />
        <Stack.Screen name="roadmap/[id]" />
        <Stack.Screen name="interview" />
        <Stack.Screen name="share" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SQLiteProvider databaseName="learn-ai-security.db" onInit={migrate}>
          <SettingsProvider>
            <ThemeProvider>
              <ProgressProvider>
                <TrackerProvider>
                  <AppStack />
                </TrackerProvider>
              </ProgressProvider>
            </ThemeProvider>
          </SettingsProvider>
        </SQLiteProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
