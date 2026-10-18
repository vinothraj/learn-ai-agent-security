import type { Lesson } from '@laas/shared';
import { REF } from '../references';

const common = { roadmapId: 'ai-security-foundations', status: 'needs_review', version: 1 } as const;

export const foundationsLessons: Lesson[] = [
  {
    ...common,
    id: 'a-trust-boundaries',
    title: 'Trust boundaries in AI applications',
    summary: 'Find where untrusted data meets privileged components in an LLM app.',
    level: 'beginner',
    minutes: 6,
    tags: ['threat-modeling', 'architecture'],
    prerequisites: [],
    objective:
      'Identify the trust boundaries in a typical LLM application and explain why the model itself is not a security boundary.',
    explanation: [
      'A trust boundary is any point where data or control passes between components that have different levels of trust, such as a user and your backend, or a web page and your model.',
      'In LLM applications the model mixes instructions and data in one context window. Text from users, retrieved documents, tool results and web pages all end up side by side. The model cannot reliably tell which text is an instruction it should obey.',
      'So treat the model as an untrusted component. Enforce security decisions (authorization, data access, actions) in deterministic code outside the model, at each boundary.',
    ],
    example: {
      title: 'Fictional: HelpDeskBot',
      body: 'HelpDeskBot answers employee questions using a knowledge base and can create IT tickets. Boundaries: employee to chat API, chat API to model, knowledge base to model context, model output to ticket API. If ticket creation trusts whatever the model outputs, anyone who can influence the context (a user or a poisoned document) can influence tickets.',
    },
    risk:
      'Missing a boundary means trusting attacker-influenced text in places that perform privileged actions or expose sensitive data.',
    controls: [
      'Draw a data-flow diagram and mark every boundary, including retrieval and tool results',
      'Enforce authorization in application code, never in the system prompt alone',
      'Validate and constrain model outputs before they reach downstream systems',
      'Log inputs, tool calls and decisions at boundaries for later investigation',
    ],
    quiz: [
      {
        id: 'a-tb-q1',
        prompt: 'Why should the LLM not be treated as a security boundary?',
        options: [
          'Models are too slow to enforce rules',
          'Instructions and data share one context, so injected text can change model behavior',
          'Models cannot read system prompts',
          'Security rules are not allowed in prompts',
        ],
        correctIndex: 1,
        explanation:
          'The model processes instructions and untrusted data together and can be steered by injected text, so enforcement must live in deterministic code.',
      },
      {
        id: 'a-tb-q2',
        prompt: 'Which of these is a trust boundary in a RAG application?',
        options: [
          'Between two functions in the same trusted module',
          'Between retrieved documents and the model context',
          'Between a CSS file and HTML',
          'Between two log lines',
        ],
        correctIndex: 1,
        explanation:
          'Retrieved documents may contain attacker-controlled text, so the point where they enter the model context is a trust boundary.',
      },
      {
        id: 'a-tb-q3',
        prompt: 'Where is the safest place to enforce "users may only read their own tickets"?',
        options: [
          'In the system prompt',
          'In the model fine-tuning data',
          'In the backend authorization check on the ticket API',
          'In the chat UI',
        ],
        correctIndex: 2,
        explanation:
          'Server-side authorization is deterministic and cannot be talked out of its rules by a prompt.',
      },
    ],
    interview: {
      id: 'a-tb-iq',
      question: 'Walk me through how you would threat model a new LLM-powered support assistant.',
      modelAnswer:
        'I would start with a data-flow diagram covering users, the API, the model, retrieval sources, tools and logs, then mark trust boundaries. For each boundary I would apply a framework such as STRIDE plus the OWASP LLM Top 10: prompt injection, sensitive data disclosure, improper output handling, excessive agency. I would treat the model as untrusted, keep authorization in code, rate-limit and log, and turn the findings into prioritized controls and test cases.',
      keyConcepts: ['data-flow diagram', 'trust boundaries', 'model is untrusted', 'authorization in code', 'OWASP LLM Top 10', 'test cases'],
      evidence: 'established',
    },
    references: [REF.owaspThreatModeling, REF.owaspLlmTop10, REF.ncscSecureAi],
    evidence: 'established',
  },
  {
    ...common,
    id: 'a-least-privilege',
    title: 'Least privilege for AI features',
    summary: 'Give models, tools and service accounts only the access they need.',
    level: 'beginner',
    minutes: 6,
    tags: ['authorization', 'least-privilege'],
    prerequisites: ['a-trust-boundaries'],
    objective:
      'Apply least privilege to the identities and credentials an AI feature uses, and explain why it limits the blast radius of prompt injection.',
    explanation: [
      'Least privilege means every identity (a user, service or agent) gets the minimum permissions it needs, for the shortest time needed.',
      'AI features often run under one powerful service account so "the bot can answer anything". If the model is manipulated, it then acts with all of that power.',
      'Prefer acting on behalf of the signed-in user with their permissions, scope credentials narrowly (read-only where possible) and separate high-risk actions behind extra checks.',
    ],
    example: {
      title: 'Fictional: FinanceAssist',
      body: 'FinanceAssist summarizes invoices. It was given a database account with full read/write on every table. A crafted invoice note makes the model call an "update" query. With a read-only, invoice-scoped account, the same attack fails safely.',
    },
    risk:
      'Over-privileged AI components turn a successful manipulation into data theft or destructive changes across systems.',
    controls: [
      'Use the end user\'s identity and permissions (delegated access) where possible',
      'Scope tokens and database roles to the minimum tables and operations',
      'Use short-lived credentials and rotate them',
      'Require step-up approval for destructive or high-impact actions',
    ],
    quiz: [
      {
        id: 'a-lp-q1',
        prompt: 'An assistant only needs to read a user\'s calendar. What access should it get?',
        options: [
          'Admin access to all calendars',
          'Read and write access to the user\'s calendar',
          'Read-only access to that user\'s calendar',
          'The same access as the IT team',
        ],
        correctIndex: 2,
        explanation: 'Read-only, user-scoped access is the minimum that satisfies the task.',
      },
      {
        id: 'a-lp-q2',
        prompt: 'How does least privilege help against prompt injection?',
        options: [
          'It stops all injected text from reaching the model',
          'It limits what a manipulated model can actually do',
          'It makes the model refuse malicious prompts',
          'It encrypts the prompt',
        ],
        correctIndex: 1,
        explanation:
          'Least privilege does not prevent injection; it reduces the impact (blast radius) when injection succeeds.',
      },
    ],
    interview: {
      id: 'a-lp-iq',
      question: 'How would you design permissions for an internal AI assistant that can query company systems?',
      modelAnswer:
        'I would have the assistant act on behalf of the signed-in user with delegated, scoped tokens instead of a shared super-account, so it can never see more than that user. Tools get the narrowest scopes, read-only by default and short-lived. Writes and destructive actions require explicit user confirmation and are audit-logged. I would review permissions regularly and test that a manipulated model cannot escalate.',
      keyConcepts: ['delegated access', 'scoped tokens', 'read-only by default', 'short-lived credentials', 'confirmation for writes', 'audit logging'],
      evidence: 'established',
    },
    references: [REF.owaspAuthzCheatSheet, REF.owaspLlmTop10],
    evidence: 'established',
  },
];
