import { contentPack } from '@laas/content';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseFeed } from '../src/news/feed';
import { claimDueSource, ingestSource, type Fetcher, type SourceRow } from '../src/news/ingest';
import { CATEGORY_INFO } from '../src/news/mapping';
import { canonicalUrl, classify, excerpt, extractVulnIds, hamming, hostAllowed, isAiRelevant, isHighImpact, NEAR_DUPLICATE_BITS, simhash, stripHtml } from '../src/news/text';
import { setup, type TestCtx } from './helpers';

const now = new Date();
const rfc = (d: Date) => d.toUTCString();

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Fixture</title>
  <item>
    <title>New guidance on securing AI agents &amp; MCP servers</title>
    <link>https://www.example-gov.test/news/ai-agents?utm_source=rss&amp;id=7#top</link>
    <pubDate>${rfc(now)}</pubDate>
    <description>&lt;p&gt;Agencies published joint guidance for &lt;b&gt;AI agent&lt;/b&gt; deployments. It covers tool permissions.&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;</description>
  </item>
  <item>
    <title>Critical vulnerability CVE-2026-12345 actively exploited in LLM gateway</title>
    <link>https://example-gov.test/advisories/llm-gateway</link>
    <pubDate>${rfc(now)}</pubDate>
    <description><![CDATA[<p>Attackers are exploiting a remote code execution flaw in an LLM gateway product.</p>]]></description>
  </item>
  <item>
    <title>Agency updates its parking policy</title>
    <link>https://example-gov.test/news/parking</link>
    <pubDate>${rfc(now)}</pubDate>
    <description>Nothing to do with security of models.</description>
  </item>
  <item>
    <title>AI chatbot data leak</title>
    <link>https://evil.example/phish</link>
    <pubDate>${rfc(now)}</pubDate>
    <description>Link points outside the source's domain.</description>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Blog</title>
  <entry>
    <title>Prompt injection in AI coding assistants</title>
    <link rel="alternate" href="https://blog.example-gov.test/2026/10/prompt-injection.html"/>
    <id>tag:blog,2026:1</id>
    <published>${now.toISOString()}</published>
    <summary type="html">&lt;p&gt;Researchers show indirect prompt injection via README files.&lt;/p&gt;</summary>
  </entry>
