/**
 * Android home-screen widget wiring. Loaded with require() only when the native module exists
 * (installed builds), because the library throws at import time in Expo Go and on the web.
 */
import { dayKey } from '@laas/shared';
import { openDatabaseAsync } from 'expo-sqlite';
import { registerWidgetTaskHandler, requestWidgetUpdate, type WidgetTaskHandler } from 'react-native-android-widget';

import { ProgressWidget } from './ProgressWidget';
import { DB_NAME, parseSnapshot, SNAPSHOT_KEY, WIDGET_NAME, type WidgetSnapshot } from './snapshot';

async function readSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const db = await openDatabaseAsync(DB_NAME);
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', SNAPSHOT_KEY);
    return parseSnapshot(row?.value);
  } catch {
    return null; // first run: the app has not created the database yet
  }
}

const handler: WidgetTaskHandler = async ({ widgetAction, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED') return;
  renderWidget(<ProgressWidget snapshot={await readSnapshot()} today={dayKey(new Date())} />);
};

export function registerWidget() {
  registerWidgetTaskHandler(handler);
}

export async function updateWidget(snapshot: WidgetSnapshot) {
  await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => <ProgressWidget snapshot={snapshot} today={dayKey(new Date())} /> });
}
