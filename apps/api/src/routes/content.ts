import { createHash } from 'node:crypto';
import { packIssues, stableStringify } from '@laas/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db';
import { HttpError, parse, requireAuth, requireRole } from '../http';
import { notifyTopic, type PushSender } from '../push';
import { audit } from '../services';

const Id = z.object({ id: z.uuid() });
const Create = z.strictObject({ label: z.string().trim().min(1).max(40), notes: z.string().max(2000).default(''), pack: z.record(z.string(), z.unknown()) });
const Update = z.strictObject({ label: z.string().trim().min(1).max(40).optional(), notes: z.string().max(2000).optional(), pack: z.record(z.string(), z.unknown()).optional() });
const Note = z.strictObject({ note: z.string().trim().max(1000).default('') });

const checksum = (pack: unknown) => createHash('sha256').update(stableStringify(pack)).digest('hex');
const CONTENT_BODY_LIMIT = 5 * 1024 * 1024;

interface VersionRow {
  id: string;
  label: string;
  status: string;
  issues: number;
  checksum: string;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  published_at: string | null;
}

const LIST_COLUMNS = 'id, label, status, issues, checksum, notes, created_by, created_at, updated_at, submitted_at, reviewed_by, reviewed_at, review_note, published_at';

/**
 * Content CMS: editors create and submit versions; admins review and publish. Packs are validated
 * with the same packIssues() the app runs before applying an update, so a broken pack can never ship.
 */
