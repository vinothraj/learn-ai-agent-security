import type { NewsCategory } from './text';

/**
 * Deterministic "our interpretation" layer: each category maps to a defensive takeaway and to
 * existing learning content. Clearly labelled in the app as interpretation, not source fact.
 */
export const CATEGORY_INFO: Record<NewsCategory, { label: string; defense: string; lessonId: string; labId: string | null; interviewId: string }> = {
  'prompt-injection': {
    label: 'Prompt injection',
    defense: 'Assume injected instructions will sometimes succeed: keep secrets out of context, limit tool permissions and require confirmation for outbound actions.',
    lessonId: 'b-indirect-prompt-injection',
    labId: 'lab-prompt-injection',
    interviewId: 'iq-pi-direct-indirect',
  },
  'agents-mcp': {
    label: 'Agents & MCP',
    defense: 'Review agent tool permissions, pin and re-approve MCP servers, validate token audiences and log every tool call.',
    lessonId: 'c-mcp-security',
    labId: 'lab-mcp-authorization',
    interviewId: 'iq-ag-email-agent-perms',
  },
  'data-leakage': {
    label: 'Data leakage',
    defense: 'Enforce access control at retrieval, minimise and redact data before indexing, and limit log retention.',
    lessonId: 'b-sensitive-info-disclosure',
    labId: 'lab-sensitive-data',
    interviewId: 'iq-ad-tenant-rag',
  },
  'supply-chain': {
    label: 'AI supply chain',
    defense: 'Only load models and packages from trusted sources, verify integrity, avoid unsafe serialization formats and scan dependencies.',
    lessonId: 'a-trust-boundaries',
    labId: null,
    interviewId: 'iq-tm-design-review',
  },
  'model-attacks': {
    label: 'Model attacks',
    defense: 'Validate training and retrieval data provenance, monitor for anomalous outputs and red-team models before release.',
    lessonId: 'f-rag-basics',
    labId: 'lab-rag-access',
    interviewId: 'iq-te-guardrail-measure',
  },
  vulnerability: {
    label: 'Vulnerability',
    defense: 'Check whether affected products are in your environment, apply vendor patches or mitigations, and monitor for exploitation.',
    lessonId: 'd-severity-reporting',
    labId: 'lab-logging-monitoring',
    interviewId: 'iq-te-not-reproducible',
  },
  guidance: {
    label: 'Guidance',
    defense: 'Compare the guidance with your current AI security controls and record gaps as backlog items with owners.',
    lessonId: 'a-trust-boundaries',
    labId: null,
    interviewId: 'iq-tm-stride-llm',
  },
  research: {
    label: 'Research',
    defense: 'Research results are early signals: check whether the technique applies to your systems before changing priorities.',
    lessonId: 'd-test-planning',
    labId: 'lab-guardrail-eval',
    interviewId: 'iq-pi-classifier-bypass',
  },
};

/** Template summary (no AI): category framing plus the source's own excerpt, both labelled in the UI. */
export function templateSummary(category: NewsCategory, publisher: string, vulnIds: readonly string[]): string {
  const label = CATEGORY_INFO[category].label;
  const ids = vulnIds.length ? ` It references ${vulnIds.slice(0, 3).join(', ')}${vulnIds.length > 3 ? ' and more' : ''}.` : '';
  return `${publisher} published an item classified as ${label.toLowerCase()}.${ids}`;
}
