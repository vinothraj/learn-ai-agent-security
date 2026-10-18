import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db';
import { fetchFeed, parseFeed, type FetchResult } from './feed';
import { CATEGORY_INFO, templateSummary } from './mapping';
import {
  canonicalUrl,
  classify,
  excerpt,
  extractVulnIds,
  fingerprintHex,
  hamming,
  hostAllowed,
  isAiRelevant,
  isHighImpact,
  NEAR_DUPLICATE_BITS,
  simhash,
} from './text';

export interface SourceRow {
  id: string;
  name: string;
  feed_url: string;
  publisher: string;
  allowed_domains: string[];
  trust: 'official' | 'community' | 'research';
  require_ai_relevance: boolean;
  max_items_per_run: number;
  etag: string | null;
  last_modified: string | null;
}

export interface RunSummary {
  status: 'ok' | 'not_modified' | 'error';
  fetched: number;
  inserted: number;
  duplicates: number;
  rejected: number;
  error?: string;
}

export type Fetcher = (url: string, prev: { etag: string | null; lastModified: string | null }) => Promise<FetchResult>;

const MAX_AGE_DAYS = 60;
const DEDUPE_WINDOW_DAYS = 30;

/**
 * Ingests one source. Publication policy: items from official sources without high-impact claims
 * publish automatically; high-impact claims (CVEs, "actively exploited", zero-days) and research
 * preprints wait for an admin. Nothing is ever executed or summarised by a model here.
 */
export async function ingestSource(db: Db, source: SourceRow, fetcher: Fetcher = fetchFeed): Promise<RunSummary> {
  const run = (await db.query<{ id: unknown }>(`INSERT INTO ingestion_runs (source_id, status) VALUES ($1, 'running') RETURNING id`, [source.id])).rows[0]!.id;
  const summary: RunSummary = { status: 'ok', fetched: 0, inserted: 0, duplicates: 0, rejected: 0 };
  try {
    const res = await fetcher(source.feed_url, { etag: source.etag, lastModified: source.last_modified });
    if (res.status === 'not-modified') {
      summary.status = 'not_modified';
    } else {
      const items = parseFeed(res.body ?? '').slice(0, source.max_items_per_run);
      summary.fetched = items.length;
      const recent = (
        await db.query<{ fingerprint: string; vuln_ids: string[] }>(
          `SELECT fingerprint, vuln_ids FROM news_articles WHERE created_at > now() - make_interval(days => $1)`,
          [DEDUPE_WINDOW_DAYS],
        )
      ).rows.map((r) => ({ fp: BigInt(`0x${r.fingerprint}`), ids: [...r.vuln_ids].sort().join(',') }));

      for (const item of items) {
        const canonical = canonicalUrl(item.link);
        const tooOld = item.publishedAt && Date.now() - item.publishedAt.getTime() > MAX_AGE_DAYS * 86_400_000;
        if (!canonical || !item.title || !hostAllowed(canonical, source.allowed_domains) || tooOld) {
          summary.rejected++;
          continue;
        }
        const body = `${item.title} ${item.text}`;
        if (source.require_ai_relevance && !isAiRelevant(body)) {
          summary.rejected++;
          continue;
        }
        const exists = await db.query('SELECT 1 FROM news_articles WHERE canonical_url = $1', [canonical]);
        if (exists.rows.length) {
          await db.query('UPDATE news_articles SET last_checked_at = now() WHERE canonical_url = $1', [canonical]);
          summary.duplicates++;
          continue;
        }
        const fp = simhash(body);
        const ids = extractVulnIds(body).sort().join(',');
        if (recent.some((r) => r.ids === ids && hamming(r.fp, fp) <= NEAR_DUPLICATE_BITS)) {
          summary.duplicates++;
          continue;
        }
        const category = classify(body);
        const vulnIds = extractVulnIds(body);
        const highImpact = isHighImpact(body, vulnIds);
        const research = source.trust === 'research';
        const autoPublish = source.trust === 'official' && !highImpact;
        const info = CATEGORY_INFO[category];
        await db.query(
          `INSERT INTO news_articles (source_id, title, url, canonical_url, publisher, published_at, category, tags, excerpt, summary,
             defense, vuln_ids, verification, high_impact, review_status, review_reason, lesson_id, lab_id, interview_id, fingerprint)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
           ON CONFLICT (canonical_url) DO NOTHING`,
          [
            source.id,
            item.title.slice(0, 300),
            canonical, // always the https, tracking-free link (some feeds publish http:// links)
            canonical,
            source.publisher,
            item.publishedAt?.toISOString() ?? null,
            category,
            [category, source.trust],
            excerpt(item.text),
            templateSummary(category, source.publisher, vulnIds),
            info.defense,
            vulnIds,
            research ? 'unverified' : 'source_verified',
            highImpact,
            autoPublish ? 'published' : 'pending',
            autoPublish ? null : highImpact ? 'High-impact claim: confirm details before publishing' : research ? 'Research preprint (not peer reviewed)' : 'Community source',
            info.lessonId,
            info.labId,
            info.interviewId,
            fingerprintHex(fp),
          ],
        );
        recent.push({ fp, ids });
        summary.inserted++;
      }
    }
    await db.query(
      `UPDATE news_sources SET last_status = $2, last_error = NULL, etag = COALESCE($3, etag), last_modified = COALESCE($4, last_modified) WHERE id = $1`,
      [source.id, summary.status, res.etag ?? null, res.lastModified ?? null],
    );
  } catch (e) {
    summary.status = 'error';
    summary.error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    await db.query(`UPDATE news_sources SET last_status = 'error', last_error = $2 WHERE id = $1`, [source.id, summary.error]);
  }
  await db.query(
    `UPDATE ingestion_runs SET finished_at = now(), status = $2, fetched = $3, inserted = $4, duplicates = $5, rejected = $6, error = $7 WHERE id = $1`,
    [run, summary.status, summary.fetched, summary.inserted, summary.duplicates, summary.rejected, summary.error ?? null],
  );
  return summary;
}

const SOURCE_COLUMNS = 'id, name, feed_url, publisher, allowed_domains, trust, require_ai_relevance, max_items_per_run, etag, last_modified';

/** Atomically claims the most overdue enabled source (safe with several API instances). */
export async function claimDueSource(db: Db): Promise<SourceRow | null> {
  const { rows } = await db.query<SourceRow>(
    `UPDATE news_sources SET last_fetched_at = now()
     WHERE id = (
       SELECT id FROM news_sources
       WHERE enabled AND (last_fetched_at IS NULL OR last_fetched_at < now() - make_interval(mins => fetch_interval_minutes))
       ORDER BY last_fetched_at NULLS FIRST LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING ${SOURCE_COLUMNS}`,
  );
  return rows[0] ?? null;
}

export async function getSource(db: Db, id: string): Promise<SourceRow | null> {
  return (await db.query<SourceRow>(`SELECT ${SOURCE_COLUMNS} FROM news_sources WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Background loop: one source per tick, so feeds are fetched politely and sequentially. */
export function startNewsScheduler(db: Db, log: FastifyBaseLogger, tickMs = 60_000): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const flag = (await db.query<{ enabled: boolean }>(`SELECT enabled FROM feature_flags WHERE key = 'news_ingestion'`)).rows[0];
      if (!flag?.enabled) return;
      const source = await claimDueSource(db);
      if (!source) return;
      const s = await ingestSource(db, source);
      log.info({ source: source.name, ...s }, 'news ingestion run');
    } catch (e) {
      log.error({ err: e }, 'news scheduler tick failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, tickMs);
  setTimeout(tick, 5_000);
  return () => clearInterval(timer);
}
