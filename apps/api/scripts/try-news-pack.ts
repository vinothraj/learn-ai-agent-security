/** Dev helper: run the news-pack prompt against a provider and show raw output + validation. */
import { ollamaProvider, extractJson } from '../src/ai/providers';
import { NewsPack, NEWS_PACK_SYSTEM } from '../src/jobs';

const p = ollamaProvider('http://127.0.0.1:11434', process.env.AI_MODEL ?? 'llama3.2');
const prompt = `Lesson: Trust boundaries in AI applications. Find where untrusted data meets privileged components in an LLM app.
<article>
Title: Key Practices for Incident Readiness and Response in AI systems
CISA and partners released guidance on preparing for incidents involving AI systems, including logging model inputs and outputs, defining escalation paths, isolating compromised components, and practising response with tabletop exercises.
</article>`;
for (const json of [false, true]) {
  const t = Date.now();
  const r = await p.complete({ system: NEWS_PACK_SYSTEM, prompt, maxTokens: 700, temperature: 0.3, json });
  const parsed = NewsPack.safeParse(extractJson(r.text));
  console.log(`\n--- json mode ${json} (${Math.round((Date.now() - t) / 1000)} s) valid=${parsed.success}`);
  console.log(r.text.slice(0, 900));
  if (!parsed.success) console.log('ISSUES:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' | '));
}
