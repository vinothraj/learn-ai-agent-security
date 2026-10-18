import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Production builds get a strict Content Security Policy (dev keeps Vite's inline HMR preamble).
 * The API and Supabase origins are the only places the panel may connect to. frame-ancestors
 * cannot be set in a meta tag: send it as a header from the host (see docs/security.md).
 */
function csp(env: Record<string, string>): Plugin {
  const connect = ["'self'", env.VITE_API_URL, env.VITE_SUPABASE_URL].filter(Boolean).map((u) => (u!.startsWith("'") ? u : new URL(u!).origin));
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'admin-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<meta name="referrer"', `<meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer"`),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss(), csp(env)],
    server: { port: 5173, strictPort: true },
  };
});
