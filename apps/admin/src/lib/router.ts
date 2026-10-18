import { useSyncExternalStore } from 'react';

/** Minimal hash router: "#/content/abc" -> ["content", "abc"]. Enough for an internal admin tool. */
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export const go = (path: string) => {
  window.location.hash = `#/${path.replace(/^\//, '')}`;
};
