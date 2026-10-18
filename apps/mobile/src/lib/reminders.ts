import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'daily-learning';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const MESSAGES = [
  { title: 'Your 5-minute security lesson is ready', body: 'One short lesson keeps your streak and your skills sharp.' },
  { title: 'Time for today’s AI security session', body: 'Pick up where you left off. It only takes a few minutes.' },
  { title: 'Ready to close your Learn ring?', body: 'A quick lesson or quiz counts toward today’s goal.' },
];

/** Asks for permission (creating the channel first, as Android 13+ requires). */
async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Daily learning reminder',
      // eslint-disable-next-line import/namespace -- exported at runtime as a compiled TS enum the plugin can't parse
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

/**
 * Replaces any existing reminder with one daily local notification. Local notifications
 * need no server or account. Returns false if the learner declined permission.
 */
export async function scheduleDailyReminder(hour: number, minute: number): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!(await ensurePermission())) return false;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const msg = MESSAGES[new Date().getDate() % MESSAGES.length]!;
  await Notifications.scheduleNotificationAsync({
    content: { title: msg.title, body: msg.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
  return true;
}

export async function cancelReminders() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export function formatTime(hour: number, minute: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
