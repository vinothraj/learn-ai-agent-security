import * as WebBrowser from 'expo-web-browser';

/** Opens a link in the in-app browser, but only plain https URLs (content and news are data, not code). */
export function openExternal(url: string) {
  if (!/^https:\/\/[^\s]+$/i.test(url)) return;
  WebBrowser.openBrowserAsync(url).catch(() => {});
}
