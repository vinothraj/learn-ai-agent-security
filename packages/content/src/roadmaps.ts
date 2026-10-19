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
    lessonIds: ['a-trust-boundaries', 'a-least-privilege', 'a-threat-modeling-llm', 'a-secure-ai-lifecycle', 'a-ai-risk-governance'],
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
      'b-system-prompt-leakage',
      'b-vector-embedding-weaknesses',
      'b-data-poisoning',
      'b-supply-chain',
      'b-misinformation',
      'b-unbounded-consumption',
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
    lessonIds: [
      'c-excessive-agency',
      'c-mcp-security',
      'c-human-approval',
      'c-agent-identity',
      'c-unsafe-tool-execution',
      'c-memory-poisoning',
      'c-agent-monitoring',
      'c-multi-agent-trust',
    ],
  },
  {
    id: 'ai-security-testing',
    code: 'D',
    title: 'Practical AI Security Testing',
    tagline: 'Plan, test, score and report findings.',
    description:
      'Test planning, test-case design, pass/fail criteria, severity scoring, evidence and reporting.',
    kind: 'security',
    lessonIds: ['d-test-planning', 'd-test-case-design', 'd-severity-reporting', 'd-red-teaming', 'd-guardrail-evals'],
  },
  {
    id: 'interview-career',
    code: 'E',
    title: 'Interview & Career Prep',
    tagline: 'Practice answers that land.',
    description:
      'What AI security roles involve and how to explain your work. Pair with Practice → Interview prep for role plans and timed mock interviews.',
    kind: 'career',
    lessonIds: ['e-ai-security-roles', 'e-explaining-findings'],
  },
  {
    id: 'ai-fundamentals',
    code: 'F',
    title: 'Supporting AI Knowledge',
    tagline: 'Just enough ML, RAG and agents to secure them.',
    description:
      'LLM basics, embeddings, RAG and tool calling. Recommended when a security topic needs the background.',
    kind: 'supporting',
    lessonIds: ['f-llm-context', 'f-ml-lifecycle', 'f-rag-basics', 'f-embeddings', 'f-tool-calling'],
  },
];