export async function contentRoutes(app: FastifyInstance, { db, push }: { db: Db; push: PushSender | null }) {
  const get = async (id: string) => (await db.query<VersionRow & { pack: unknown }>(`SELECT ${LIST_COLUMNS}, pack FROM content_versions WHERE id = $1`, [id])).rows[0];

  // ---- Public delivery (apps download published packs) ----
  app.get('/v1/content/manifest', async (_req, reply) => {
    const row = (await db.query<VersionRow>(`SELECT ${LIST_COLUMNS} FROM content_versions WHERE status = 'published'`)).rows[0];
    reply.header('Cache-Control', 'public, max-age=300');
    if (!row) return { published: null };
    return { published: { id: row.id, label: row.label, checksum: row.checksum, publishedAt: row.published_at } };
  });

  app.get('/v1/content/packs/:id', async (req, reply) => {
    const { id } = parse(Id, req.params);
    const row = await get(id);
    if (!row || row.status !== 'published') throw new HttpError(404, 'Not found');
    reply.header('Cache-Control', 'public, max-age=86400, immutable');
    return { id: row.id, label: row.label, checksum: row.checksum, pack: row.pack };
  });

  // ---- Authoring (editor+) ----
  app.get('/v1/admin/content', { preHandler: requireRole('editor') }, async () => ({
    versions: (await db.query<VersionRow>(`SELECT ${LIST_COLUMNS} FROM content_versions ORDER BY created_at DESC LIMIT 50`)).rows,
  }));

  app.get('/v1/admin/content/:id', { preHandler: requireRole('editor') }, async (req) => {
    const { id } = parse(Id, req.params);
    const row = await get(id);
    if (!row) throw new HttpError(404, 'Version not found');
    return { ...row, issueList: packIssues(row.pack) };
  });

  app.post('/v1/admin/content', { preHandler: requireRole('editor'), bodyLimit: CONTENT_BODY_LIMIT }, async (req, reply) => {
    const auth = requireAuth(req);
    const b = parse(Create, req.body);
    const issues = packIssues(b.pack);
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO content_versions (label, notes, pack, checksum, issues, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [b.label, b.notes, JSON.stringify(b.pack), checksum(b.pack), issues.length, auth.id],
    );
    await audit(db, auth.id, 'content.created', { type: 'content_version', id: rows[0]!.id }, { label: b.label, issues: issues.length });
    return reply.code(201).send({ id: rows[0]!.id, issues });
  });

  app.put('/v1/admin/content/:id', { preHandler: requireRole('editor'), bodyLimit: CONTENT_BODY_LIMIT }, async (req) => {
    const auth = requireAuth(req);
    const { id } = parse(Id, req.params);
    const b = parse(Update, req.body);
    const row = await get(id);
    if (!row) throw new HttpError(404, 'Version not found');
    if (row.status !== 'draft' && row.status !== 'rejected') throw new HttpError(409, `A ${row.status} version cannot be edited; create a new draft`);
    const pack = b.pack ?? row.pack;
    const issues = packIssues(pack);
    await db.query(
      `UPDATE content_versions SET label = COALESCE($2, label), notes = COALESCE($3, notes), pack = $4, checksum = $5, issues = $6,
         status = 'draft', updated_at = now() WHERE id = $1`,
      [id, b.label ?? null, b.notes ?? null, JSON.stringify(pack), checksum(pack), issues.length],
    );
    await audit(db, auth.id, 'content.updated', { type: 'content_version', id }, { issues: issues.length });
    return { id, issues };
  });

  app.post('/v1/admin/content/:id/submit', { preHandler: requireRole('editor') }, async (req) => {
    const auth = requireAuth(req);
    const { id } = parse(Id, req.params);
    const row = await get(id);
    if (!row) throw new HttpError(404, 'Version not found');
    if (row.status !== 'draft' && row.status !== 'rejected') throw new HttpError(409, `Only drafts can be submitted (status: ${row.status})`);
    const issues = packIssues(row.pack);
    if (issues.length) throw new HttpError(422, 'Fix validation issues before submitting', issues.slice(0, 20));
    await db.query(`UPDATE content_versions SET status = 'in_review', submitted_at = now(), updated_at = now() WHERE id = $1`, [id]);
    await audit(db, auth.id, 'content.submitted', { type: 'content_version', id });
    return { id, status: 'in_review' };
  });

  // ---- Review and publishing (admin+, four-eyes) ----
  app.post('/v1/admin/content/:id/publish', { preHandler: requireRole('admin') }, async (req) => {
    const auth = requireAuth(req);
    const { id } = parse(Id, req.params);
    const { note } = parse(Note, req.body ?? {});
    const row = await get(id);
    if (!row) throw new HttpError(404, 'Version not found');
    if (row.status !== 'in_review') throw new HttpError(409, 'Only versions in review can be published');
    if (row.created_by === auth.id && auth.role !== 'super_admin') throw new HttpError(403, 'Four-eyes rule: another admin must publish your own version');
    const issues = packIssues(row.pack);
    if (issues.length) throw new HttpError(422, 'Version no longer passes validation', issues.slice(0, 20));
    await db.transaction(async (tx) => {
      await tx.query(`UPDATE content_versions SET status = 'archived', updated_at = now() WHERE status = 'published'`);
      await tx.query(
        `UPDATE content_versions SET status = 'published', reviewed_by = $2, reviewed_at = now(), review_note = $3, published_at = now(), updated_at = now() WHERE id = $1`,
        [id, auth.id, note],
      );
      await audit(tx, auth.id, 'content.published', { type: 'content_version', id }, { label: row.label, checksum: row.checksum });
    });
    await notifyTopic(db, push, { topic: 'content', type: 'content', ref: id, title: 'New lessons are available', body: 'Fresh AI security content was published. Open the app to get it.', url: '/' }, req.log);
    return { id, status: 'published' };
  });

  app.post('/v1/admin/content/:id/reject', { preHandler: requireRole('admin') }, async (req) => {
    const auth = requireAuth(req);
    const { id } = parse(Id, req.params);
    const { note } = parse(Note, req.body ?? {});
    const row = await get(id);
    if (!row) throw new HttpError(404, 'Version not found');
    if (row.status !== 'in_review') throw new HttpError(409, 'Only versions in review can be rejected');
    await db.query(`UPDATE content_versions SET status = 'rejected', reviewed_by = $2, reviewed_at = now(), review_note = $3, updated_at = now() WHERE id = $1`, [id, auth.id, note]);
    await audit(db, auth.id, 'content.rejected', { type: 'content_version', id }, { note });
    return { id, status: 'rejected' };
  });
}
