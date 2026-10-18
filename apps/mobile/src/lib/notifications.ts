import type { PlannedNotification } from '@laas/shared';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local notifications are planned by `planLocalNotifications` (shared, unit-tested) and
 * scheduled here with stable identifiers, so re-planning replaces rather than duplicates.
 */

export const CHANNEL_LEARNING = 'daily-learning';
export const CHANNEL_ADVISORIES = 'advisories';
const MANAGED = /^(reminder|recap|weekly):/;

export const notificationsSupported = Platform.OS !== 'web';

if (notificationsSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_LEARNING, {
    name: 'Learning reminders and recaps',
    // eslint-disable-next-line import/namespace -- exported at runtime as a compiled TS enum the plugin can't parse
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_ADVISORIES, {
    name: 'Security advisories',
    // eslint-disable-next-line import/namespace -- see above
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Asks for permission (creating channels first, as Android 13+ requires). */
export async function ensurePermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  await ensureChannels();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).status === 'granted';
}

async function hasPermission() {
  return notificationsSupported && (await Notifications.getPermissionsAsync()).status === 'granted';
}

/** Replaces all app-managed scheduled notifications with the plan. Never prompts for permission. */
export async function applyPlan(plan: PlannedNotification[]): Promise<number> {
  if (!(await hasPermission())) return 0;
  await ensureChannels();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const keep = new Set(plan.map((p) => p.id));
  for (const n of scheduled) {
    if (MANAGED.test(n.identifier) && !keep.has(n.identifier)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  for (const p of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id, // same id replaces the previous version
      content: { title: p.title, body: p.body, data: { url: p.url, type: p.type, id: p.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.fireAt, channelId: CHANNEL_LEARNING },
    });
  }
  return plan.length;
}

export async function cancelManaged() {
  if (!notificationsSupported) return;
  for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
    if (MANAGED.test(n.identifier)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
}

/** Only in-app routes are honoured from notification payloads. */
export function safeRoute(url: unknown): string | null {
  return typeof url === 'string' && /^\/[a-z0-9/_\-?=&]*$/i.test(url) && !url.startsWith('//') ? url : null;
}

const projectId: string | undefined =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;

/** Remote push needs a development or store build with an EAS project id (not Expo Go, not web). */
export function pushAvailability(): { available: boolean; reason?: string } {
  if (!notificationsSupported) return { available: false, reason: 'Not available on the web preview.' };
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return { available: false, reason: 'Needs the installed app (not Expo Go).' };
  if (!projectId) return { available: false, reason: 'Push is not configured for this build yet.' };
  return { available: true };
}

export async function getPushToken(): Promise<string | null> {
  if (!pushAvailability().available || !(await ensurePermission())) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

export function formatTime(hour: number, minute: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
