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
