import { createHash } from 'node:crypto';
import { contentPack as bundledPack } from '@laas/content';
import { bumpVersion, packIssues, stableStringify, type ContentPack } from '@laas/shared';
import type { Db } from './db';
import { HttpError } from './http';
import { audit } from './services';

const checksum = (pack: unknown) => createHash('sha256').update(stableStringify(pack)).digest('hex');

/**
 * The pack to add items to: an existing editable draft (when `versionId` is given), otherwise the
 * published pack, falling back to the bundled one.
 */
export async function draftBase(db: Db, versionId?: string): Promise<{ pack: ContentPack; versionId: string | null }> {
  if (versionId) {
    const row = (await db.query<{ status: string; pack: ContentPack }>('SELECT status, pack FROM content_versions WHERE id = $1', [versionId])).rows[0];
    if (!row) throw new HttpError(404, 'Draft not found');
    if (row.status !== 'draft' && row.status !== 'rejected') throw new HttpError(409, `A ${row.status} version cannot be edited; omit versionId to start a new draft`);
    return { pack: row.pack, versionId };
  }
  const published = (await db.query<{ pack: ContentPack }>(`SELECT pack FROM content_versions WHERE status = 'published'`)).rows[0];
  return { pack: published?.pack ?? bundledPack, versionId: null };
}

/**
 * Saves a pack as a draft: updates the given draft, or creates a new one whose pack version is
 * bumped so apps will accept it once published. Refuses packs that fail validation.
 */
export async function saveDraft(
  db: Db,
  userId: string,
  opts: { versionId: string | null; pack: ContentPack; label: string; note: string; action: string },
): Promise<{ id: string; created: boolean }> {
  const issues = packIssues(opts.pack);
  if (issues.length) throw new HttpError(422, 'The result would not pass content validation', issues.slice(0, 20));
  if (opts.versionId) {
    await db.query(
      `UPDATE content_versions SET pack = $2, checksum = $3, issues = 0, status = 'draft', notes = left(notes || $4, 2000), updated_at = now() WHERE id = $1`,
      [opts.versionId, JSON.stringify(opts.pack), checksum(opts.pack), `\n${opts.note}`],
    );
    await audit(db, userId, opts.action, { type: 'content_version', id: opts.versionId }, { note: opts.note });
    return { id: opts.versionId, created: false };
  }
  const pack = { ...opts.pack, version: bumpVersion(opts.pack.version) };
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO content_versions (label, notes, pack, checksum, issues, created_by) VALUES ($1, $2, $3, $4, 0, $5) RETURNING id`,
    [opts.label.slice(0, 40), opts.note.slice(0, 2000), JSON.stringify(pack), checksum(pack), userId],
  );
  await audit(db, userId, opts.action, { type: 'content_version', id: rows[0]!.id }, { note: opts.note });
  return { id: rows[0]!.id, created: true };
}
