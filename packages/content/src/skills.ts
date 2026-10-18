import type { SkillArea } from '@laas/shared';

/** The six axes of the skill radar. Every lesson belongs to at least one. */
export const skills: SkillArea[] = [
  { id: 'threat-modeling', label: 'Threat modeling', lessonIds: ['a-trust-boundaries', 'f-llm-context'] },
  { id: 'access-data', label: 'Access & data', lessonIds: ['a-least-privilege', 'b-sensitive-info-disclosure', 'f-rag-basics'] },
  { id: 'prompt-injection', label: 'Prompt injection', lessonIds: ['b-prompt-injection', 'b-indirect-prompt-injection'] },
  { id: 'output-safety', label: 'Output safety', lessonIds: ['b-improper-output-handling'] },
  { id: 'agents-mcp', label: 'Agents & MCP', lessonIds: ['c-excessive-agency', 'c-mcp-security', 'c-human-approval'] },
  { id: 'testing', label: 'Testing', lessonIds: ['d-test-planning', 'd-severity-reporting'] },
];
