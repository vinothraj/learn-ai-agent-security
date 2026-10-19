import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFeed } from '../src/news/feed';
import { assertPublicHttpsUrl, checkUrlShape, isNonPublicAddress, type Lookup } from '../src/net';

const publicDns: Lookup = async () => [{ address: '93.184.216.34' }];
const internalDns: Lookup = async () => [{ address: '10.0.0.5' }];

describe('SSRF guard', () => {
  it('classifies addresses', () => {
    for (const ip of ['192.0.0.8', '192.0.2.10', '198.51.100.1', '203.0.113.9', '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isNonPublicAddress(ip), ip).toBe(true);
    }
    // 192.0.78.x / 192.0.66.x are public WordPress hosts (genai.owasp.org, github.blog): a real regression.
    for (const ip of ['8.8.8.8', '93.184.216.34', '172.32.0.1', '192.0.78.252', '192.0.66.2', '2606:4700::1111']) expect(isNonPublicAddress(ip), ip).toBe(false);
  });

  it('rejects unsafe URL shapes without any network', () => {
    for (const u of ['http://example.com/feed', 'https://user:pw@example.com/', 'https://localhost/feed', 'https://metadata.internal/', 'https://169.254.169.254/latest/', 'https://[::1]/', 'notaurl']) {
      expect(() => checkUrlShape(u), u).toThrow();
    }
    expect(checkUrlShape('https://www.cisa.gov/feed.xml').hostname).toBe('www.cisa.gov');
  });

  it('rejects names that resolve to internal addresses', async () => {
    await expect(assertPublicHttpsUrl('https://feeds.example.com/rss', internalDns)).rejects.toThrow(/non-public/);
    await expect(assertPublicHttpsUrl('https://feeds.example.com/rss', publicDns)).resolves.toBeInstanceOf(URL);
  });
});

describe('fetchFeed', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('checks every redirect hop', async () => {
    const seen: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      seen.push(url);
      return url.includes('start') ? new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/admin' } }) : new Response('<rss/>');
    });
    await expect(fetchFeed('https://feeds.example.com/start', { etag: null, lastModified: null }, publicDns)).rejects.toThrow(/non-public/);
    expect(seen).toEqual(['https://feeds.example.com/start']); // the internal hop was never requested
  });

  it('follows safe redirects and stops after three', async () => {
    let n = 0;
    vi.stubGlobal('fetch', async () => (n++ < 10 ? new Response(null, { status: 301, headers: { location: `https://feeds.example.com/${n}` } }) : new Response('<rss/>')));
    await expect(fetchFeed('https://feeds.example.com/0', { etag: null, lastModified: null }, publicDns)).rejects.toThrow(/too many redirects/);

    n = 9; // one redirect, then the feed
    const r = await fetchFeed('https://feeds.example.com/0', { etag: null, lastModified: null }, publicDns);
    expect(r).toMatchObject({ status: 'ok', body: '<rss/>' });
  });
});
