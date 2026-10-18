import type { InterviewRole } from '@laas/shared';

/** Role-based prep plans. Tasks auto-complete from real progress (lessons, labs, games, mocks). */
export const roles: InterviewRole[] = [
  {
    id: 'ai-security-engineer',
    title: 'AI Security Engineer',
    summary: 'Secures AI features end to end: threat models, controls, reviews and incident response across LLM apps and agents.',
    focusSkills: ['threat-modeling', 'access-data', 'prompt-injection', 'agents-mcp'],
    weeks: [
      { title: 'Week 1 · Foundations', goal: 'Threat model an LLM app and explain least privilege.', tasks: ['lesson:a-trust-boundaries', 'lesson:a-least-privilege', 'lesson:b-prompt-injection', 'topic:threat-modeling'] },
      { title: 'Week 2 · Data and agents', goal: 'Handle data leakage and agent permissions with confidence.', tasks: ['lesson:b-sensitive-info-disclosure', 'lesson:c-excessive-agency', 'lab:lab-sensitive-data', 'lab:lab-excessive-agency', 'topic:access-data'] },
      { title: 'Week 3 · Interview ready', goal: 'Answer scenario questions under time pressure.', tasks: ['lab:lab-prompt-injection', 'topic:agents-mcp', 'mock'] },
    ],
  },
  {
    id: 'genai-security-engineer',
    title: 'GenAI Security Engineer',
    summary: 'Specialises in LLM application risks: prompt injection, data exposure, output handling and guardrails.',
    focusSkills: ['prompt-injection', 'access-data', 'output-safety'],
    weeks: [
      { title: 'Week 1 · LLM risks', goal: 'Explain the OWASP LLM Top 10 essentials with examples.', tasks: ['lesson:b-prompt-injection', 'lesson:b-indirect-prompt-injection', 'lesson:b-improper-output-handling', 'game:classify-it'] },
      { title: 'Week 2 · Hands-on', goal: 'Break and fix injection, XSS and data-leak scenarios.', tasks: ['lab:lab-prompt-injection', 'lab:lab-output-xss', 'lab:lab-rag-access', 'topic:prompt-injection'] },
      { title: 'Week 3 · Guardrails and interviews', goal: 'Discuss guardrail limits and evaluation.', tasks: ['lab:lab-guardrail-eval', 'topic:output-safety', 'mock'] },
    ],
  },
  {
    id: 'ai-red-team-engineer',
    title: 'AI Red Team Engineer',
    summary: 'Plans and runs adversarial testing of AI systems, measures bypass rates and reports findings.',
    focusSkills: ['prompt-injection', 'testing', 'agents-mcp'],
    weeks: [
      { title: 'Week 1 · Attack surface', goal: 'Map direct, indirect and agentic attack paths.', tasks: ['lesson:b-prompt-injection', 'lesson:b-indirect-prompt-injection', 'lesson:c-mcp-security', 'game:spot-the-injection'] },
      { title: 'Week 2 · Methodology', goal: 'Plan engagements and score probabilistic findings.', tasks: ['lesson:d-test-planning', 'lesson:d-severity-reporting', 'lab:lab-guardrail-eval', 'topic:testing'] },
      { title: 'Week 3 · Agents and MCP', goal: 'Exploit and explain agent and MCP weaknesses.', tasks: ['lab:lab-mcp-authorization', 'lab:lab-tool-calls', 'topic:agents-mcp'] },
      { title: 'Week 4 · Mock loop', goal: 'Perform under interview conditions.', tasks: ['topic:prompt-injection', 'mock'] },
    ],
  },
  {
    id: 'ai-security-tester',
    title: 'AI Security Tester',
    summary: 'Designs test cases, executes them reproducibly and writes clear, actionable findings for AI features.',
    focusSkills: ['testing', 'prompt-injection', 'output-safety'],
    weeks: [
      { title: 'Week 1 · Test design', goal: 'Write test cases with expected results and pass/fail criteria.', tasks: ['lesson:d-test-planning', 'lesson:b-prompt-injection', 'game:finding-fix-match', 'topic:testing'] },
      { title: 'Week 2 · Execute and report', goal: 'Run labs end to end and export reports.', tasks: ['lesson:d-severity-reporting', 'lab:lab-output-xss', 'lab:lab-human-approval', 'topic:output-safety'] },
      { title: 'Week 3 · Interview ready', goal: 'Explain reproducibility and severity under pressure.', tasks: ['lab:lab-logging-monitoring', 'mock'] },
    ],
  },
  {
    id: 'appsec-llm',
    title: 'Application Security Engineer (LLM apps)',
    summary: 'Applies classic AppSec (injection, XSS, SSRF, authZ) to applications that embed LLMs.',
    focusSkills: ['output-safety', 'access-data', 'threat-modeling'],
    weeks: [
      { title: 'Week 1 · Old bugs, new source', goal: 'Treat model output as untrusted input.', tasks: ['lesson:b-improper-output-handling', 'lesson:a-trust-boundaries', 'game:patch-it', 'topic:output-safety'] },
      { title: 'Week 2 · Labs', goal: 'Fix XSS, SQLi and SSRF through model output.', tasks: ['lab:lab-output-xss', 'lab:lab-tool-calls', 'lab:lab-sensitive-data', 'topic:access-data'] },
      { title: 'Week 3 · Interview ready', goal: 'Review designs and defend recommendations.', tasks: ['game:secure-or-not', 'topic:threat-modeling', 'mock'] },
    ],
  },
  {
    id: 'agent-security-engineer',
    title: 'AI Agent Security Engineer',
    summary: 'Secures autonomous agents: tool permissions, MCP, identity, human approval and monitoring.',
    focusSkills: ['agents-mcp', 'access-data', 'threat-modeling'],
    weeks: [
      { title: 'Week 1 · Agency', goal: 'Reduce functionality, permissions and autonomy.', tasks: ['lesson:c-excessive-agency', 'lesson:a-least-privilege', 'game:least-privilege', 'lab:lab-excessive-agency'] },
      { title: 'Week 2 · MCP and approvals', goal: 'Secure tool ecosystems and human-in-the-loop.', tasks: ['lesson:c-mcp-security', 'lesson:c-human-approval', 'lab:lab-mcp-authorization', 'lab:lab-human-approval'] },
      { title: 'Week 3 · Operate', goal: 'Monitor agents and answer design questions.', tasks: ['lab:lab-logging-monitoring', 'topic:agents-mcp', 'mock'] },
    ],
  },
  {
    id: 'ml-engineer-security',
    title: 'AI/ML Engineer with security duties',
    summary: 'Builds LLM and RAG features and owns their baseline security.',
    focusSkills: ['threat-modeling', 'access-data', 'prompt-injection'],
    weeks: [
      { title: 'Week 1 · How it breaks', goal: 'Understand context, RAG and injection.', tasks: ['lesson:f-llm-context', 'lesson:f-rag-basics', 'lesson:b-prompt-injection', 'game:rag-leak-hunt'] },
      { title: 'Week 2 · Build it safely', goal: 'Apply access control and data protection in RAG.', tasks: ['lesson:b-sensitive-info-disclosure', 'lab:lab-rag-access', 'topic:access-data'] },
      { title: 'Week 3 · Interview ready', goal: 'Discuss security trade-offs as a builder.', tasks: ['topic:threat-modeling', 'mock'] },
    ],
  },
];
