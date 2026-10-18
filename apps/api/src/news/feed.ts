import { XMLParser } from 'fast-xml-parser';
import { assertPublicHttpsUrl, type Lookup } from '../net';
import { decodeEntities, stripHtml } from './text';

/** Some feeds entity-encode their HTML (&lt;p&gt;), so decode first, then strip tags. */
const plain = (s: string) => stripHtml(decodeEntities(s));

export interface FeedItem {
  title: string;
  link: string;
  publishedAt: Date | null;
  text: string;
  guid: string | null;
}

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
export const USER_AGENT = 'LearnAIAgentSecurity-NewsBot/0.1 (feed reader; respects robots and rate limits)';

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown): string => {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object' && v && '#text' in v) return String((v as Record<string, unknown>)['#text']);
  return '';
};
const date = (v: unknown): Date | null => {
  const d = new Date(text(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Parses RSS 2.0, RSS 1.0 (RDF) and Atom. Rejects documents that declare entities (XXE / billion laughs). */
export function parseFeed(xml: string): FeedItem[] {
  if (/<!ENTITY/i.test(xml)) throw new Error('feed declares XML entities; refusing to parse');
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', processEntities: false, htmlEntities: false }).parse(xml) as Record<string, any>;

  if (doc.rss?.channel || doc['rdf:RDF']) {
    const items = asArray(doc.rss?.channel?.item ?? doc['rdf:RDF']?.item);
    return items.map((i: Record<string, unknown>) => ({
      title: plain(text(i.title)),
      link: decodeEntities(text(i.link)).trim(),
      publishedAt: date(i.pubDate ?? i['dc:date']),
      text: plain(text(i.description ?? i['content:encoded'])),
      guid: text(i.guid) || null,
    }));
  }
  if (doc.feed) {
    return asArray(doc.feed.entry).map((e: Record<string, any>) => {
      const links = asArray(e.link) as Record<string, string>[];
      const link = links.find((l) => (l['@rel'] ?? 'alternate') === 'alternate')?.['@href'] ?? links[0]?.['@href'] ?? '';
      return {
        title: plain(text(e.title)),
        link: decodeEntities(link).trim(),
        publishedAt: date(e.published ?? e.updated),
        text: plain(text(e.summary ?? e.content)),
        guid: text(e.id) || null,
      };
    });
  }
  throw new Error('unrecognised feed format');
}

export interface FetchResult {
  status: 'ok' | 'not-modified';
  body?: string;
  etag?: string | null;
  lastModified?: string | null;
}

const MAX_REDIRECTS = 3;

/**
 * HTTPS only, public hosts only (SSRF guard on every redirect hop), bounded time and size,
 * conditional requests so unchanged feeds cost nothing.
 */
export async function fetchFeed(
  url: string,
  prev: { etag: string | null; lastModified: string | null },
  lookup?: Lookup,
): Promise<FetchResult> {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' };
  if (prev.etag) headers['If-None-Match'] = prev.etag;
  if (prev.lastModified) headers['If-Modified-Since'] = prev.lastModified;
  let target = url;
  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHttpsUrl(target, lookup);
    res = await fetch(target, { headers, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    const location = res.status >= 300 && res.status < 400 && res.status !== 304 ? res.headers.get('location') : null;
    if (!location) break;
    target = new URL(location, target).toString();
    res = null;
  }
  if (!res) throw new Error('too many redirects');
  if (res.status === 304) return { status: 'not-modified' };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) throw new Error('feed too large');
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error('feed too large');
  return { status: 'ok', body: new TextDecoder().decode(buf), etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified') };
}
