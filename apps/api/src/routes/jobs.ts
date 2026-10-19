import { timingSafeEqual } from 'node:crypto';
import { appendToPack, IMPORT_KINDS, NewFlashcard, NewQuizQuestion, parseImport } from '@laas/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AiService } from '../ai/service';
import type { Config } from '../config';
import { invalidateContentCache } from '../contentPack';
import { draftBase, saveDraft } from '../contentDrafts';
import type { Db } from '../db';
import { HttpError, parse, requireAuth, requireRole } from '../http';
import { runDueIngestion, runNewsDrafts } from '../jobs';
import { audit } from '../services';

const Id = z.object({ id: z.uuid() });
const today = () => new Date().toISOString().slice(0, 10);
const tag = () => `x${Date.now().toString(36)}`;

/** Constant-time check of `Authorization: Bearer <JOB_TOKEN>`. */
function requireJobToken(config: Config, req: FastifyRequest) {
  if (!config.JOB_TOKEN) throw new HttpError(404, 'Not found');
  const header = req.headers.authorization ?? '';
  const given = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
  const expected = Buffer.from(config.JOB_TOKEN);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new HttpError(401, 'Invalid job token');
}

export async function jobRoutes(app: FastifyInstance, { db, config, ai }: { db: Db; config: Config; ai: AiService }) {
  // ---- Scheduled jobs (GitHub Actions or any cron). Public path, protected by JOB_TOKEN. ----
  app.post('/v1/jobs/ingest', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (req) => {
    requireJobToken(config, req);
    return runDueIngestion(db, { log: req.log });
  });

  app.post('/v1/jobs/news-drafts', { config: { rateLimit: { max: 2, timeWindow: '1 minute' } } }, async (req) => {
    requireJobToken(config, req);
    return runNewsDrafts(db, ai);
  });

  // ---- Same jobs on demand from the admin panel ----
  app.post('/v1/admin/jobs/ingest', { preHandler: requireRole('admin') }, async (req) => {
    const auth = requireAuth(req);
    const r = await runDueIngestion(db, { log: req.log });
    await audit(db, auth.id, 'job.ingest', undefined, { ...r });
    return r;
  });

  app.post('/v1/admin/jobs/news-drafts', { preHandler: requireRole('admin') }, async (req) => {
    const auth = requireAuth(req);
    const r = await runNewsDrafts(db, ai);
    await audit(db, auth.id, 'job.news_drafts', undefined, { created: r.created, considered: r.considered });
    return r;
  });

  // ---- Apply an approved AI draft to a content draft (still needs review and four-eyes publishing) ----
  app.post('/v1/admin/ai/suggestions/:id/apply', { preHandler: requireRole('editor') }, async (req) => {
    const auth = requireAuth(req);
    const { id } = parse(Id, req.params);
    const { versionId } = parse(z.strictObject({ versionId: z.uuid().optional() }), req.body ?? {});
    const s = (
      await db.query<{ status: string; kind: string; lesson_id: string; payload: { questions?: unknown[]; flashcards?: unknown[] }; applied_at: string | null }>(
        'SELECT status, kind, lesson_id, payload, applied_at FROM ai_suggestions WHERE id = $1',
        [id],
      )
    ).rows[0];
    if (!s) throw new HttpError(404, 'Suggestion not found');
    if (s.status !== 'approved') throw new HttpError(409, 'Only approved drafts can be applied');
    if (s.applied_at) throw new HttpError(409, 'This draft was already applied');
    const questions = (s.payload.questions ?? []).map((q) => {
      const { id: _drop, ...rest } = q as { id?: string };
      return NewQuizQuestion.parse({ ...rest, lessonId: s.lesson_id });
    });
    const flashcards = (s.payload.flashcards ?? []).map((c) => NewFlashcard.parse({ ...(c as object), lessonId: s.lesson_id }));
    const base = await draftBase(db, versionId);
    const r = appendToPack(base.pack, { quiz: questions, flashcards }, tag());
    if (!r.added.quiz && !r.added.flashcards) throw new HttpError(409, 'Nothing new to add', r.skipped);
    const saved = await saveDraft(db, auth.id, {
      versionId: base.versionId,
      pack: r.pack,
      label: `AI drafts ${today()}`,
      note: `Applied AI draft ${id}: +${r.added.quiz} quiz, +${r.added.flashcards} flashcards`,
      action: 'content.ai_applied',
    });
    await db.query('UPDATE ai_suggestions SET applied_version = $2, applied_at = now() WHERE id = $1', [id, saved.id]);
    invalidateContentCache();
    return { versionId: saved.id, created: saved.created, added: r.added, skipped: r.skipped };
  });

  // ---- Bulk import (CSV or JSON) into a content draft ----
  app.post('/v1/admin/content/import', { preHandler: requireRole('editor'), bodyLimit: 2 * 1024 * 1024 }, async (req) => {
    const auth = requireAuth(req);
    const b = parse(
      z.strictObject({
        kind: z.enum(IMPORT_KINDS),
        format: z.enum(['csv', 'json']),
        data: z.string().min(1).max(1_500_000),
        versionId: z.uuid().optional(),
        dryRun: z.boolean().default(false),
      }),
      req.body,
    );
    const base = await draftBase(db, b.versionId);
    const parsed = parseImport(b.kind, b.format, b.data, base.pack);
    const r = appendToPack(base.pack, { flashcards: parsed.flashcards, quiz: parsed.quiz, interview: parsed.interview }, tag());
    const summary = { errors: parsed.errors, added: r.added, skipped: r.skipped };
    // Any invalid row blocks the import, so files are fixed and re-uploaded whole.
    if (b.dryRun || parsed.errors.length) return { ...summary, versionId: null, dryRun: b.dryRun };
    if (!r.added.flashcards && !r.added.quiz && !r.added.interview) throw new HttpError(409, 'Nothing new to import', r.skipped.slice(0, 20));
    const saved = await saveDraft(db, auth.id, {
      versionId: base.versionId,
      pack: r.pack,
      label: `Import ${today()}`,
      note: `Imported ${b.kind} (${b.format}): +${r.added.flashcards} flashcards, +${r.added.quiz} quiz, +${r.added.interview} interview`,
      action: 'content.imported',
    });
    return { ...summary, versionId: saved.id, created: saved.created, dryRun: false };
  });
}
