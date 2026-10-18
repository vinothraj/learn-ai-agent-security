/**
 * Builds the public pages Google Play requires (privacy policy and account-deletion instructions)
 * into site/ from packages/content/src/legal.ts, the same text the app shows.
 * Run: npm run site   (GitHub Pages publishes site/ on push to main, see .github/workflows/pages.yml)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DELETE_ACCOUNT, LEGAL, PRIVACY_POLICY, type LegalSection } from '../packages/content/src/legal';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `
:root { --bg:#F4F6FB; --surface:#FFFFFF; --text:#0E1430; --muted:#525C80; --accent:#0F766E; --border:#D7DDEC; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --bg:#0B1020; --surface:#121A33; --text:#E8ECF8; --muted:#9AA4C7; --accent:#2DD4BF; --border:#26315C; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
header p { color: var(--muted); margin-top: 4px; }
h1 { font-size: 30px; line-height: 1.2; margin: 0; }
section { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 4px 20px 12px; margin-top: 16px; }
h2 { font-size: 18px; }
a { color: var(--accent); }
nav { display:flex; gap:16px; flex-wrap:wrap; margin-top: 24px; font-size: 15px; }
`;

function page(title: string, intro: string, sections: LegalSection[]) {
  const body = sections
    .map(
      (s) => `<section><h2>${esc(s.title)}</h2>${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}${
        s.bullets ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''
      }</section>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" />
<meta name="referrer" content="no-referrer" />
<title>${esc(title)} · ${esc(LEGAL.appName)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<header><h1>${esc(title)}</h1><p>${esc(intro)}</p></header>
${body}
<nav><a href="index.html">Home</a><a href="privacy.html">Privacy policy</a><a href="delete-account.html">Delete your account</a></nav>
</main>
</body>
</html>
`;
}

const out = join(process.cwd(), 'site');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'privacy.html'), page('Privacy policy', `${LEGAL.appName} · effective ${LEGAL.effectiveDate}`, PRIVACY_POLICY));
writeFileSync(join(out, 'delete-account.html'), page('Delete your account', LEGAL.appName, DELETE_ACCOUNT));
writeFileSync(
  join(out, 'index.html'),
  page(LEGAL.appName, 'Learn AI, LLM and AI-agent security in short daily lessons, safe simulated labs and interview practice.', [
    {
      title: 'About the app',
      paragraphs: [
        'An offline-first Android app that teaches defensive AI security: prompt injection, RAG and agent risks, MCP security, testing and reporting. Labs simulate fictional systems only.',
        'No ads, no third-party trackers, and no account required.',
      ],
    },
  ]),
);
writeFileSync(join(out, '.nojekyll'), '');

if (LEGAL.contactEmail.startsWith('REPLACE')) {
  console.warn('WARNING: set LEGAL.contactEmail in packages/content/src/legal.ts before publishing these pages.');
}
console.log(`Site written to ${out}`);
