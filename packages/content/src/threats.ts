import type { ThreatItem } from '@laas/shared';
import { REF } from './references';

/**
 * Curated "Threat of the Day" cards: stable, well-documented risk patterns, not news.
 * Live, source-linked news arrives with the ingestion pipeline (Phase 6).
 */
export const threats: ThreatItem[] = [
  {
    id: 't-direct-injection',
    title: 'Direct prompt injection',
    category: 'LLM01 Prompt Injection',
    summary: 'A user crafts input that overrides the application\'s instructions to leak data or bypass policy.',
    defense: 'Keep secrets out of context, limit model capabilities and validate outputs. Prompts alone are not enforcement.',
    lessonId: 'b-prompt-injection',
    reference: REF.owaspLlmTop10,
  },
  {
    id: 't-hidden-web-instructions',
    title: 'Hidden instructions in web pages',
    category: 'LLM01 Prompt Injection (indirect)',
    summary: 'Invisible text on a page tells a browsing agent to exfiltrate data or take actions on the user\'s behalf.',
    defense: 'Treat fetched content as untrusted, restrict actions while processing it and confirm outbound data transfers.',
    lessonId: 'b-indirect-prompt-injection',
    reference: REF.owaspPromptInjectionCheatSheet,
  },
  {
    id: 't-rag-acl-bypass',
    title: 'RAG retrieval ignoring permissions',
    category: 'LLM02 Sensitive Information Disclosure',
    summary: 'A retrieval pipeline returns documents the requesting user is not allowed to see, and the model quotes them.',
    defense: 'Filter retrieval by the authenticated user\'s permissions and tenant before anything reaches the model.',
    lessonId: 'b-sensitive-info-disclosure',
    reference: REF.owaspLlmTop10,
  },
  {
    id: 't-llm-xss',
    title: 'XSS through model output',
    category: 'LLM05 Improper Output Handling',
    summary: 'Model output rendered as raw HTML lets attacker-influenced scripts run in other users\' browsers.',
    defense: 'Encode output for its context, sanitize Markdown rendering and never inject raw model HTML.',
    lessonId: 'b-improper-output-handling',
    reference: REF.owaspXssCheatSheet,
  },
  {
    id: 't-overpowered-tools',
    title: 'Over-powered agent tools',
    category: 'LLM06 Excessive Agency',
    summary: 'Agents given generic shell, SQL or HTTP tools can be steered into destructive or data-leaking actions.',
    defense: 'Replace generic tools with narrow ones, scope credentials and require approval for high-impact actions.',
    lessonId: 'c-excessive-agency',
    reference: REF.owaspLlmTop10,
  },
  {
    id: 't-mcp-tool-poisoning',
    title: 'MCP tool poisoning',
    category: 'Agent / MCP security',
    summary: 'A malicious MCP server hides instructions in tool descriptions that the model reads and follows.',
    defense: 'Allow-list and pin MCP servers, review tool descriptions and re-approve when tools change.',
    lessonId: 'c-mcp-security',
    reference: REF.mcpSecurity,
  },
  {
    id: 't-token-passthrough',
    title: 'Token passthrough',
    category: 'Agent / MCP security',
    summary: 'An MCP server forwards client tokens to downstream APIs, bypassing audience checks and auditing.',
    defense: 'Validate token audience for the server and obtain separate, minimally scoped tokens for downstream calls.',
    lessonId: 'c-mcp-security',
    reference: REF.mcpSecurity,
  },
  {
    id: 't-approval-fatigue',
    title: 'Approval fatigue',
    category: 'Human oversight',
    summary: 'Frequent, vague confirmation prompts train users to approve agent actions without reading them.',
    defense: 'Use risk-based approvals that show exact parameters and anomalies, rendered from structured data.',
    lessonId: 'c-human-approval',
    reference: REF.ncscSecureAi,
  },
  {
    id: 't-system-prompt-leak',
    title: 'System prompt leakage',
    category: 'LLM07 System Prompt Leakage',
    summary: 'Attackers extract system prompts that contain secrets, internal rules or sensitive logic.',
    defense: 'Assume system prompts can leak: never store credentials or authorization logic in them.',
    lessonId: 'b-prompt-injection',
    reference: REF.owaspLlmTop10,
  },
  {
    id: 't-unbounded-consumption',
    title: 'Unbounded consumption',
    category: 'LLM10 Unbounded Consumption',
    summary: 'Attackers drive excessive model usage (long inputs, agent loops) to cause cost spikes or denial of service.',
    defense: 'Apply rate limits, input size limits, per-user budgets and step limits on agent loops.',
    lessonId: 'c-excessive-agency',
    reference: REF.owaspLlmTop10,
  },
];
