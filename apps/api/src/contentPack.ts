import { contentPack as bundledPack } from '@laas/content';
import { buildLessonIndex, type ContentPack, type LessonIndex } from '@laas/shared';
import type { Db } from './db';

/** The content apps are using: the published pack if there is one, else the bundled pack. */
export interface CurrentContent {
  pack: ContentPack;
  label: string;
  index: LessonIndex;
}

let cached: { id: string; at: number; value: CurrentContent } | null = null;
const TTL_MS = 60_000;

export async function currentContent(db: Db): Promise<CurrentContent> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const row = (await db.query<{ id: string; label: string; pack: ContentPack }>(`SELECT id, label, pack FROM content_versions WHERE status = 'published'`)).rows[0];
  const id = row?.id ?? 'bundled';
  if (cached?.id === id) {
    cached.at = Date.now();
    return cached.value;
  }
  const pack = row?.pack ?? bundledPack;
  const value = { pack, label: row?.label ?? 'bundled', index: buildLessonIndex(pack.lessons) };
  cached = { id, at: Date.now(), value };
  return value;
}

/** Tests and publishing call this so the next request sees the new pack immediately. */
export function invalidateContentCache() {
  cached = null;
}
