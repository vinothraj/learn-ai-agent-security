import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db';
import { HttpError, parse, requireAuth, requireRole } from '../http';
import { getSource, ingestSource } from '../news/ingest';
import { CATEGORY_INFO } from '../news/mapping';
import { CATEGORIES } from '../news/text';
import { audit } from '../services';

const PublicQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), before: z.iso.datetime().optional() });
const AdminQuery = z.object({
  status: z.enum(['pending', 'published', 'rejected']).default('pending'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const Review = z.strictObject({
  action: z.enum(['publish', 'reject']),
  reason: z.string().trim().max(300).optional(),
  category: z.enum(CATEGORIES).optional(),
  summary: z.string().trim().min(10).max(600).optional(),
});
const Id = z.object({ id: z.uuid() });
const domain = z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i);
const SourceCreate = z.strictObject({
  name: z.string().trim().min(2).max(80),
  feedUrl: z.url({ protocol: /^https$/ }),
  publisher: z.string().trim().min(2).max(80),
  allowedDomains: z.array(domain).min(1).max(10),
  trust: z.enum(['official', 'community', 'research']),
  requireAiRelevance: z.boolean().default(true),
  fetchIntervalMinutes: z.number().int().min(30).max(10080).default(360),
});
const SourcePatch = z.strictObject({
  enabled: z.boolean().optional(),
  fetchIntervalMinutes: z.number().int().min(30).max(10080).optional(),
  requireAiRelevance: z.boolean().optional(),
  trust: z.enum(['official', 'community', 'research']).optional(),
});

interface ArticleRow {
  id: string;
  title: string;
  url: string;
  publisher: string;
  published_at: string | null;
  retrieved_at: string;
  category: keyof typeof CATEGORY_INFO;
  excerpt: string;
  summary: string;
  summary_origin: string;
  defense: string;
  vuln_ids: string[];
  verification: string;
  high_impact: boolean;
  lesson_id: string | null;
  lab_id: string | null;
  interview_id: string | null;
  review_status?: string;
  review_reason?: string | null;
}

const ARTICLE_COLUMNS = `id, title, url, publisher, published_at, retrieved_at, category, excerpt, summary, summary_origin, defense,
  vuln_ids, verification, high_impact, lesson_id, lab_id, interview_id`;

/** Public shape: source facts and our interpretation are separate fields so the app can label them. */
const toPublic = (r: ArticleRow) => ({
  id: r.id,
  title: r.title,
  url: r.url,
  publisher: r.publisher,
  publishedAt: r.published_at,
  retrievedAt: r.retrieved_at,
  category: r.category,
  categoryLabel: CATEGORY_INFO[r.category]?.label ?? r.category,
  sourceExcerpt: r.excerpt,
  interpretation: { summary: r.summary, origin: r.summary_origin, defense: r.defense },
  vulnIds: r.vuln_ids,
  verification: r.verification,
  highImpact: r.high_impact,
  links: { lessonId: r.lesson_id, labId: r.lab_id, interviewId: r.interview_id },
});

export async function newsRoutes(app: FastifyInstance, { db }: { db: Db }) {
  /** Published articles only. Public so guests can read news. */
  app.get('/v1/news', async (req, reply) => {
    const q = parse(PublicQuery, req.query);
    const { rows } = await db.query<ArticleRow>(
      `SELECT ${ARTICLE_COLUMNS} FROM news_articles
       WHERE review_status = 'published' AND ($2::timestamptz IS NULL OR COALESCE(published_at, retrieved_at) < $2::timestamptz)
       ORDER BY COALESCE(published_at, retrieved_at) DESC LIMIT $1`,
      [q.limit, q.before ?? null],
    );
    reply.header('Cache-Control', 'public, max-age=300');
    return { articles: rows.map(toPublic) };
  });

  app.get('/v1/admin/news', { preHandler: requireRole('admin') }, async (req) => {
    const q = parse(AdminQuery, req.query);
    const { rows } = await db.query<ArticleRow>(
      `SELECT ${ARTICLE_COLUMNS}, review_status, review_reason FROM news_articles WHERE review_status = $1 ORDER BY created_at DESC LIMIT $2`,
      [q.status, q.limit],
    );
    return { articles: rows.map((r) => ({ ...toPublic(r), reviewStatus: r.review_status, reviewReason: r.review_reason })) };
  });

  app.patch('/v1/admin/news/:id', { preHandler: requireRole('admin') }, async (req) => {
    const auth = requireAuth(req);
    const { id } = parse(Id, req.params);
    const body = parse(Review, req.body);
    const status = body.action === 'publish' ? 'published' : 'rejected';
    const info = body.category ? CATEGORY_INFO[body.category] : null;
    const { rows } = await db.query<{ id: string }>(
      `UPDATE news_articles SET review_status = $2, review_reason = COALESCE($3, review_reason), reviewed_by = $4, reviewed_at = now(),
         category = COALESCE($5, category), defense = COALESCE($6, defense), lesson_id = COALESCE($7, lesson_id),
         lab_id = COALESCE($8, lab_id), interview_id = COALESCE($9, interview_id),
         summary = COALESCE($10, summary), summary_origin = CASE WHEN $10::text IS NULL THEN summary_origin ELSE 'editor' END
       WHERE id = $1 RETURNING id`,
      [id, status, body.reason ?? null, auth.id, body.category ?? null, info?.defense ?? null, info?.lessonId ?? null, info?.labId ?? null, info?.interviewId ?? null, body.summary ?? null],
    );
    if (!rows.length) throw new HttpError(404, 'Article not found');
    await audit(db, auth.id, `news.${body.action}`, { type: 'news_article', id }, { reason: body.reason ?? null, category: body.category ?? null });
    return { id, reviewStatus: status };
  });

  app.get('/v1/admin/news-sources', { preHandler: requireRole('admin') }, async () => {
    const { rows } = await db.query(
      `SELECT id, name, feed_url, publisher, allowed_domains, trust, require_ai_relevance, enabled, fetch_interval_minutes,
              last_fetched_at, last_status, last_error FROM news_sources ORDER BY name`,
    );
    return { sources: rows };
  });

  app.post('/v1/admin/news-sources', { preHandler: requireRole('admin') }, async (req, reply) => {
    const auth = requireAuth(req);
    const b = parse(SourceCreate, req.body);
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO news_sources (name, feed_url, publisher, allowed_domains, trust, require_ai_relevance, fetch_interval_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (feed_url) DO NOTHING RETURNING id`,
      [b.name, b.feedUrl, b.publisher, b.allowedDomains.map((d) => d.toLowerCase()), b.trust, b.requireAiRelevance, b.fetchIntervalMinutes],
    );
    if (!rows.length) throw new HttpError(409, 'A source with this feed URL already exists');
    await audit(db, auth.id, 'news_source.created', { type: 'news_source', id: rows[0]!.id }, { feedUrl: b.feedUrl });
    return reply.code(201).send({ id: rows[0]!.id });
  });

  app.patch('/v1/admin/news-sources/:id', { preHandler: requireRole('admin') }, async (req) => {
    const auth = requireAuth(req);
    const { id } = parse(Id, req.params);
    const b = parse(SourcePatch, req.body);
    const { rows } = await db.query<{ id: string }>(
      `UPDATE news_sources SET enabled = COALESCE($2, enabled), fetch_interval_minutes = COALESCE($3, fetch_interval_minutes),
         require_ai_relevance = COALESCE($4, require_ai_relevance), trust = COALESCE($5, trust) WHERE id = $1 RETURNING id`,
      [id, b.enabled ?? null, b.fetchIntervalMinutes ?? null, b.requireAiRelevance ?? null, b.trust ?? null],
    );
    if (!rows.length) throw new HttpError(404, 'Source not found');
    await audit(db, auth.id, 'news_source.updated', { type: 'news_source', id }, b);
    return { id };
  });

  /** Run one source now (admin), e.g. after adding it. Rate-limited to avoid hammering feeds. */
  app.post('/v1/admin/news-sources/:id/run', { preHandler: requireRole('admin'), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const auth = requireAuth(req);
    const { id } = parse(Id, req.params);
    const source = await getSource(db, id);
    if (!source) throw new HttpError(404, 'Source not found');
    await db.query('UPDATE news_sources SET last_fetched_at = now() WHERE id = $1', [id]);
    const summary = await ingestSource(db, source);
    await audit(db, auth.id, 'news_source.run', { type: 'news_source', id }, summary as unknown as Record<string, unknown>);
    return summary;
  });

  app.get('/v1/admin/ingestion-runs', { preHandler: requireRole('admin') }, async () => {
    const { rows } = await db.query(
      `SELECT r.id, s.name AS source, r.started_at, r.finished_at, r.status, r.fetched, r.inserted, r.duplicates, r.rejected, r.error
       FROM ingestion_runs r LEFT JOIN news_sources s ON s.id = r.source_id ORDER BY r.id DESC LIMIT 50`,
    );
    return { runs: rows.map((r) => ({ ...r, id: Number(r.id) })) };
  });
}
