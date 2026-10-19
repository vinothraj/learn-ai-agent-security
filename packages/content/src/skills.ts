import type { SkillArea } from '@laas/shared';

/** The six axes of the skill radar. Every lesson belongs to at least one. */
export const skills: SkillArea[] = [
  { id: 'threat-modeling', label: 'Threat modeling', lessonIds: ['a-trust-boundaries', 'a-threat-modeling-llm', 'a-secure-ai-lifecycle', 'a-ai-risk-governance', 'b-supply-chain', 'f-llm-context', 'f-ml-lifecycle'] },
  { id: 'access-data', label: 'Access & data', lessonIds: ['a-least-privilege', 'b-sensitive-info-disclosure', 'b-vector-embedding-weaknesses', 'b-data-poisoning', 'f-rag-basics', 'f-embeddings'] },
  { id: 'prompt-injection', label: 'Prompt injection', lessonIds: ['b-prompt-injection', 'b-indirect-prompt-injection', 'b-system-prompt-leakage'] },
  { id: 'output-safety', label: 'Output safety', lessonIds: ['b-improper-output-handling', 'b-misinformation', 'b-unbounded-consumption'] },
  { id: 'agents-mcp', label: 'Agents & MCP', lessonIds: ['c-excessive-agency', 'c-mcp-security', 'c-human-approval', 'c-agent-identity', 'c-memory-poisoning', 'c-unsafe-tool-execution', 'c-multi-agent-trust', 'c-agent-monitoring', 'f-tool-calling'] },
  { id: 'testing', label: 'Testing', lessonIds: ['d-test-planning', 'd-test-case-design', 'd-severity-reporting', 'd-red-teaming', 'd-guardrail-evals', 'e-ai-security-roles', 'e-explaining-findings'] },
];
