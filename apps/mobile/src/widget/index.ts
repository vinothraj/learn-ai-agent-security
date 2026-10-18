import { Platform, TurboModuleRegistry } from 'react-native';

import type { WidgetSnapshot } from './snapshot';

type AndroidWidgetApi = typeof import('./android');

/** The widget module, or null where widgets are unavailable (web, iOS, Expo Go). */
export function widgetApi(): AndroidWidgetApi | null {
  if (Platform.OS !== 'android' || !TurboModuleRegistry.get('AndroidWidget')) return null;
  // Lazy on purpose: the library throws at import time when its native module is missing.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./android') as AndroidWidgetApi;
}

export async function pushWidgetSnapshot(snapshot: WidgetSnapshot) {
  try {
    await widgetApi()?.updateWidget(snapshot);
  } catch {
    // No widget on the home screen, or the launcher refused: nothing to do.
  }
}