</feed>`;

describe('feed parsing and text helpers', () => {
  it('parses RSS with entity-encoded HTML and CDATA into plain text', () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(4);
    expect(items[0]!.title).toBe('New guidance on securing AI agents & MCP servers');
    expect(items[0]!.text).toBe('Agencies published joint guidance for AI agent deployments. It covers tool permissions.');
    expect(items[0]!.text).not.toMatch(/<|alert/);
    expect(items[1]!.text).toBe('Attackers are exploiting a remote code execution flaw in an LLM gateway product.');
  });

  it('parses Atom entries', () => {
    const [e] = parseFeed(ATOM);
    expect(e).toMatchObject({ title: 'Prompt injection in AI coding assistants', link: 'https://blog.example-gov.test/2026/10/prompt-injection.html' });
    expect(e!.publishedAt?.toISOString()).toBe(now.toISOString());
  });

  it('refuses XML that declares entities (XXE / billion laughs)', () => {
    const evil = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss><channel><item><title>&x;</title></item></channel></rss>`;
    expect(() => parseFeed(evil)).toThrow(/entities/);
  });

  it('canonicalises URLs and checks domains', () => {
    expect(canonicalUrl('http://WWW.Example-gov.test/news/a/?utm_source=x&b=2&a=1#frag')).toBe('https://example-gov.test/news/a?a=1&b=2');
    expect(canonicalUrl('javascript:alert(1)')).toBeNull();
    expect(hostAllowed('https://blog.example-gov.test/x', ['example-gov.test'])).toBe(true);
    expect(hostAllowed('https://example-gov.test.evil.example/x', ['example-gov.test'])).toBe(false);
  });

  it('detects near-duplicates with SimHash', () => {
    const a = simhash('CISA and partners release joint guidance on deploying AI systems securely for critical infrastructure operators');
    const b = simhash('CISA and partners release joint guidance on deploying AI systems securely for critical infrastructure operators today');
    const c = simhash('Researchers demonstrate model extraction attacks against hosted vision APIs using query budgets');
    expect(hamming(a, b)).toBeLessThanOrEqual(NEAR_DUPLICATE_BITS);
    expect(hamming(a, c)).toBeGreaterThan(NEAR_DUPLICATE_BITS + 3);
  });

  it('extracts vulnerability ids, relevance, category and impact', () => {
    expect(extractVulnIds('Fixes CVE-2026-12345 and cve-2025-0001; see GHSA-abcd-2345-wxyz')).toEqual(['CVE-2026-12345', 'CVE-2025-0001']);
    expect(isAiRelevant('New LLM jailbreak technique')).toBe(true);
    expect(isAiRelevant('Agency updates parking policy')).toBe(false);
    expect(classify('Indirect prompt injection in email assistants')).toBe('prompt-injection');
    expect(classify('MCP server authorization flaw')).toBe('agents-mcp');
    expect(classify('Joint guidance for AI deployments')).toBe('guidance');
    expect(isHighImpact('zero-day in model server', [])).toBe(true);
    expect(isHighImpact('Best practices for AI', [])).toBe(false);
  });

  it('keeps excerpts short', () => {
    const long = 'First sentence here. Second sentence here. Third sentence should be cut. Fourth.';
    expect(excerpt(long)).toBe('First sentence here. Second sentence here.');
    expect(excerpt('x'.repeat(1000)).length).toBeLessThanOrEqual(280);
    const longSentence = `${'word '.repeat(80)}end.`;
    const e = excerpt(longSentence);
    expect(e.endsWith('word…')).toBe(true); // never cut mid-word, and the cut is marked
    expect(e.length).toBeLessThanOrEqual(280);
    expect(stripHtml('<style>p{}</style><p>Hi &amp; bye</p>')).toBe('Hi & bye');
  });

  it('maps every category to real lessons, labs and interview questions', () => {
    const lessons = new Set(contentPack.lessons.map((l) => l.id));
    const labs = new Set(contentPack.labs.map((l) => l.id));
    const qs = new Set(contentPack.interview.items.map((q) => q.id));
    for (const [cat, info] of Object.entries(CATEGORY_INFO)) {
      expect(lessons.has(info.lessonId), cat).toBe(true);
      if (info.labId) expect(labs.has(info.labId), cat).toBe(true);
      expect(qs.has(info.interviewId), cat).toBe(true);
    }
  });
});

