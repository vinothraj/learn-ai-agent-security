import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

/**
 * Enterprise networks often require an outbound HTTP(S) proxy. When HTTPS_PROXY / HTTP_PROXY is
 * set, route all server-side fetch() calls (feeds, Supabase admin API) through it, honouring
 * NO_PROXY. Without these variables nothing changes.
 */
export function configureOutboundProxy(env: Record<string, string | undefined> = process.env): boolean {
  const proxy = env.HTTPS_PROXY ?? env.https_proxy ?? env.HTTP_PROXY ?? env.http_proxy;
  if (!proxy) return false;
  setGlobalDispatcher(new EnvHttpProxyAgent());
  return true;
}

const proxyConfigured = () => !!(process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy);

/** Loopback, private, link-local (incl. cloud metadata), CGNAT, multicast and reserved ranges. */
export function isNonPublicAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1') return true;
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isNonPublicAddress(mapped[1]!);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x);
  }
  return true; // not an IP at all
}

const BLOCKED_HOST = /(^|\.)(localhost|local|internal|home\.arpa)$/i;

export type Lookup = (host: string) => Promise<{ address: string }[]>;
const defaultLookup: Lookup = (host) => dnsLookup(host, { all: true });

/**
 * Server-side request forgery guard for admin-configured URLs (news feeds): https only, no
 * credentials, and the host must resolve only to public addresses. When an outbound proxy is
 * configured and local DNS cannot resolve the name, the proxy resolves it (literal checks still apply).
 */
export async function assertPublicHttpsUrl(raw: string, lookup: Lookup = defaultLookup): Promise<URL> {
  const url = checkUrlShape(raw);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return url;
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host);
  } catch {
    if (proxyConfigured()) return url;
    throw new Error(`cannot resolve ${host}`);
  }
  if (!addresses.length || addresses.some((a) => isNonPublicAddress(a.address))) throw new Error('host resolves to a non-public address');
  return url;
}

/** Checks that need no network: scheme, credentials, internal names and literal addresses. */
export function checkUrlShape(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('invalid URL');
  }
  if (url.protocol !== 'https:') throw new Error('only https URLs are allowed');
  if (url.username || url.password) throw new Error('URLs with credentials are not allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (BLOCKED_HOST.test(host)) throw new Error('internal host names are not allowed');
  if (isIP(host) && isNonPublicAddress(host)) throw new Error('non-public addresses are not allowed');
  return url;
}
