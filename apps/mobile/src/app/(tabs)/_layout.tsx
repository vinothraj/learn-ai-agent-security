import { Redirect, Tabs } from 'expo-router';
import { BookOpen, Dumbbell, House, Newspaper, UserRound } from 'lucide-react-native';

import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const { theme } = useTheme();
  const { settings } = useSettings();

  if (!settings.onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          height: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: theme.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <House size={22} color={color} /> }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: ({ color }) => <BookOpen size={22} color={color} /> }} />
      <Tabs.Screen
        name="practice"
        options={{ title: 'Practice', tabBarIcon: ({ color }) => <Dumbbell size={22} color={color} /> }}
      />
      <Tabs.Screen name="news" options={{ title: 'News', tabBarIcon: ({ color }) => <Newspaper size={22} color={color} /> }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: ({ color }) => <UserRound size={22} color={color} /> }} />
    </Tabs>
  );
}
