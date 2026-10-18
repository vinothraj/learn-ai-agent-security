import type { Roadmap } from '@laas/shared';

export const roadmaps: Roadmap[] = [
  {
    id: 'ai-security-foundations',
    code: 'A',
    title: 'AI Security Foundations',
    tagline: 'Think like a defender before you touch a model.',
    description:
      'Threat modeling, trust boundaries, least privilege and risk assessment applied to AI-powered applications.',
    kind: 'security',
    lessonIds: ['a-trust-boundaries', 'a-least-privilege'],
  },
  {
    id: 'genai-llm-security',
    code: 'B',
    title: 'GenAI & LLM Security',
    tagline: 'Prompt injection, data leakage and unsafe outputs.',
    description:
      'The core risks of LLM applications, mapped to the OWASP Top 10 for LLM Applications, with practical defenses.',
    kind: 'security',
    lessonIds: [
      'b-prompt-injection',
      'b-indirect-prompt-injection',
      'b-sensitive-info-disclosure',
      'b-improper-output-handling',
    ],
  },
  {
    id: 'agent-security',
    code: 'C',
    title: 'AI Agent Security',
    tagline: 'Tools, permissions, MCP and human approval.',
    description:
      'How agents expand the attack surface through tools and autonomy, and how to constrain them safely.',
    kind: 'security',
    lessonIds: ['c-excessive-agency', 'c-mcp-security', 'c-human-approval'],
  },
  {
    id: 'ai-security-testing',
    code: 'D',
    title: 'Practical AI Security Testing',
    tagline: 'Plan, test, score and report findings.',
    description:
      'Test planning, test-case design, pass/fail criteria, severity scoring, evidence and reporting. Lessons arrive in the next content pack.',
    kind: 'security',
    lessonIds: [],
  },
  {
    id: 'interview-career',
    code: 'E',
    title: 'Interview & Career Prep',
    tagline: 'Practice answers that land.',
    description:
      'Role-based preparation for AI security interviews. Full mock interviews arrive in a later release.',
    kind: 'career',
    lessonIds: [],
  },
  {
    id: 'ai-fundamentals',
    code: 'F',
    title: 'Supporting AI Knowledge',
    tagline: 'Just enough ML, RAG and agents to secure them.',
    description:
      'LLM basics, embeddings, RAG and tool calling. Recommended when a security topic needs the background.',
    kind: 'supporting',
    lessonIds: [],
  },
];