describe('ingestion pipeline and review', () => {
  let t: TestCtx;
  let source: SourceRow;
  const fetcher = (body: string): Fetcher => async () => ({ status: 'ok', body, etag: '"v1"', lastModified: null });

  beforeAll(async () => {
    t = await setup();
    await t.db.query('UPDATE news_sources SET enabled = false');
    const { rows } = await t.db.query<SourceRow>(
      `INSERT INTO news_sources (name, feed_url, publisher, allowed_domains, trust, require_ai_relevance)
       VALUES ('Fixture Gov', 'https://example-gov.test/feed.xml', 'Fixture Agency', '{example-gov.test}', 'official', true)
       RETURNING id, name, feed_url, publisher, allowed_domains, trust, require_ai_relevance, max_items_per_run, etag, last_modified`,
    );
    source = rows[0]!;
  });
  afterAll(async () => {
    await t.app.close();
    await t.db.close();
  });

  it('filters, classifies and applies the publication policy', async () => {
    const s = await ingestSource(t.db, source, fetcher(RSS));
    expect(s).toMatchObject({ status: 'ok', fetched: 4, inserted: 2, rejected: 2, duplicates: 0 });
    const { rows } = await t.db.query<{ title: string; review_status: string; high_impact: boolean; category: string; vuln_ids: string[]; canonical_url: string }>(
      'SELECT title, review_status, high_impact, category, vuln_ids, canonical_url FROM news_articles ORDER BY title',
    );
    const guidance = rows.find((r) => r.title.startsWith('New guidance'))!;
    const cve = rows.find((r) => r.title.startsWith('Critical'))!;
    expect(guidance).toMatchObject({ review_status: 'published', high_impact: false, category: 'agents-mcp', canonical_url: 'https://example-gov.test/news/ai-agents?id=7' });
    expect(cve).toMatchObject({ review_status: 'pending', high_impact: true, vuln_ids: ['CVE-2026-12345'] });
  });

  it('dedupes on re-ingest and records the run', async () => {
    const s = await ingestSource(t.db, source, fetcher(RSS));
    expect(s).toMatchObject({ inserted: 0, duplicates: 2 });
    const runs = await t.db.query<{ status: string }>('SELECT status FROM ingestion_runs WHERE source_id = $1', [source.id]);
    expect(runs.rows.every((r) => r.status === 'ok')).toBe(true);
  });

  it('records fetch errors without throwing', async () => {
    const s = await ingestSource(t.db, source, async () => {
      throw new Error('HTTP 503');
    });
    expect(s).toMatchObject({ status: 'error', error: 'HTTP 503' });
    const src = await t.db.query<{ last_status: string; last_error: string }>('SELECT last_status, last_error FROM news_sources WHERE id = $1', [source.id]);
    expect(src.rows[0]).toEqual({ last_status: 'error', last_error: 'HTTP 503' });
  });

  it('claims each due source once', async () => {
    await t.db.query('UPDATE news_sources SET enabled = true, last_fetched_at = NULL WHERE id = $1', [source.id]);
    expect((await claimDueSource(t.db))?.id).toBe(source.id);
    expect(await claimDueSource(t.db)).toBeNull(); // just claimed, not due again until its interval passes
  });

  it('serves only published articles publicly, with facts and interpretation separated', async () => {
    const res = await t.app.inject('/v1/news');
    expect(res.statusCode).toBe(200);
    const { articles } = res.json() as { articles: Record<string, any>[] };
    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({
      publisher: 'Fixture Agency',
      verification: 'source_verified',
      sourceExcerpt: expect.stringContaining('joint guidance'),
      interpretation: { origin: 'template' },
      links: { lessonId: 'c-mcp-security' },
    });
  });

  it('lets admins review the queue (audited) and blocks learners', async () => {
    const learner = await t.login('learner');
    const admin = await t.login('admin');
    expect((await t.app.inject({ url: '/v1/admin/news', headers: learner.headers })).statusCode).toBe(403);
    const pending = (await t.app.inject({ url: '/v1/admin/news?status=pending', headers: admin.headers })).json().articles as { id: string; reviewReason: string }[];
    expect(pending).toHaveLength(1);
    expect(pending[0]!.reviewReason).toMatch(/High-impact/);
    const r = await t.app.inject({ method: 'PATCH', url: `/v1/admin/news/${pending[0]!.id}`, headers: admin.headers, payload: { action: 'publish', summary: 'Vendor confirmed the flaw and released a patch; apply it now.' } });
    expect(r.json()).toEqual({ id: pending[0]!.id, reviewStatus: 'published' });
    const pub = (await t.app.inject('/v1/news')).json().articles as { interpretation: { origin: string } }[];
    expect(pub).toHaveLength(2);
    expect(pub.some((a) => a.interpretation.origin === 'editor')).toBe(true);
    const audit = await t.db.query(`SELECT 1 FROM audit_logs WHERE action = 'news.publish'`);
    expect(audit.rows).toHaveLength(1);
  });

  it('validates new sources strictly', async () => {
    const admin = await t.login('admin');
    const post = (payload: object) => t.app.inject({ method: 'POST', url: '/v1/admin/news-sources', headers: admin.headers, payload });
    const base = { name: 'Test', feedUrl: 'https://feeds.example-gov.test/a.xml', publisher: 'Example', allowedDomains: ['example-gov.test'], trust: 'community' };
    expect((await post(base)).statusCode).toBe(201);
    expect((await post(base)).statusCode).toBe(409);
    expect((await post({ ...base, feedUrl: 'http://insecure.example/a.xml' })).statusCode).toBe(400);
    expect((await post({ ...base, feedUrl: 'https://x.example/b.xml', allowedDomains: ['not a domain'] })).statusCode).toBe(400);
    expect((await post({ ...base, feedUrl: 'https://x.example/c.xml', script: '<x>' })).statusCode).toBe(400);
  });
});

describe('relevance filter regression (found in live testing)', () => {
  it('does not treat "storage" or "leverage" as AI content', () => {
    expect(isAiRelevant('Successful exploitation could allow access to storage and leverage default credentials')).toBe(false);
    expect(isAiRelevant('Thermo Fisher Torrent Suite Software')).toBe(false);
    expect(isAiRelevant('Securing RAG pipelines and AI agents')).toBe(true);
    expect(isAiRelevant('New guidance for AI-enabled systems')).toBe(true);
  });
});
