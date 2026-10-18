import { applyContentPack, CONTENT_VERSION, compareVersions } from '@laas/content';
import { packIssues, stableStringify, type ContentPack } from '@laas/shared';
import * as Crypto from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, type ReactNode } from 'react';
import { cloud } from '@/sync/auth';

const KEY = 'content_pack';

interface StoredPack {
  checksum: string;
  label: string;
  pack: ContentPack;
}

/**
 * Over-the-air content. At startup, a previously downloaded pack is applied if it is newer than
 * the bundled one and still passes every integrity rule. In the background, a newer published
 * pack is downloaded, its checksum verified, validated, and stored for the NEXT launch (never
 * swapped mid-session). Any failure silently keeps the bundled content.
 */
export function ContentUpdates({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let activeChecksum: string | null = null;
      try {
        const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', KEY);
        if (row) {
          const stored = JSON.parse(row.value) as StoredPack;
          if (compareVersions(stored.pack.version, CONTENT_VERSION) > 0 && packIssues(stored.pack).length === 0) {
            applyContentPack(stored.pack);
            activeChecksum = stored.checksum;
          }
        }
      } catch {
        // Corrupt cache: keep bundled content.
      }
      if (!cancelled) setReady(true);

      if (!cloud.apiUrl) return;
      try {
        const m = (await (await fetch(`${cloud.apiUrl}/v1/content/manifest`)).json()) as { published: { id: string; checksum: string; label: string } | null };
        if (!m.published || m.published.checksum === activeChecksum) return;
        const res = (await (await fetch(`${cloud.apiUrl}/v1/content/packs/${m.published.id}`)).json()) as { checksum: string; pack: ContentPack };
        const actual = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, stableStringify(res.pack));
        if (actual !== m.published.checksum) return; // tampered or corrupted download
        if (compareVersions(res.pack.version, CONTENT_VERSION) <= 0) return; // bundled content is newer
        if (packIssues(res.pack).length) return;
        const stored: StoredPack = { checksum: actual, label: m.published.label, pack: res.pack };
        await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', KEY, JSON.stringify(stored));
      } catch {
        // Offline or server unavailable: try again next launch.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  return ready ? <>{children}</> : null;
}
