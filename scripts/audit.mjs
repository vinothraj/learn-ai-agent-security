// Dependency audit gate for CI: fails on high/critical advisories in production dependencies,
// except reviewed, build-time-only findings listed below (each with a reason and a review date).
import { execSync } from 'node:child_process';

const ACCEPTED = {
  'node-forge': {
    reason: 'Only in @expo/cli (dev-server and code-signing certificates at build time); not shipped in the app or the API.',
    reviewBy: '2027-01-31',
  },
  braces: {
    reason: 'Only in Metro file watching (micromatch) with glob patterns from our own config; not attacker-controlled, not shipped.',
    reviewBy: '2027-01-31',
  },
};

let raw;
try {
  raw = execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
  raw = e.stdout; // npm audit exits non-zero when it finds anything
}
const report = JSON.parse(raw);
const today = new Date().toISOString().slice(0, 10);
const problems = [];
const accepted = [];

for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
  if (!['high', 'critical'].includes(v.severity)) continue;
  // Only judge root causes (advisories), not packages that merely depend on them.
  const advisories = v.via.filter((x) => typeof x === 'object');
  if (!advisories.length) continue;
  const ok = ACCEPTED[name];
  if (ok && ok.reviewBy >= today) accepted.push(`${name}: ${ok.reason} (review by ${ok.reviewBy})`);
  else problems.push(`${v.severity} ${name}: ${advisories.map((a) => a.title).join('; ')}${ok ? ' [acceptance expired]' : ''}`);
}

for (const a of accepted) console.log(`accepted  ${a}`);
if (problems.length) {
  console.error(`\nUnaccepted high/critical advisories:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('Dependency audit passed.');
